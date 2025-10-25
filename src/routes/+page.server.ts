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
		outOfComplianceLpars,
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

		// LPARs out of compliance (those with software not in assigned package)
		db.$queryRaw<Array<{ lpar_id: string; lpar_name: string; lpar_code: string; mismatch_count: bigint }>>`
			SELECT
				l.id as lpar_id,
				l.name as lpar_name,
				l.code as lpar_code,
				COUNT(*) as mismatch_count
			FROM lpars l
			INNER JOIN lpar_software ls ON ls.lpar_id = l.id
			LEFT JOIN package_items pi ON pi.package_id = l.current_package_id AND pi.software_id = ls.software_id
			WHERE l.active = true
				AND l.current_package_id IS NOT NULL
				AND pi.id IS NULL  -- Software installed but not in assigned package
			GROUP BY l.id, l.name, l.code
			ORDER BY mismatch_count DESC
			LIMIT 5
		`,

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
			outOfCompliance: outOfComplianceLpars.map(item => ({
				lpar_id: item.lpar_id,
				lpar_name: item.lpar_name,
				lpar_code: item.lpar_code,
				mismatch_count: Number(item.mismatch_count)
			})),
			endOfSupport: endOfSupportSoftware
		}
	};
};
