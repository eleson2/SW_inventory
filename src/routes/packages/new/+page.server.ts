import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

// Schema for package creation (without items initially)
const packageCreateSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	version: z.string().min(1, 'Version is required').max(50),
	description: z.string().max(500).optional(),
	releaseDate: z.coerce.date(),
	active: z.boolean().default(true)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			version: formData.get('version'),
			description: formData.get('description') || '',
			releaseDate: formData.get('releaseDate'),
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = packageCreateSchema.parse(data);

			// Check if code+version combination already exists
			const existing = await db.package.findFirst({
				where: {
					code: validated.code,
					version: validated.version
				}
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['Package with this code and version already exists'] },
					message: 'A package with this code and version already exists.'
				});
			}

			// Create package in database
			const pkg = await db.package.create({
				data: {
					name: validated.name,
					code: validated.code,
					version: validated.version,
					description: validated.description || null,
					releaseDate: validated.releaseDate,
					active: validated.active
				}
			});

			// Create audit log
			await createAuditLog('package', pkg.id, 'create', { package: pkg });

			// Redirect to package detail to add items
			throw redirect(303, `/packages/${pkg.id}`);
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
