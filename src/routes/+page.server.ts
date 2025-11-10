import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Fetch counts for each module
	const [
		vendorCount,
		customerCount,
		softwareCount,
		packageCount,
		lparCount,
		// Recent activity
		recentDeployments,
		recentRollbacks,
		// Alerts
		endOfSupportSoftware
	] = await Promise.all([
		// Counts
		db.vendors.count({ where: { active: true } }),
		db.customers.count({ where: { active: true } }),
		db.software.count({ where: { active: true } }),
		db.packages.count({ where: { active: true } }),
		db.lpars.count({ where: { active: true } }),

		// Recent deployments (from audit log)
		db.audit_log.findMany({
			where: {
				entity_type: 'package',
				action: 'deploy'
			},
			orderBy: { timestamp: 'desc' },
			take: 5,
			select: {
				id: true,
				entity_id: true,
				action: true,
				timestamp: true,
				changes: true
			}
		}),

		// Recent rollbacks (from lpar_software with rollback flags)
		db.lpar_software.findMany({
			where: {
				rolled_back: true
			},
			orderBy: { rolled_back_at: 'desc' },
			take: 5,
			include: {
				lpars: {
					select: {
						id: true,
						name: true,
						code: true
					}
				},
				software: {
					select: {
						id: true,
						name: true
					}
				}
			}
		}),

		// Software versions nearing end of support (within 90 days)
		db.software_versions.findMany({
			where: {
				end_of_support: {
					gte: new Date(),
					lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
				},
				is_current: true // Only current versions
			},
			include: {
				software: {
					select: {
						id: true,
						name: true
					}
				}
			},
			orderBy: { end_of_support: 'asc' },
			take: 5
		})
	]);

	return {
		stats: {
			vendors: vendorCount,
			customers: customerCount,
			software: softwareCount,
			packages: packageCount,
			lpars: lparCount
		},
		recentActivity: {
			deployments: recentDeployments,
			rollbacks: recentRollbacks
		},
		alerts: {
			endOfSupport: endOfSupportSoftware
		}
	};
};
