import type { PageServerLoad, Actions } from './$types';
import { markInstalled } from '#lib/server/rollouts.ts';
import { db, createAuditLog } from '#lib/server/db.ts';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { serverValidate } from '#lib/utils/superforms.ts';
import { sameVersion } from '#lib/utils/version-parser.ts';
import { Prisma } from '@prisma/client';
import { transactionTimeouts } from '#lib/server/db-dialect.ts';
import { getDeploymentImpact } from '#lib/server/deployment.ts';

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
			},
			lpar_software: {
				select: { software_id: true, current_version: true, current_ptf_level: true }
			}
		},
		orderBy: { name: 'asc' }
	});

	// Compare each LPAR's installed software with the package contents
	const lparsWithStatus = lpars.map(({ lpar_software, ...lpar }) => {
		const installed = new Map(lpar_software.map((ls) => [ls.software_id, ls]));
		let changesNeeded = 0;
		let newInstalls = 0;
		for (const item of pkg.package_items) {
			const current = installed.get(item.software_id);
			if (!current) {
				newInstalls++;
			} else if (
				!sameVersion(item.software_version, { version: current.current_version, ptf_level: current.current_ptf_level })
			) {
				changesNeeded++;
			}
		}
		return {
			...lpar,
			changesNeeded,
			newInstalls,
			isCompliant: changesNeeded === 0 && newInstalls === 0
		};
	});

	return {
		form,
		package: pkg,
		lpars: lparsWithStatus
	};
};

const lparIdsSchema = z.array(z.string().uuid()).min(1);

/** Parse the JSON-encoded lpar_ids field; returns null when missing or invalid */
function parseLparIds(formData: FormData): string[] | null {
	try {
		const parsed = lparIdsSchema.safeParse(JSON.parse(String(formData.get('lpar_ids') ?? '')));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

type DeployResult = { lparId: string; status: 'success' | 'error'; error?: string };

export const actions: Actions = {
	// Preview deployment impact for selected LPARs
	preview: async ({ params, request }) => {
		const lparIds = parseLparIds(await request.formData());
		if (!lparIds) {
			return fail(400, { message: 'Select at least one valid LPAR' });
		}

		const previews = await getDeploymentImpact(params.id, lparIds);
		return { previews };
	},

	// Optimized deployment using Prisma batch operations
	deploy: async ({ params, request }) => {
		const lparIds = parseLparIds(await request.formData());
		if (!lparIds) {
			return fail(400, {
				success: false,
				message: 'Select at least one valid LPAR',
				results: [] as DeployResult[]
			});
		}
		const resultsFor = (status: DeployResult['status'], error?: string): DeployResult[] =>
			lparIds.map((lparId) => ({ lparId, status, error }));

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

			// Step 5: Execute ALL database operations in a SINGLE transaction with Serializable isolation
			console.time('Database Transaction');
			await db.$transaction(
				async (tx) => {
					// Batch create new installations
					if (creates.length > 0) {
						console.log('[DEPLOY] Creating', creates.length, 'new installations');
						// lpar_software rows were read above; the serializable transaction guards against races
						await tx.lpar_software.createMany({ data: creates });
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

					// Lifecycle: installed on these LPARs, their previous package superseded
					await markInstalled(tx, lparIds, params.id);
				},
				{
					isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
					...transactionTimeouts()
				}
			);
			console.timeEnd('Database Transaction');

			console.timeEnd('Total Deployment');
			console.log('[DEPLOY] Deployment completed successfully');

			return {
				success: true,
				message: `Successfully deployed package to ${lparIds.length} LPAR(s)`,
				results: resultsFor('success')
			};
		} catch (error) {
			console.error('[DEPLOY] Deployment error:', error);
			console.timeEnd('Total Deployment');
			const message = error instanceof Error ? error.message : 'Deployment failed';
			return fail(500, {
				success: false,
				message: 'Deployment failed; no LPARs were changed',
				// The deployment runs in a single transaction, so every LPAR failed together
				results: resultsFor('error', message)
			});
		}
	}
};
