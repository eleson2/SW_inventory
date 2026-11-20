import type { PageServerLoad, Actions } from './$types';
import { error, redirect, fail } from '@sveltejs/kit';
import { db, createAuditLog } from '#lib/server/db.ts';
import { packageUpdateSchema } from '#lib/schemas/package.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import { validateMasterDetailForm } from '#lib/server/master-detail-form.ts';

/**
 * Load package with items, plus all software and their versions for dropdowns
 */
export const load: PageServerLoad = async ({ params }) => {
	const pkg = await db.packages.findUnique({
		where: { id: params.id },
		include: {
			package_items: {
				include: {
					software: {
						include: {
							vendors: true
						}
					},
					software_version: true
				},
				orderBy: {
					order_index: 'asc'
				}
			}
		}
	});

	if (!pkg) {
		throw error(404, 'Package not found');
	}

	// Load all active software with their versions for the dropdowns
	const allSoftware = await db.software.findMany({
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
	});

	// Initialize Superforms with package data (only fields matching schema)
	const form = await serverValidate(
		{
			name: pkg.name,
			code: pkg.code,
			version: pkg.version,
			description: pkg.description || '',
			release_date: pkg.release_date,
			active: pkg.active,
			items: pkg.package_items.map(item => ({
				id: item.id,
				software_id: item.software_id,
				software_version_id: item.software_version_id,
				order_index: item.order_index,
				_action: 'keep' as const
			}))
		},
		packageUpdateSchema
	);

	return {
		form,
		package: pkg,
		allSoftware
	};
};

/**
 * Update package with items atomically using transaction
 */
export const actions: Actions = {
	default: async (event) => {
		// Use Superforms to validate form data
		const form = await validateMasterDetailForm(event.request, packageUpdateSchema);

		if (!form.valid) {
			return fail(400, { form, message: 'Please correct the errors below' });
		}

		const validated = form.data;

		// Check for unique code+version combination (composite constraint)
		const existing = await db.packages.findFirst({
			where: {
				code: validated.code,
				version: validated.version,
				id: { not: event.params.id }
			}
		});

		if (existing) {
			const msg = 'A package with this code and version already exists.';
			return fail(400, { form: { ...form, errors: { ...form.errors, code: [msg] } }, message: msg });
		}

		// Items marked for deletion still carry their id; only the rest are kept
		const keptItems = validated.items?.filter((item) => item._action !== 'delete');

		// Validate unique order_index values
		const orderIndices = keptItems?.map((item) => item.order_index) ?? [];
		if (orderIndices.length !== new Set(orderIndices).size) {
			return fail(400, { form, message: 'Order indices must be unique' });
		}

		try {
			// Get existing package items to track changes
			const existingPackage = await db.packages.findUnique({
				where: { id: event.params.id },
				include: { package_items: true }
			});

			// Use transaction to ensure atomicity
			await db.$transaction(async (tx) => {
				// Update package master data
				await tx.packages.update({
					where: { id: event.params.id },
					data: {
						name: validated.name,
						code: validated.code,
						version: validated.version,
						description: validated.description || null,
						release_date: validated.release_date,
						active: validated.active
					}
				});

				// Handle package items if provided
				if (keptItems) {
					const keptIds = new Set(keptItems.flatMap((item) => (item.id ? [item.id] : [])));

					// Delete items that were removed or marked for deletion
					const itemsToDelete = (existingPackage?.package_items ?? [])
						.map((item) => item.id)
						.filter((id) => !keptIds.has(id));
					if (itemsToDelete.length > 0) {
						await tx.package_items.deleteMany({
							where: {
								id: { in: itemsToDelete },
								package_id: event.params.id
							}
						});
					}

					// Upsert kept items (create new, update existing)
					for (const item of keptItems) {
						const itemData = {
							package_id: event.params.id,
							software_id: item.software_id,
							software_version_id: item.software_version_id,
							order_index: item.order_index
						};

						if (item.id) {
							// Update existing item
							await tx.package_items.update({
								where: { id: item.id },
								data: itemData
							});
						} else {
							// Create new item
							await tx.package_items.create({
								data: itemData
							});
						}
					}
				}

				// Create audit log
				await createAuditLog(
					'package',
					event.params.id,
					'update',
					{
						before: existingPackage,
						after: {
							...validated,
							items_count: validated.items?.length || 0
						}
					}
				);
			});
		} catch (err) {
			console.error('Error updating package:', err);
			return fail(500, { form, message: 'Failed to update package' });
		}

		redirect(303, '/packages');
	}
};
