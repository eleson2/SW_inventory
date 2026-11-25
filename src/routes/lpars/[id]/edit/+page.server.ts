import type { PageServerLoad, Actions } from './$types';
import { markInstalled } from '#lib/server/rollouts.ts';
import { db, createAuditLog, checkUniqueConstraint } from '#lib/server/db.ts';
import { fail, redirect, error } from '@sveltejs/kit';
import { lparWithSoftwareSchema } from '#lib/schemas/lpar.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import { message, setError } from 'sveltekit-superforms';
import { findVersionId, sameVersion } from '#lib/utils/version-parser.ts';

export const load: PageServerLoad = async ({ params }) => {
	const [lpar, customers, packages, allSoftware] = await Promise.all([
		db.lpars.findUnique({
			where: { id: params.id },
			include: {
				customers: { select: { name: true } },
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

	const softwareById = new Map(allSoftware.map((s) => [s.id, s]));

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
				software_version_id: findVersionId(softwareById, ls),
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

export const actions: Actions = {
	default: async (event) => {
		const { params } = event;
		const form = await serverValidate(event, lparWithSoftwareSchema);
		if (!form.valid) {
			return fail(400, { form });
		}

		const validated = form.data;
		const kept = validated.software_installations.filter((inst) => inst._action !== 'delete');

		const [uniqueCheck, existingLpar, versions] = await Promise.all([
			checkUniqueConstraint(db.lpars, 'code', validated.code, params.id),
			db.lpars.findUnique({ where: { id: params.id }, include: { lpar_software: true } }),
			db.software_versions.findMany({
				where: { id: { in: kept.map((inst) => inst.software_version_id) } },
				select: { id: true, software_id: true, version: true, ptf_level: true }
			})
		]);

		if (!existingLpar) {
			throw error(404, 'LPAR not found');
		}
		if (uniqueCheck.exists) {
			return setError(form, 'code', uniqueCheck.error!);
		}

		const versionById = new Map(versions.map((v) => [v.id, v]));
		if (kept.some((inst) => versionById.get(inst.software_version_id)?.software_id !== inst.software_id)) {
			return message(form, 'One or more installations reference an invalid version', { status: 400 });
		}

		const existingById = new Map(existingLpar.lpar_software.map((ls) => [ls.id, ls]));
		const keptIds = new Set(kept.flatMap((inst) => (inst.id ? [inst.id] : [])));
		const installsToDelete = existingLpar.lpar_software.map((ls) => ls.id).filter((id) => !keptIds.has(id));

		try {
			await db.$transaction(async (tx) => {
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
				// Lifecycle: a newly assigned package counts as installed
				if (validated.current_package_id && validated.current_package_id !== existingLpar.current_package_id) {
					await markInstalled(tx, [params.id], validated.current_package_id);
				}

				// Delete installations that were removed or marked for deletion
				if (installsToDelete.length > 0) {
					await tx.lpar_software.deleteMany({
						where: { id: { in: installsToDelete }, lpar_id: params.id }
					});
				}

				for (const installation of kept) {
					const version = versionById.get(installation.software_version_id)!;
					const existing = installation.id ? existingById.get(installation.id) : undefined;
					const versionChanged =
						existing &&
						!sameVersion(version, { version: existing.current_version, ptf_level: existing.current_ptf_level });

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
			return message(form, 'Failed to update LPAR', { status: 500 });
		}

		redirect(303, '/lpars');
	}
};
