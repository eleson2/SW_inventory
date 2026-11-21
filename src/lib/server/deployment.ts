/**
 * Package deployment logic shared by routes.
 *
 * Portable Prisma implementation. If a provider-specific faster version is ever
 * needed (see db-dialect.ts), add it behind these functions so routes don't change.
 */
import { db } from './db.ts';
import { compareVersions, sameVersion } from '#lib/utils/version-parser.ts';

export type DeploymentAction = 'install' | 'upgrade' | 'downgrade' | 'no_change';

export type DeploymentChange = {
	software_name: string;
	current_version: string | null;
	target_version: string;
	action: DeploymentAction;
};

export type DeploymentPreview = {
	lparId: string;
	lparName: string;
	lparCode: string;
	changes: DeploymentChange[];
};

/**
 * What deploying a package would change on each LPAR: new installs first, then by
 * software name. Software installed on the LPAR but not in the package is not listed.
 */
export async function getDeploymentImpact(
	packageId: string,
	lparIds: string[]
): Promise<DeploymentPreview[]> {
	// Two queries total: the package contents, and the selected LPARs with their installations
	const [packageItems, lpars] = await Promise.all([
		db.package_items.findMany({
			where: { package_id: packageId },
			select: {
				software_id: true,
				software: { select: { name: true } },
				software_version: { select: { version: true, ptf_level: true } }
			}
		}),
		db.lpars.findMany({
			where: { id: { in: lparIds } },
			select: {
				id: true,
				name: true,
				code: true,
				lpar_software: {
					select: { software_id: true, current_version: true, current_ptf_level: true }
				}
			}
		})
	]);
	const lparById = new Map(lpars.map((l) => [l.id, l]));
	const formatVersion = (version: string, ptf: string | null) =>
		`${version}${ptf ? ` (${ptf})` : ''}`;

	return lparIds.map((lparId) => {
		const lpar = lparById.get(lparId);
		if (!lpar) {
			return { lparId, lparName: 'Unknown', lparCode: 'Unknown', changes: [] };
		}
		const installed = new Map(lpar.lpar_software.map((ls) => [ls.software_id, ls]));

		const changes = packageItems
			.map((item) => {
				const current = installed.get(item.software_id);
				const target = item.software_version;
				let action: 'install' | 'upgrade' | 'downgrade' | 'no_change';
				if (!current) {
					action = 'install';
				} else if (
					sameVersion(target, { version: current.current_version, ptf_level: current.current_ptf_level })
				) {
					action = 'no_change';
				} else {
					action = compareVersions(target.version, current.current_version) < 0 ? 'downgrade' : 'upgrade';
				}
				return {
					software_name: item.software.name,
					current_version: current
						? formatVersion(current.current_version, current.current_ptf_level)
						: null,
					target_version: formatVersion(target.version, target.ptf_level),
					action
				};
			})
			// New installs first, then by software name
			.sort(
				(a, b) =>
					Number(b.action === 'install') - Number(a.action === 'install') ||
					a.software_name.localeCompare(b.software_name)
			);

		return { lparId, lparName: lpar.name, lparCode: lpar.code, changes };
	});
}
