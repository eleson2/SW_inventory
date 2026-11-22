import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog, checkUniqueConstraint } from '#lib/server/db.ts';
import { fail, redirect } from '@sveltejs/kit';
import { packageWithItemsSchema } from '#lib/schemas/package.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import { loadBundlesForPackages } from '#lib/server/bundles.ts';

// Load all packages for clone dropdown and all software for PackageItemsManager
export const load: PageServerLoad = async ({ url }) => {
	// Initialize Superforms with default values
	const form = await serverValidate(
		{ description: '', active: true, items: [] },
		packageWithItemsSchema
	);

	const [allPackages, allSoftware, bundles] = await Promise.all([
		db.packages.findMany({
			where: { active: true },
			include: {
				package_items: {
					include: {
						software: {
							select: {
								name: true
							}
						},
						software_version: {
							select: {
								version: true,
								ptf_level: true
							}
						}
					},
					orderBy: {
						order_index: 'asc'
					}
				}
			},
			orderBy: [{ release_date: 'desc' }, { name: 'asc' }]
		}),
		db.software.findMany({
			where: { active: true },
			include: {
				vendors: true,
				versions: {
					orderBy: [
						{ is_current: 'desc' },
						{ release_date: 'desc' }
					]
				}
			},
			orderBy: { name: 'asc' }
		}),
		loadBundlesForPackages()
	]);

	// /packages/new?bundles=<id>,<id> pre-fills the package from those bundles
	const requested = (url.searchParams.get('bundles') ?? '').split(',').filter(Boolean);
	const preselectedBundleIds = bundles.filter((b) => requested.includes(b.id)).map((b) => b.id);

	return {
		form,
		allPackages,
		allSoftware,
		bundles,
		preselectedBundleIds
	};
};

export const actions: Actions = {
	default: async (event) => {
	// Use Superforms to validate form data
	const form = await serverValidate(event, packageWithItemsSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code+version combination
		const existing = await db.packages.findFirst({
			where: {
				code: form.data.code,
				version: form.data.version
			}
		});

		if (existing) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: ['A package with this code and version already exists.'] } }
				}
			});
		}

		// Validate unique order_index values if items provided
		if (form.data.items && form.data.items.length > 0) {
			const orderIndices = form.data.items.map((item: any) => item.order_index);
			const uniqueOrderIndices = new Set(orderIndices);
			if (orderIndices.length !== uniqueOrderIndices.size) {
				return fail(400, {
					form: {
						...form,
						errors: { ...form.errors, items: { _errors: ['Order indices must be unique'] } }
					}
				});
			}
		}

		try {
			// Use transaction to create package and items atomically
			const newPackage = await db.$transaction(async (tx) => {
				// Create package master data
				const pkg = await tx.packages.create({
					data: {
						name: form.data.name,
						code: form.data.code,
						version: form.data.version,
						description: form.data.description || null,
						release_date: new Date(form.data.release_date),
						active: form.data.active
					}
				});

				// Create package items if provided
				if (form.data.items && form.data.items.length > 0) {
					for (const item of form.data.items) {
						await tx.package_items.create({
							data: {
								package_id: pkg.id,
								software_id: item.software_id,
								software_version_id: item.software_version_id,
								order_index: item.order_index,
								source_bundle_id: item.source_bundle_id ?? null
							}
						});
					}
				}

				// Create audit log
				await createAuditLog(
					'package',
					pkg.id,
					'create',
					{
						...pkg,
						items_count: form.data.items?.length || 0
					}
				);

				return pkg;
			});
		} catch (err) {
			console.error('Error creating package:', err);
			return fail(500, { form });
		}

		// Redirect to packages list
		redirect(303, '/packages');
	}
};
