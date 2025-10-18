import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { softwareWithVersionsSchema } from '$lib/schemas/software';

// Load vendors and all software for dropdown
export const load: PageServerLoad = async () => {
	const [vendors, allSoftware] = await Promise.all([
		db.vendors.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				code: true
			}
		}),
		db.software.findMany({
			where: { active: true },
			include: {
				vendors: {
					select: {
						name: true,
						code: true
					}
				},
				current_version: {
					select: {
						version: true,
						ptf_level: true,
						release_date: true
					}
				}
			},
			orderBy: { name: 'asc' }
		})
	]);

	return {
		vendors,
		allSoftware
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const data = {
			name: formData.get('name'),
			vendor_id: formData.get('vendor_id'),
			description: formData.get('description') || '',
			active: formData.get('active') === 'on',
			versions: JSON.parse(formData.get('versions')?.toString() || '[]'),
			current_version_id: formData.get('current_version_id')?.toString() || null
		};

		// Validate with master-detail schema
		const validation = softwareWithVersionsSchema.safeParse(data);
		if (!validation.success) {
			return fail(400, {
				errors: validation.error.flatten().fieldErrors,
				message: 'Validation failed'
			});
		}

		const validated = validation.data;

		try {
			// Check if software already exists for this vendor
			const existing = await db.software.findFirst({
				where: {
					vendor_id: validated.vendor_id,
					name: validated.name
				}
			});

			if (existing) {
				return fail(400, {
					errors: { name: ['Software with this name already exists for this vendor'] },
					message: 'Software with this name already exists for this vendor'
				});
			}

			// Create software and versions in a transaction
			const result = await db.$transaction(async (tx) => {
				// Create the software first
				const software = await tx.software.create({
					data: {
						name: validated.name,
						vendor_id: validated.vendor_id,
						description: validated.description || null,
						active: validated.active
					}
				});

				let currentVersionId: string | null = null;

				// Create versions if provided
				if (validated.versions && validated.versions.length > 0) {
					for (const versionData of validated.versions) {
						const version = await tx.software_versions.create({
							data: {
								software_id: software.id,
								version: versionData.version,
								ptf_level: versionData.ptf_level || null,
								release_date: versionData.release_date,
								end_of_support: versionData.end_of_support || null,
								release_notes: versionData.release_notes || null,
								is_current: versionData.is_current
							}
						});

						// Track the current version ID
						if (versionData.is_current) {
							currentVersionId = version.id;
						}
					}
				}

				// Update software with current_version_id if set
				if (currentVersionId) {
					await tx.software.update({
						where: { id: software.id },
						data: { current_version_id: currentVersionId }
					});
				}

				// Create audit log
				await createAuditLog(
					'software',
					software.id,
					'create',
					{
						...software,
						versions_count: validated.versions?.length || 0
					}
				);

				return software;
			});

			throw redirect(303, `/software/${result.id}`);
		} catch (error) {
			if (error instanceof Response) throw error;

			console.error('Error creating software:', error);
			return fail(500, {
				message: 'Failed to create software'
			});
		}
	}
};
