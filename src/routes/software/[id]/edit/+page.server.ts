import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { softwareWithVersionsSchema } from '$schemas/software';
import { error, fail, redirect } from '@sveltejs/kit';
import type { z } from 'zod';

/**
 * Load software with all versions for master-detail editing
 */
export const load: PageServerLoad = async ({ params }) => {
	const software = await db.software.findUnique({
		where: { id: params.id },
		include: {
			vendors: true,
			versions: {
				orderBy: [
					{ is_current: 'desc' },
					{ release_date: 'desc' }
				]
			},
			current_version: true
		}
	});

	if (!software) {
		throw error(404, 'Software not found');
	}

	// Load vendors for dropdown
	const vendors = await db.vendors.findMany({
		where: { active: true },
		orderBy: { name: 'asc' },
		select: { id: true, name: true, code: true }
	});

	return {
		software,
		vendors
	};
};

/**
 * Master-detail form actions for software with inline version management
 */
export const actions: Actions = {
	/**
	 * Update software (master) with version management (detail)
	 * Uses Prisma transaction to ensure atomicity
	 */
	default: async ({ request, params }) => {
		const formData = await request.formData();

		// Extract master data
		const masterData = {
			name: formData.get('name'),
			vendor_id: formData.get('vendor_id'),
			description: formData.get('description') || '',
			active: formData.get('active') === 'on',
			current_version_id: formData.get('current_version_id') || null,
			versions: [] as any[]
		};

		// Extract version detail data (versions are sent as JSON)
		const versionsJson = formData.get('versions');
		if (versionsJson && typeof versionsJson === 'string') {
			try {
				masterData.versions = JSON.parse(versionsJson);
			} catch (e) {
				return fail(400, {
					message: 'Invalid version data format'
				});
			}
		}

		// Validate entire master-detail structure
		const result = softwareWithVersionsSchema.safeParse(masterData);
		if (!result.success) {
			const errors = result.error.flatten().fieldErrors;
			return fail(400, {
				errors: errors as Record<string, string[]>,
				message: 'Validation failed. Please check the form.'
			});
		}

		const validated = result.data;

		try {
			// Fetch old software for audit
			const oldSoftware = await db.software.findUnique({
				where: { id: params.id },
				include: { versions: true }
			});

			// Execute master-detail update in transaction
			const updated = await db.$transaction(async (tx) => {
				// Process version changes
				const versionChanges = {
					created: [] as string[],
					updated: [] as string[],
					deleted: [] as string[]
				};

				// Track which version should be current
				let currentVersionId = validated.current_version_id;

				for (const version of validated.versions) {
					if (version._action === 'delete' && version.id) {
						// Delete version
						await tx.software_versions.delete({
							where: { id: version.id }
						});
						versionChanges.deleted.push(version.id);
					} else if (version.id) {
						// Update existing version
						await tx.software_versions.update({
							where: { id: version.id },
							data: {
								version: version.version,
								ptf_level: version.ptf_level || null,
								release_date: version.release_date,
								end_of_support: version.end_of_support || null,
								release_notes: version.release_notes || null,
								is_current: version.is_current
							}
						});
						versionChanges.updated.push(version.id);

						// Track current version
						if (version.is_current) {
							currentVersionId = version.id;
						}
					} else {
						// Create new version
						const newVersion = await tx.software_versions.create({
							data: {
								software_id: params.id,
								version: version.version,
								ptf_level: version.ptf_level || null,
								release_date: version.release_date,
								end_of_support: version.end_of_support || null,
								release_notes: version.release_notes || null,
								is_current: version.is_current
							}
						});
						versionChanges.created.push(newVersion.id);

						// Track current version
						if (version.is_current) {
							currentVersionId = newVersion.id;
						}
					}
				}

				// Update master software record
				const updatedSoftware = await tx.software.update({
					where: { id: params.id },
					data: {
						name: validated.name,
						vendor_id: validated.vendor_id,
						description: validated.description || null,
						active: validated.active,
						current_version_id: currentVersionId,
						updated_at: new Date()
					},
					include: {
						versions: true,
						vendors: true,
						current_version: true
					}
				});

				return { software: updatedSoftware, versionChanges };
			});

			// Create audit log
			await createAuditLog('software', params.id, 'update', {
				old: oldSoftware,
				new: updated.software,
				version_changes: updated.versionChanges
			});

			throw redirect(303, `/software/${params.id}`);
		} catch (err) {
			console.error('Software update error:', err);

			// Handle Prisma unique constraint violations
			if (err && typeof err === 'object' && 'code' in err) {
				if (err.code === 'P2002') {
					return fail(400, {
						message: 'A version with this combination already exists',
						errors: {} as Record<string, string[]>
					});
				}
			}

			// Re-throw redirects
			if (err && typeof err === 'object' && 'status' in err && err.status === 303) {
				throw err;
			}

			return fail(500, {
				message: 'Failed to update software. Please try again.',
				errors: {} as Record<string, string[]>
			});
		}
	}
};
