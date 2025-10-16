import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { createCreateAction } from '$lib/server/route-factory';
import { z } from 'zod';

// Schema for package creation (without items initially)
const packageCreateSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z
		.string()
		.min(2, 'Code must be at least 2 characters')
		.max(20)
		.regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	version: z.string().min(1, 'Version is required').max(50),
	description: z.string().max(500).optional(),
	releaseDate: z.coerce.date(),
	active: z.boolean().default(true)
});

export const actions: Actions = {
	default: createCreateAction({
		schema: packageCreateSchema,
		model: db.packages,
		entityType: 'package',
		redirectPath: '/packages/{id}',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			version: formData.get('version'),
			description: formData.get('description') || '',
			releaseDate: formData.get('release_date'),
			active: formData.get('active') === 'on'
		}),
		checkUnique: async (validated) => {
			const existing = await db.packages.findFirst({
				where: {
					code: validated.code,
					version: validated.version
				}
			});
			return existing
				? {
						exists: true,
						field: 'code',
						message: 'A package with this code and version already exists.'
				  }
				: null;
		},
		transformData: (validated) => ({
			name: validated.name,
			code: validated.code,
			version: validated.version,
			description: validated.description || null,
			releaseDate: validated.releaseDate,
			active: validated.active
		})
	})
};
