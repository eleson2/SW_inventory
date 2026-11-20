import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog, checkUniqueConstraint } from '#lib/server/db.ts';
import { fail, redirect, error } from '@sveltejs/kit';
import { lparWithSoftwareSchema } from '#lib/schemas/lpar.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import { validateMasterDetailForm } from '#lib/server/master-detail-form.ts';

export const load: PageServerLoad = async ({ params }) => {
	const [lpar, customers, packages, allSoftware] = await Promise.all([
		db.lpars.findUnique({
			where: { id: params.id },
			include: {
				lpar_software: {
					include: {
						software: {
							include: {
								vendors: true
							}
						}
					}
				},
				packages: {
					include: {
						package_items: true
					}
				}
			}
		}),
		db.customers.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, code: true }
		}),
		db.packages.findMany({
			where: { active: true },
			orderBy: { release_date: 'desc' },
			select: { id: true, name: true, code: true, version: true }
		}),
		db.software.findMany({
			where: { active: true },
			include: {
				vendors: true,
				versions: {
					orderBy: [
						{ is_current: 'desc' },
						{ release_date: 'desc' }
					]
				}
			},
			orderBy: { name: 'asc' }
		})
	]);

	if (!lpar) {
		throw error(404, 'LPAR not found');
	}

	// Initialize Superforms with LPAR data (only fields matching schema)
	const form = await serverValidate(
		{
			name: lpar.name,
			code: lpar.code,
			customer_id: lpar.customer_id,
			description: lpar.description || '',
			current_package_id: lpar.current_package_id || '',
			active: lpar.active,
			software_installations: lpar.lpar_software.map(ls => ({
				id: ls.id,
				software_id: ls.software_id,
				software_version_id: findVersionId(allSoftware, ls.software_id, ls.current_version, ls.current_ptf_level),
				installed_date: ls.installed_date,
				_action: 'keep' as const
			}))
		},
		lparWithSoftwareSchema
	);

	return {
		form,
		lpar,
		customers,
		packages,
		allSoftware
	};
};

type SoftwareWithVersions = { id: string; versions: { id: string; version: string; ptf_level: string | null }[] };

/** lpar_software stores version/PTF strings; map them back to a software_versions id */
function findVersionId(
	allSoftware: SoftwareWithVersions[],
	softwareId: string,
	version: string,
	ptfLevel: string | null
): string {
	const software = allSoftware.find((s) => s.id === softwareId);
	const match = software?.versions.find(
		(v) => v.version === version && (v.ptf_level || null) === (ptfLevel || null)
	);
	return match?.id ?? '';
}

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await validateMasterDetailForm(request, lparWithSoftwareSchema, ['software_installations']);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check unique code using helper
		const uniqueCheck = await checkUniqueConstraint(db.lpars, 'code', form.data.code, params.id);
		if (uniqueCheck.exists) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: [uniqueCheck.error!] }
				}
			});
		}

		const validated = form.data;

		const existingLpar = await db.lpars.findUnique({
			where: { id: params.id },
			include: { lpar_software: true }
		});
		if (!existingLpar) {
			throw error(404, 'LPAR not found');
		}

		try {
			await db.$transaction(async (tx) => {
				// Update LPAR master data
				await tx.lpars.update({
					where: { id: params.id },
					data: {
						name: validated.name,
						code: validated.code,
						customer_id: validated.customer_id,
						description: validated.description || null,
						current_package_id: validated.current_package_id || null,
						active: validated.active
					}
				});

				const kept = validated.software_installations.filter((inst) => inst._action !== 'delete');
				const keptIds = kept.filter((inst) => inst.id).map((inst) => inst.id as string);

				// Delete installations that were removed or marked for deletion
				const installsToDelete = existingLpar.lpar_software
					.map((ls) => ls.id)
					.filter((id) => !keptIds.includes(id));
				if (installsToDelete.length > 0) {
					await tx.lpar_software.deleteMany({
						where: { id: { in: installsToDelete }, lpar_id: params.id }
					});
				}

				for (const installation of kept) {
					const version = await tx.software_versions.findFirst({
						where: { id: installation.software_version_id, software_id: installation.software_id },
						select: { version: true, ptf_level: true }
					});
					if (!version) {
						throw new Error(`Invalid version ID: ${installation.software_version_id}`);
					}

					const existing = installation.id
						? existingLpar.lpar_software.find((ls) => ls.id === installation.id)
						: undefined;
					const versionChanged =
						existing &&
						(existing.current_version !== version.version ||
							(existing.current_ptf_level || null) !== (version.ptf_level || null));

					const installData = {
						lpar_id: params.id,
						software_id: installation.software_id,
						current_version: version.version,
						current_ptf_level: version.ptf_level,
						installed_date: installation.installed_date,
						// Keep version history and rollback state unless the version actually changed
						...(versionChanged
							? {
									previous_version: existing.current_version,
									previous_ptf_level: existing.current_ptf_level,
									rolled_back: false,
									rolled_back_at: null,
									rollback_reason: null
								}
							: {})
					};

					if (existing) {
						await tx.lpar_software.update({ where: { id: existing.id }, data: installData });
					} else {
						await tx.lpar_software.create({ data: installData });
					}
				}
			});

			await createAuditLog('lpar', params.id, 'update', {
				before: existingLpar,
				after: { ...validated, installations_count: validated.software_installations.length }
			});
		} catch (err) {
			console.error('Error updating LPAR:', err);
			return fail(500, { form, message: 'Failed to update LPAR' });
		}

		redirect(303, '/lpars');
	}
};
