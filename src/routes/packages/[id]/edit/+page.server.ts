import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params }) => {
	const pkg = await db.package.findUnique({
		where: { id: params.id }
	});

	if (!pkg) {
		throw error(404, 'Package not found');
	}

	return {
		package: pkg
	};
};

const packageUpdateSchema = z.object({
	name: z.string().min(2).max(100),
	code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/),
	version: z.string().min(1).max(50),
	description: z.string().max(500).optional(),
	releaseDate: z.coerce.date(),
	active: z.boolean()
});

export const actions: Actions = {
	default: async ({ request, params }) => {
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
			const validated = packageUpdateSchema.parse(data);

			// Check for duplicate code+version (excluding current)
			const existing = await db.package.findFirst({
				where: {
					code: validated.code,
					version: validated.version,
					id: { not: params.id }
				}
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['Package with this code and version already exists'] },
					message: 'A package with this code and version already exists.'
				});
			}

			const oldPackage = await db.package.findUnique({
				where: { id: params.id }
			});

			const pkg = await db.package.update({
				where: { id: params.id },
				data: {
					name: validated.name,
					code: validated.code,
					version: validated.version,
					description: validated.description || null,
					releaseDate: validated.releaseDate,
					active: validated.active
				}
			});

			await createAuditLog('package', pkg.id, 'update', {
				old: oldPackage,
				new: pkg
			});

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
