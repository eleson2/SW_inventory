import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get package details with items
	const pkg = await db.packages.findUnique({
		where: { id: params.id },
		include: {
			package_items: {
				include: {
					software: true,
					software_version: true
				},
				orderBy: { order_index: 'asc' }
			}
		}
	});

	if (!pkg) {
		throw error(404, 'Package not found');
	}

	// Get all LPARs with their current package and customer info
	const lpars = await db.lpars.findMany({
		where: { active: true },
		include: {
			customers: {
				select: { id: true, name: true, code: true }
			},
			packages: {
				select: { id: true, name: true, code: true, version: true }
			},
			lpar_software: {
				include: {
					software: true
				}
			}
		},
		orderBy: [{ customers: { name: 'asc' } }, { name: 'asc' }]
	});

	// Enrich LPARs with deployment status
	const lparsWithStatus = lpars.map((lpar) => {
		const isCompliant = lpar.current_package_id === pkg.id;

		// Calculate changes needed
		let changesNeeded = 0;
		let newInstalls = 0;

		pkg.package_items.forEach((item) => {
			const currentInstall = lpar.lpar_software.find(
				(ls) => ls.software_id === item.software_id
			);

			if (!currentInstall) {
				newInstalls++;
			} else {
				// Compare version strings instead of IDs
				const targetVersion = item.software_version.version;
				const targetPtf = item.software_version.ptf_level || null;
				const currentVersion = currentInstall.current_version;
				const currentPtf = currentInstall.current_ptf_level || null;

				if (currentVersion !== targetVersion || currentPtf !== targetPtf) {
					changesNeeded++;
				}
			}
		});

		return {
			id: lpar.id,
			name: lpar.name,
			code: lpar.code,
			customer: lpar.customers,
			currentPackage: lpar.packages,
			isCompliant,
			changesNeeded,
			newInstalls,
			status: isCompliant ? 'compliant' : changesNeeded + newInstalls > 0 ? 'needs_update' : 'unknown'
		};
	});

	return {
		package: pkg,
		lpars: lparsWithStatus
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
				const changes = impact.map((item) => ({
					software_name: item.software_name,
					current_version: item.current_version
						? `${item.current_version}${item.current_ptf_level ? ` (${item.current_ptf_level})` : ''}`
						: null,
					target_version: `${item.new_version}${item.new_ptf_level ? ` (${item.new_ptf_level})` : ''}`,
					action: item.change_type
				}));

				return {
					lparId,
					lparName: lpar?.name,
					lparCode: lpar?.code,
					changes
				};
			})
		);

		return { success: true, previews };
	},

	// Deploy package to selected LPARs
	deploy: async ({ params, request }) => {
		const formData = await request.formData();
		const lparIds = JSON.parse(formData.get('lpar_ids') as string) as string[];
		const deploymentMode = formData.get('deployment_mode') as string; // 'sequential' | 'parallel'
		const stopOnError = formData.get('stop_on_error') === 'true';

		// Get package items
		const packageItems = await db.package_items.findMany({
			where: { package_id: params.id },
			include: { software_version: true }
		});

		const results = [];

		// Deployment logic
		for (const lparId of lparIds) {
			try {
				// Update each software installation
				for (const item of packageItems) {
					const currentInstall = await db.lpar_software.findUnique({
						where: {
							lpar_id_software_id: {
								lpar_id: lparId,
								software_id: item.software_id
							}
						}
					});

					await db.lpar_software.upsert({
						where: {
							lpar_id_software_id: {
								lpar_id: lparId,
								software_id: item.software_id
							}
						},
						update: {
							previous_version: currentInstall?.current_version || null,
							previous_ptf_level: currentInstall?.current_ptf_level || null,
							current_version: item.software_version.version,
							current_ptf_level: item.software_version.ptf_level || null,
							installed_date: new Date(),
							rolled_back: false,
							rolled_back_at: null,
							rollback_reason: null
						},
						create: {
							lpar_id: lparId,
							software_id: item.software_id,
							current_version: item.software_version.version,
							current_ptf_level: item.software_version.ptf_level || null,
							installed_date: new Date()
						}
					});
				}

				// Update LPAR's package assignment
				await db.lpars.update({
					where: { id: lparId },
					data: { current_package_id: params.id }
				});

				// Audit log
				await createAuditLog('lpar', lparId, 'package_applied', {
					package_id: params.id,
					items_updated: packageItems.length,
					deployment_mode: deploymentMode
				});

				results.push({ lparId, status: 'success' });
			} catch (err) {
				console.error(`Error deploying to LPAR ${lparId}:`, err);
				results.push({
					lparId,
					status: 'failed',
					error: err instanceof Error ? err.message : 'Unknown error'
				});

				if (stopOnError) {
					break;
				}
			}
		}

		const successCount = results.filter((r) => r.status === 'success').length;
		const failCount = results.filter((r) => r.status === 'failed').length;

		if (failCount === 0) {
			return {
				success: true,
				message: `Successfully deployed package to ${successCount} LPAR(s)`,
				results
			};
		} else {
			return fail(400, {
				success: false,
				message: `Deployed to ${successCount} LPAR(s), ${failCount} failed`,
				results
			});
		}
	}
};
