import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog, checkUniqueConstraint } from '$lib/server/db';
import { fail, redirect, error } from '@sveltejs/kit';
import { lparWithSoftwareSchema } from '$lib/schemas/lpar';
import { serverValidate } from '$lib/utils/superforms';

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

	// Initialize Superforms with LPAR data
	const form = await serverValidate(
		{
			...lpar,
			description: lpar.description || '',
			current_package_id: lpar.current_package_id || '',
			software_installations: lpar.lpar_software
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
		// Use Superforms to validate form data
		const form = await serverValidate(event, lparWithSoftwareSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check unique code using helper
		const uniqueCheck = await checkUniqueConstraint(db.lpars, 'code', form.data.code, event.params.id);
		if (uniqueCheck.exists) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: [uniqueCheck.error!] } }
				}
			});
		}

		const validated = form.data;

		try {
			// Get existing LPAR for audit
			const existingLpar = await db.lpars.findUnique({
				where: { id: event.params.id },
				include: { lpar_software: true }
			});

			// Use transaction for atomicity
			await db.$transaction(async (tx) => {
				// Update LPAR master data
				await tx.lpars.update({
					where: { id: event.params.id },
					data: {
						name: validated.data.name,
						code: validated.data.code,
						customer_id: validated.data.customer_id,
						description: validated.data.description || null,
						current_package_id: validated.data.current_package_id || null,
						active: validated.data.active
					}
				});

				// Handle software installations
				if (validated.data.software_installations) {
					const existingInstallIds = existingLpar?.lpar_software.map(ls => ls.id) || [];
					const incomingInstallIds = validated.data.software_installations
						.filter(inst => inst.id)
						.map(inst => inst.id) as string[];

					// Delete removed installations
					const installsToDelete = existingInstallIds.filter(id => !incomingInstallIds.includes(id));
					if (installsToDelete.length > 0) {
						await tx.lpar_software.deleteMany({
							where: {
								id: { in: installsToDelete },
								lpar_id: event.params.id
							}
						});
					}

					// Upsert installations
					for (const installation of validated.data.software_installations) {
						if (installation._action === 'delete') continue;

						// Get version details to store denormalized data
						const version = await tx.software_versions.findUnique({
							where: { id: installation.software_version_id },
							select: { version: true, ptf_level: true }
						});

						if (!version) {
							throw new Error(`Invalid version ID: ${installation.software_version_id}`);
						}

						const installData = {
							lpar_id: event.params.id,
							software_id: installation.software_id,
							current_version: version.version,
							current_ptf_level: version.ptf_level,
							installed_date: installation.installed_date,
							rolled_back: false
						};

						if (installation.id) {
							// Update existing
							await tx.lpar_software.update({
								where: { id: installation.id },
								data: installData
							});
						} else {
							// Create new
							await tx.lpar_software.create({
								data: installData
							});
						}
					}
				}

				// Create audit log
				await createAuditLog(
					'lpar',
					event.params.id,
					'update',
					{
						before: existingLpar,
						after: {
							...validated,
							installations_count: validated.software_installations?.length || 0
						}
					}
				);
			});

			throw redirect(303, '/lpars');
		} catch (err) {
			if (err instanceof Error && err.message.includes('redirect')) {
				throw err;
			}

			console.error('Error updating LPAR:', err);
			return fail(500, { form });
		}
	}
};
