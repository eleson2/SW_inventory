import type { PageServerLoad } from './$types';
import { calculateCompatibilityScore } from '$lib/services/package-service';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

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
