import type { PageServerLoad } from './$types';
import { calculateCompatibilityScore } from '$lib/services/package-service';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Fetch LPAR from database with all relations
	const lpar = await db.lpar.findUnique({
		where: { id: params.id },
		include: {
			customer: true,
			currentPackage: {
				include: {
					items: {
						include: {
							software: true
						},
						orderBy: {
							orderIndex: 'asc'
						}
					}
				}
			},
			softwareInstalled: {
				include: {
					software: {
						include: {
							vendor: true
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
		softwareInstalled: lpar.softwareInstalled.map(sw => ({
			softwareId: sw.softwareId,
			software: sw.software,
			version: {
				version: sw.currentVersion,
				ptfLevel: sw.currentPtfLevel ?? undefined
			},
			installedDate: sw.installedDate,
			previousVersion: sw.previousVersion ? {
				version: sw.previousVersion,
				ptfLevel: sw.previousPtfLevel ?? undefined
			} : undefined,
			rolledBack: sw.rolledBack
		})),
		currentPackage: lpar.currentPackage ? {
			...lpar.currentPackage,
			items: lpar.currentPackage.items.map(item => ({
				softwareId: item.softwareId,
				software: item.software,
				version: {
					version: item.version,
					ptfLevel: item.ptfLevel ?? undefined
				},
				required: item.required,
				order: item.orderIndex
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
