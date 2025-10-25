import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect, error } from '@sveltejs/kit';
import { lparWithSoftwareSchema } from '$lib/schemas/lpar';

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

	return {
		lpar,
		customers,
		packages,
		allSoftware
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();

		const rawData = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			customer_id: formData.get('customer_id'),
			description: formData.get('description') || '',
			current_package_id: formData.get('current_package_id') || '',
			active: formData.get('active') === 'on',
			software_installations: JSON.parse(formData.get('software_installations')?.toString() || '[]')
		};

		// Validate
		const validated = lparWithSoftwareSchema.safeParse(rawData);
		if (!validated.success) {
			return fail(400, {
				errors: validated.error.flatten().fieldErrors,
				message: 'Validation failed'
			});
		}

		// Check unique code
		const existing = await db.lpars.findFirst({
			where: {
				code: validated.data.code,
				id: { not: params.id }
			}
		});

		if (existing) {
			return fail(400, {
				errors: { code: ['An LPAR with this code already exists.'] },
				message: 'Validation failed'
			});
		}

		try {
			// Get existing LPAR for audit
			const existingLpar = await db.lpars.findUnique({
				where: { id: params.id },
				include: { lpar_software: true }
			});

			// Use transaction for atomicity
			await db.$transaction(async (tx) => {
				// Update LPAR master data
				await tx.lpars.update({
					where: { id: params.id },
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
								lpar_id: params.id
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
							lpar_id: params.id,
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
					params.id,
					'update',
					{
						before: existingLpar,
						after: {
							...validated.data,
							installations_count: validated.data.software_installations?.length || 0
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
			return fail(500, {
				message: 'Failed to update LPAR. Please try again.'
			});
		}
	}
};
