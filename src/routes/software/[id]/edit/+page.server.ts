import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { softwareWithVersionsSchema } from '$schemas/software';
import { error, fail, redirect } from '@sveltejs/kit';
import { serverValidate } from '$lib/utils/superforms';

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

	// Initialize Superforms with software data (only fields matching schema)
	const form = await serverValidate(
		{
			name: software.name,
			vendor_id: software.vendor_id,
			description: software.description || '',
			active: software.active,
			current_version_id: software.current_version_id || '',
			versions: software.versions.map(v => ({
				id: v.id,
				version: v.version,
				ptf_level: v.ptf_level || '',
				release_date: v.release_date,
				end_of_support: v.end_of_support,
				release_notes: v.release_notes || '',
				is_current: v.is_current
			}))
		},
		softwareWithVersionsSchema
	);

	return {
		form,
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
	default: async (event) => {
		// Use Superforms to validate form data
		const form = await serverValidate(event, softwareWithVersionsSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		const validated = form.data;

		try {
			// Fetch old software for audit
			const oldSoftware = await db.software.findUnique({
				where: { id: event.params.id },
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
								software_id: event.params.id,
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
					where: { id: event.params.id },
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
			await createAuditLog('software', event.params.id, 'update', {
				old: oldSoftware,
				new: updated.software,
				version_changes: updated.versionChanges
			});

			throw redirect(303, '/software');
		} catch (err) {
			console.error('Software update error:', err);

			// Handle Prisma unique constraint violations
			if (err && typeof err === 'object' && 'code' in err) {
				if (err.code === 'P2002') {
					return fail(400, {
						form: {
							...form,
							errors: { ...form.errors, versions: { _errors: ['A version with this combination already exists'] } }
						}
					});
				}
			}

			// Re-throw redirects
			if (err && typeof err === 'object' && 'status' in err && err.status === 303) {
				throw err;
			}

			return fail(500, { form });
		}
	}
};
