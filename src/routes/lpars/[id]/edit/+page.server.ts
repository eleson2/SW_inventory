import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params }) => {
	const [lpar, customers, packages] = await Promise.all([
		db.lpar.findUnique({
			where: { id: params.id }
		}),
		db.customer.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, code: true }
		}),
		db.package.findMany({
			where: { active: true },
			orderBy: { releaseDate: 'desc' },
			select: { id: true, name: true, code: true, version: true }
		})
	]);

	if (!lpar) {
		throw error(404, 'LPAR not found');
	}

	return {
		lpar,
		customers,
		packages
	};
};

const lparUpdateSchema = z.object({
	name: z.string().min(2).max(100),
	code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/),
	customerId: z.string().uuid(),
	description: z.string().max(500).optional(),
	currentPackageId: z.string().uuid().optional().or(z.literal('')),
	active: z.boolean()
});

export const actions: Actions = {
	default: async ({ request, params }) => {
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
			const validated = lparUpdateSchema.parse(data);

			// Check for duplicate code (excluding current)
			const existing = await db.lpar.findFirst({
				where: {
					code: validated.code,
					id: { not: params.id }
				}
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['LPAR code already exists'] },
					message: 'An LPAR with this code already exists.'
				});
			}

			const oldLpar = await db.lpar.findUnique({
				where: { id: params.id }
			});

			const lpar = await db.lpar.update({
				where: { id: params.id },
				data: {
					name: validated.name,
					code: validated.code,
					customerId: validated.customerId,
					description: validated.description || null,
					currentPackageId: validated.currentPackageId || null,
					active: validated.active
				}
			});

			await createAuditLog('lpar', lpar.id, 'update', {
				old: oldLpar,
				new: lpar
			});

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
