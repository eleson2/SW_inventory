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
							vendors: true
						}
					}
				}
			}
		}
	});

	if (!lpar) {
		throw error(404, 'LPAR not found');
	}

	// Transform data to match TypeScript types
	// Convert Prisma format to application format
	const transformedLpar = {
		...lpar,
		softwareInstalled: lpar.lpar_software.map(sw => ({
			softwareId: sw.software_id,
			software: sw.software,
			version: {
				version: sw.current_version,
				ptfLevel: sw.current_ptf_level ?? undefined
			},
			installedDate: sw.installed_date,
			previousVersion: sw.previous_version ? {
				version: sw.previous_version,
				ptfLevel: sw.previous_ptf_level ?? undefined
			} : undefined,
			rolledBack: sw.rolled_back
		})),
		currentPackage: lpar.packages ? {
			...lpar.packages,
			items: lpar.packages.package_items.map(item => ({
				softwareId: item.software_id,
				software: item.software,
				version: {
					version: item.software_version.version,
					ptfLevel: item.software_version.ptf_level ?? undefined
				},
				required: item.required,
				order: item.order_index
			}))
		} : undefined
	};

	// Calculate compatibility score if package is assigned
	let compatibility = 100;
	if (transformedLpar.currentPackage) {
		compatibility = calculateCompatibilityScore(transformedLpar as any, transformedLpar.currentPackage as any);
	}

	return {
		lpar: transformedLpar,
		compatibility
	};
};

export const actions: Actions = {
	rollback: async ({ params, request }) => {
		const lparId = params.id;
		const formData = await request.formData();
		const softwareId = formData.get('software_id')?.toString();
		const reason = formData.get('reason')?.toString() || 'User-initiated rollback';

		if (!softwareId) {
			return fail(400, {
				message: 'Software ID is required'
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

			if (!installation.previous_version) {
				return fail(400, {
					message: 'No previous version available to rollback to'
				});
			}

			if (installation.rolled_back) {
				return fail(400, {
					message: 'This software has already been rolled back'
				});
			}

			// Perform the rollback by swapping current and previous versions
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
					current_version: installation.previous_version,
					current_ptf_level: installation.previous_ptf_level,
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
						to_version: installation.previous_version,
						to_ptf: installation.previous_ptf_level,
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
