import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';
import { z } from 'zod';

// Schema for adding a package item
const packageItemAddSchema = z.object({
	software_id: z.string().uuid('Invalid software ID'),
	software_version_id: z.string().uuid('Invalid version ID'),
	required: z.boolean().default(true),
	order_index: z.coerce.number().int().min(0, 'Order must be a positive number')
});

export const load: PageServerLoad = async ({ params }) => {
	const packageId = params.id;

	// Get package info
	const pkg = await db.packages.findUnique({
		where: { id: packageId },
		select: {
			id: true,
			name: true,
			code: true,
			version: true,
			package_items: {
				select: {
					order_index: true
				},
				orderBy: {
					order_index: 'desc'
				},
				take: 1
			}
		}
	});

	if (!pkg) {
		throw error(404, 'Package not found');
	}

	// Get all software with their versions
	const software = await db.software.findMany({
		where: { active: true },
		include: {
			vendors: true,
			versions: {
				orderBy: [{ is_current: 'desc' }, { release_date: 'desc' }]
			}
		},
		orderBy: { name: 'asc' }
	});

	// Calculate next order index
	const nextOrderIndex = pkg.package_items.length > 0 ? pkg.package_items[0].order_index + 1 : 1;

	return {
		package: pkg,
		software,
		nextOrderIndex
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const packageId = params.id;
		const formData = await request.formData();

		// Extract and validate form data
		const data = {
			software_id: formData.get('software_id'),
			software_version_id: formData.get('software_version_id'),
			required: formData.get('required') === 'on',
			order_index: formData.get('order_index')
		};

		// Validate
		const validation = packageItemAddSchema.safeParse(data);
		if (!validation.success) {
			return fail(400, {
				errors: validation.error.flatten().fieldErrors,
				message: 'Validation failed'
			});
		}

		const validated = validation.data;

		try {
			// Check if this software is already in the package
			const existing = await db.package_items.findFirst({
				where: {
					package_id: packageId,
					software_id: validated.software_id
				}
			});

			if (existing) {
				return fail(400, {
					errors: { software_id: ['This software is already in the package'] },
					message: 'This software is already in the package'
				});
			}

			// Check if order_index is already used
			const orderExists = await db.package_items.findFirst({
				where: {
					package_id: packageId,
					order_index: validated.order_index
				}
			});

			if (orderExists) {
				return fail(400, {
					errors: { order_index: ['This order index is already used'] },
					message: 'This order index is already used'
				});
			}

			// Create the package item
			await db.package_items.create({
				data: {
					package_id: packageId,
					software_id: validated.software_id,
					software_version_id: validated.software_version_id,
					required: validated.required,
					order_index: validated.order_index
				}
			});

			// Create audit log
			await db.audit_log.create({
				data: {
					entity_type: 'package_item',
					entity_id: packageId,
					action: 'create',
					changes: validated
				}
			});
		} catch (err) {
			console.error('Error creating package item:', err);
			return fail(500, {
				message: 'Failed to add software to package'
			});
		}

		throw redirect(303, `/packages/${packageId}`);
	}
};
