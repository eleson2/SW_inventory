import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { serverValidate } from '$lib/utils/superforms';
import { compareVersions } from '$lib/utils/version-parser';

// Schema for deployment form
const deploymentSchema = z.object({
	lparIds: z.array(z.string()).min(1, 'Select at least one LPAR')
});

export const load: PageServerLoad = async ({ params }) => {
	const packageId = params.id;

	// Validate form with default empty array
	const form = await serverValidate({ lparIds: [] }, deploymentSchema);

	// Get the package with its items
	const pkg = await db.packages.findUnique({
		where: { id: packageId },
		include: {
			package_items: {
				include: {
					software: {
						select: {
							name: true,
							vendor_id: true
						}
					},
					software_version: {
						select: {
							version: true,
							ptf_level: true
						}
					}
				},
				orderBy: { order_index: 'asc' }
			}
		}
	});

	if (!pkg) {
		throw redirect(303, '/packages');
	}

	// Get all active LPARs with their current packages
	const lpars = await db.lpars.findMany({
		where: { active: true },
		include: {
			customers: {
				select: {
					id: true,
					name: true
				}
			},
			packages: {
				select: {
					id: true,
					name: true,
					version: true
				}
			}
		},
		orderBy: { name: 'asc' }
	});

	return {
		form,
		package: pkg,
		lpars
	};
};

export const actions: Actions = {
	// Preview deployment impact for selected LPARs
	preview: async ({ params, request }) => {
		const formData = await request.formData();
		const lparIds = JSON.parse(formData.get('lpar_ids') as string) as string[];

		// Use database function to check impact for each LPAR
		const previews = await Promise.all(
			lparIds.map(async (lparId) => {
				try {
					const impact = await db.$queryRaw<Array<{
						software_id: string;
						software_name: string;
						current_version: string | null;
						current_ptf_level: string | null;
						new_version: string;
						new_ptf_level: string | null;
						change_type: string;
						required: boolean;
					}>>`
						SELECT * FROM check_package_deployment_impact(
							${lparId}::uuid,
							${params.id}::uuid
						)
					`;

					const lpar = await db.lpars.findUnique({
						where: { id: lparId },
						select: { name: true, code: true }
					});

					// Map to expected format for frontend
					const changes = impact
						.filter((item) => item.software_name !== null)
						.map((item) => {
							let action = item.change_type.toLowerCase();

							// Differentiate upgrade vs downgrade using version comparison
							if (action === 'upgrade' && item.current_version && item.new_version) {
								const comparison = compareVersions(item.new_version, item.current_version);
								if (comparison < 0) {
									action = 'downgrade';
								}
							}

							return {
								software_name: item.software_name,
								current_version: item.current_version
									? `${item.current_version}${item.current_ptf_level ? ` (${item.current_ptf_level})` : ''}`
									: null,
								target_version: item.new_version
									? `${item.new_version}${item.new_ptf_level ? ` (${item.new_ptf_level})` : ''}`
									: null,
								action
							};
						});

					return {
						lparId,
						lparName: lpar?.name,
						lparCode: lpar?.code,
						changes
					};
				} catch (error) {
					console.error(`Preview error for LPAR ${lparId}:`, error);
					return {
						lparId,
						lparName: 'Unknown',
						lparCode: 'Unknown',
						changes: []
					};
				}
			})
		);

		return { success: true, previews };
	},

	// Optimized deployment using Prisma batch operations
	deploy: async ({ params, request }) => {
		const formData = await request.formData();
		const lparIds = JSON.parse(formData.get('lpar_ids') as string) as string[];

		console.log('[DEPLOY] Starting deployment for package:', params.id);
		console.log('[DEPLOY] Target LPARs:', lparIds);
		console.time('Total Deployment');

		try {
			// Step 1: Get package items
			console.time('Fetch Package Items');
			const packageItems = await db.package_items.findMany({
				where: { package_id: params.id },
				include: { software_version: true }
			});
			console.timeEnd('Fetch Package Items');
			console.log('[DEPLOY] Package items:', packageItems.length);

			// Step 2: Get current installations for all LPARs (batch query)
			console.time('Fetch Current Installations');
			const currentInstallations = await db.lpar_software.findMany({
				where: {
					lpar_id: { in: lparIds }
				}
			});
			console.timeEnd('Fetch Current Installations');
			console.log('[DEPLOY] Current installations:', currentInstallations.length);

			// Step 3: Build a map for quick lookups
			const installationMap = new Map(
				currentInstallations.map(install => [
					`${install.lpar_id}-${install.software_id}`,
					install
				])
			);

			// Step 4: Prepare batch updates and creates
			const updates: any[] = [];
			const creates: any[] = [];

			console.time('Prepare Batch Operations');
			for (const lparId of lparIds) {
				for (const item of packageItems) {
					const key = `${lparId}-${item.software_id}`;
					const currentInstall = installationMap.get(key);

					if (currentInstall) {
						// Update existing installation
						updates.push({
							where: {
								lpar_id_software_id: {
									lpar_id: lparId,
									software_id: item.software_id
								}
							},
							data: {
								previous_version: currentInstall.current_version,
								previous_ptf_level: currentInstall.current_ptf_level,
								current_version: item.software_version.version,
								current_ptf_level: item.software_version.ptf_level || null,
								installed_date: new Date(),
								rolled_back: false,
								rolled_back_at: null,
								rollback_reason: null
							}
						});
					} else {
						// Create new installation
						creates.push({
							lpar_id: lparId,
							software_id: item.software_id,
							current_version: item.software_version.version,
							current_ptf_level: item.software_version.ptf_level || null,
							installed_date: new Date()
						});
					}
				}
			}
			console.timeEnd('Prepare Batch Operations');
			console.log('[DEPLOY] Operations to create:', creates.length);
			console.log('[DEPLOY] Operations to update:', updates.length);

			// Step 5: Execute ALL database operations in a SINGLE transaction
			console.time('Database Transaction');
			await db.$transaction(async (tx) => {
				// Batch create new installations
				if (creates.length > 0) {
					console.log('[DEPLOY] Creating', creates.length, 'new installations');
					await tx.lpar_software.createMany({
						data: creates,
						skipDuplicates: true
					});
				}

				// Batch update existing installations
				if (updates.length > 0) {
					console.log('[DEPLOY] Updating', updates.length, 'existing installations');
					await Promise.all(
						updates.map(update =>
							tx.lpar_software.update(update)
						)
					);
				}

				// Batch update LPAR package assignments
				console.log('[DEPLOY] Updating LPAR package assignments');
				await tx.lpars.updateMany({
					where: {
						id: { in: lparIds }
					},
					data: {
						current_package_id: params.id,
						updated_at: new Date()
					}
				});
			});
			console.timeEnd('Database Transaction');

			console.timeEnd('Total Deployment');
			console.log('[DEPLOY] Deployment completed successfully');

			return {
				success: true,
				message: `Successfully deployed package to ${lparIds.length} LPAR(s)`,
				results: lparIds.map(id => ({ lparId: id, status: 'success' }))
			};
		} catch (error) {
			console.error('[DEPLOY] Deployment error:', error);
			console.timeEnd('Total Deployment');
			return fail(500, {
				success: false,
				message: error instanceof Error ? error.message : 'Deployment failed',
				results: []
			});
		}
	}
};
