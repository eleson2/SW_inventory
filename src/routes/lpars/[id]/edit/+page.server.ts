import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { createEditLoader, createUpdateAction } from '$lib/server/route-factory';
import { z } from 'zod';

const lparUpdateSchema = z.object({
	name: z.string().min(2).max(100),
	code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/),
	customer_id: z.string().uuid(),
	description: z.string().max(500).optional(),
	current_package_id: z.string().uuid().optional().or(z.literal('')),
	active: z.boolean()
});

export const load: PageServerLoad = createEditLoader({
	model: db.lpars,
	entityName: 'LPAR',
	additionalData: async () => {
		const [customers, packages] = await Promise.all([
			db.customers.findMany({
				where: { active: true },
				orderBy: { name: 'asc' },
				select: { id: true, name: true, code: true }
			}),
			db.packages.findMany({
				where: { active: true },
				orderBy: { release_date: 'desc' },
				select: { id: true, name: true, code: true, version: true }
			})
		]);
		return { customers, packages };
	}
});

export const actions: Actions = {
	default: createUpdateAction({
		schema: lparUpdateSchema,
		model: db.lpars,
		entityType: 'lpar',
		redirectPath: '/lpars/{id}',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			customer_id: formData.get('customer_id'),
			description: formData.get('description') || '',
			current_package_id: formData.get('current_package_id') || '',
			active: formData.get('active') === 'on'
		}),
		checkUnique: async (validated, id) => {
			const existing = await db.lpars.findFirst({
				where: {
					code: validated.code,
					id: { not: id }
				}
			});
			return existing
				? {
						exists: true,
						field: 'code',
						message: 'An LPAR with this code already exists.'
				  }
				: null;
		},
		transformData: (validated) => ({
			name: validated.name,
			code: validated.code,
			customer_id: validated.customer_id,
			description: validated.description || null,
			current_package_id: validated.current_package_id || null,
			active: validated.active
		})
	})
};
