import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { packageWithItemsSchema } from '$lib/schemas/package';

// Load all packages for clone dropdown and all software for PackageItemsManager
export const load: PageServerLoad = async () => {
	const [allPackages, allSoftware] = await Promise.all([
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
		})
	]);

	return {
		allPackages,
		allSoftware
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		// Parse the form data
		const rawData = {
			name: formData.get('name')?.toString(),
			code: formData.get('code')?.toString().toUpperCase(),
			version: formData.get('version')?.toString(),
			description: formData.get('description')?.toString() || '',
			release_date: formData.get('release_date')?.toString(),
			active: formData.get('active') === 'on',
			items: JSON.parse(formData.get('items')?.toString() || '[]')
		};

		// Validate with Zod schema
		const validated = packageWithItemsSchema.safeParse({
			name: rawData.name,
			code: rawData.code,
			version: rawData.version,
			description: rawData.description,
			release_date: new Date(rawData.release_date || ''),
			active: rawData.active,
			items: rawData.items
		});

		if (!validated.success) {
			return fail(400, {
				errors: validated.error.flatten().fieldErrors,
				message: 'Validation failed'
			});
		}

		// Check for unique code+version combination
		const existing = await db.packages.findFirst({
			where: {
				code: validated.data.code,
				version: validated.data.version
			}
		});

		if (existing) {
			return fail(400, {
				errors: { code: ['A package with this code and version already exists.'] },
				message: 'Validation failed'
			});
		}

		// Validate unique order_index values if items provided
		if (validated.data.items && validated.data.items.length > 0) {
			const orderIndices = validated.data.items.map(item => item.order_index);
			const uniqueOrderIndices = new Set(orderIndices);
			if (orderIndices.length !== uniqueOrderIndices.size) {
				return fail(400, {
					errors: { items: ['Order indices must be unique'] },
					message: 'Validation failed'
				});
			}
		}

		try {
			// Use transaction to create package and items atomically
			const newPackage = await db.$transaction(async (tx) => {
				// Create package master data
				const pkg = await tx.packages.create({
					data: {
						name: validated.data.name,
						code: validated.data.code,
						version: validated.data.version,
						description: validated.data.description || null,
						release_date: validated.data.release_date,
						active: validated.data.active
					}
				});

				// Create package items if provided
				if (validated.data.items && validated.data.items.length > 0) {
					for (const item of validated.data.items) {
						await tx.package_items.create({
							data: {
								package_id: pkg.id,
								software_id: item.software_id,
								software_version_id: item.software_version_id,
								required: item.required,
								order_index: item.order_index
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
						items_count: validated.data.items?.length || 0
					}
				);

				return pkg;
			});

			throw redirect(303, `/packages/${newPackage.id}`);
		} catch (err) {
			if (err instanceof Error && err.message.includes('redirect')) {
				throw err;
			}

			console.error('Error creating package:', err);
			return fail(500, {
				message: 'Failed to create package. Please try again.'
			});
		}
	}
};
