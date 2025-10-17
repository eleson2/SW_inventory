import type { PageServerLoad, Actions } from './$types';
import { calculateCompatibilityScore } from '$lib/services/package-service';
import { db } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Fetch LPAR from database with all relations
	const lpar = await db.lpars.findUnique({
		where: { id: params.id },
		include: {
			customers: true,
			packages: {
				include: {
					package_items: {
						include: {
							software: true,
							software_version: true
						},
						orderBy: {
							order_index: 'asc'
						}
					}
				}
			},
			lpar_software: {
				include: {
					software: {
						include: {
							vendors: true,
							versions: {
								orderBy: {
									release_date: 'desc'
								}
							}
						}
					}
				}
			}
		}
	});

	if (!lpar) {
		throw error(404, 'LPAR not found');
	}

	// Calculate compatibility score if package is assigned
	let compatibility = 100;
	if (lpar.packages && lpar.packages.package_items) {
		// Simple compatibility calculation based on matching software versions
		const packageSoftwareIds = new Set(lpar.packages.package_items.map(item => item.software_id));
		const installedSoftwareIds = new Set(lpar.lpar_software.map(sw => sw.software_id));

		const matchCount = Array.from(packageSoftwareIds).filter(id => installedSoftwareIds.has(id)).length;
		compatibility = packageSoftwareIds.size > 0
			? Math.round((matchCount / packageSoftwareIds.size) * 100)
			: 100;
	}

	return {
		lpar,
		compatibility
	};
};

export const actions: Actions = {
	rollback: async ({ params, request }) => {
		const lparId = params.id;
		const formData = await request.formData();
		const softwareId = formData.get('software_id')?.toString();
		const targetVersionId = formData.get('target_version_id')?.toString();
		const reason = formData.get('reason')?.toString() || 'User-initiated rollback';

		if (!softwareId) {
			return fail(400, {
				message: 'Software ID is required'
			});
		}

		if (!targetVersionId) {
			return fail(400, {
				message: 'Target version ID is required'
			});
		}

		try {
			// Get the current software installation
			const installation = await db.lpar_software.findUnique({
				where: {
					lpar_id_software_id: {
						lpar_id: lparId,
						software_id: softwareId
					}
				}
			});

			if (!installation) {
				return fail(404, {
					message: 'Software installation not found'
				});
			}

			// Get the target version from software_versions table
			const targetVersion = await db.software_versions.findUnique({
				where: {
					id: targetVersionId
				}
			});

			if (!targetVersion || targetVersion.software_id !== softwareId) {
				return fail(400, {
					message: 'Invalid target version'
				});
			}

			// Check if trying to rollback to the current version
			if (targetVersion.version === installation.current_version &&
			    targetVersion.ptf_level === installation.current_ptf_level) {
				return fail(400, {
					message: 'Cannot rollback to the currently installed version'
				});
			}

			// Perform the rollback by updating to target version
			const currentVersion = installation.current_version;
			const currentPtfLevel = installation.current_ptf_level;

			await db.lpar_software.update({
				where: {
					lpar_id_software_id: {
						lpar_id: lparId,
						software_id: softwareId
					}
				},
				data: {
					current_version: targetVersion.version,
					current_ptf_level: targetVersion.ptf_level,
					previous_version: currentVersion,
					previous_ptf_level: currentPtfLevel,
					rolled_back: true,
					rolled_back_at: new Date(),
					rollback_reason: reason
				}
			});

			// Create audit log
			await db.audit_log.create({
				data: {
					entity_type: 'lpar_software',
					entity_id: lparId,
					action: 'rollback',
					changes: {
						software_id: softwareId,
						from_version: currentVersion,
						from_ptf: currentPtfLevel,
						to_version: targetVersion.version,
						to_ptf: targetVersion.ptf_level,
						reason
					}
				}
			});

			return {
				success: true,
				message: 'Software rolled back successfully'
			};
		} catch (err) {
			console.error('Error rolling back software:', err);
			return fail(500, {
				message: 'Failed to rollback software'
			});
		}
	}
};
