import type { PageServerLoad, Actions } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { packageUpdateSchema } from '$lib/schemas/package';

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

	return {
		package: pkg,
		allSoftware
	};
};

/**
 * Update package with items atomically using transaction
 */
export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();

		// Parse the form data
		const rawData = {
			name: formData.get('name')?.toString(),
			code: formData.get('code')?.toString().toUpperCase(),
			version: formData.get('version')?.toString(),
			description: formData.get('description')?.toString() || '',
			release_date: formData.get('release_date')?.toString(),
			active: formData.get('active') === 'true',
			items: JSON.parse(formData.get('items')?.toString() || '[]')
		};

		// Validate with Zod schema
		const validated = packageUpdateSchema.safeParse({
			name: rawData.name,
			code: rawData.code,
			version: rawData.version,
			description: rawData.description,
			release_date: new Date(rawData.release_date || ''),
			active: rawData.active,
			items: rawData.items
		});

		if (!validated.success) {
			return {
				success: false,
				errors: validated.error.flatten().fieldErrors,
				message: 'Validation failed'
			};
		}

		// Check for unique code+version combination
		const existing = await db.packages.findFirst({
			where: {
				code: validated.data.code,
				version: validated.data.version,
				id: { not: params.id }
			}
		});

		if (existing) {
			return {
				success: false,
				errors: { code: { _errors: ['A package with this code and version already exists.'] } },
				message: 'Validation failed'
			};
		}

		// Validate unique order_index values
		const orderIndices = validated.data.items?.map(item => item.order_index) || [];
		const uniqueOrderIndices = new Set(orderIndices);
		if (orderIndices.length !== uniqueOrderIndices.size) {
			return {
				success: false,
				errors: { items: { _errors: ['Order indices must be unique'] } },
				message: 'Validation failed'
			};
		}

		try {
			// Get existing package items to track changes
			const existingPackage = await db.packages.findUnique({
				where: { id: params.id },
				include: { package_items: true }
			});

			// Use transaction to ensure atomicity
			await db.$transaction(async (tx) => {
				// Update package master data
				await tx.packages.update({
					where: { id: params.id },
					data: {
						name: validated.data.name,
						code: validated.data.code,
						version: validated.data.version,
						description: validated.data.description || null,
						release_date: validated.data.release_date,
						active: validated.data.active
					}
				});

				// Handle package items if provided
				if (validated.data.items && validated.data.items.length > 0) {
					const existingItemIds = existingPackage?.package_items.map(item => item.id) || [];
					const incomingItemIds = validated.data.items
						.filter(item => item.id)
						.map(item => item.id) as string[];

					// Delete items that are not in the incoming list
					const itemsToDelete = existingItemIds.filter(id => !incomingItemIds.includes(id));
					if (itemsToDelete.length > 0) {
						await tx.package_items.deleteMany({
							where: {
								id: { in: itemsToDelete },
								package_id: params.id
							}
						});
					}

					// Upsert all items (create new, update existing)
					for (const item of validated.data.items) {
						if (item._action === 'delete') continue;

						const itemData = {
							package_id: params.id,
							software_id: item.software_id,
							software_version_id: item.software_version_id,
							required: item.required,
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
					params.id,
					'update',
					{
						before: existingPackage,
						after: {
							...validated.data,
							items_count: validated.data.items?.length || 0
						}
					}
				);
			});

			throw redirect(303, '/packages');
		} catch (err) {
			if (err instanceof Error && err.message.includes('redirect')) {
				throw err;
			}

			console.error('Error updating package:', err);
			return {
				success: false,
				message: 'Failed to update package. Please try again.'
			};
		}
	}
};
