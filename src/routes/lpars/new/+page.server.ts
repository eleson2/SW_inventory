import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

// Load customers and packages for dropdowns
export const load: PageServerLoad = async () => {
	const [customers, packages] = await Promise.all([
		db.customer.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				code: true
			}
		}),
		db.package.findMany({
			where: { active: true },
			orderBy: { releaseDate: 'desc' },
			select: {
				id: true,
				name: true,
				code: true,
				version: true
			}
		})
	]);

	return {
		customers,
		packages
	};
};

// Schema for LPAR creation
const lparCreateSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	customerId: z.string().uuid('Please select a customer'),
	description: z.string().max(500).optional(),
	currentPackageId: z.string().uuid().optional().or(z.literal('')),
	active: z.boolean().default(true)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			customerId: formData.get('customerId'),
			description: formData.get('description') || '',
			currentPackageId: formData.get('currentPackageId') || '',
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = lparCreateSchema.parse(data);

			// Check if code already exists
			const existing = await db.lpar.findUnique({
				where: { code: validated.code }
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['LPAR code already exists'] },
					message: 'An LPAR with this code already exists.'
				});
			}

			// Create LPAR in database
			const lpar = await db.lpar.create({
				data: {
					name: validated.name,
					code: validated.code,
					customerId: validated.customerId,
					description: validated.description || null,
					currentPackageId: validated.currentPackageId || null,
					active: validated.active
				}
			});

			// Create audit log
			await createAuditLog('lpar', lpar.id, 'create', { lpar });

			// Redirect to LPAR detail
			throw redirect(303, `/lpars/${lpar.id}`);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors = error.flatten().fieldErrors;
				return fail(400, {
					errors,
					message: 'Validation failed. Please check the form.'
				});
			}
			throw error;
		}
	}
};
