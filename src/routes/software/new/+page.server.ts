import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

// Load vendors for dropdown
export const load: PageServerLoad = async () => {
	const vendors = await db.vendor.findMany({
		where: { active: true },
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			code: true
		}
	});

	return {
		vendors
	};
};

// Schema for software creation
const softwareCreateSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	vendorId: z.string().uuid('Please select a vendor'),
	description: z.string().max(500).optional(),
	currentVersion: z.string().min(1, 'Version is required').max(50),
	currentPtfLevel: z.string().max(50).optional().or(z.literal('')),
	active: z.boolean().default(true)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			vendorId: formData.get('vendorId'),
			description: formData.get('description') || '',
			currentVersion: formData.get('currentVersion'),
			currentPtfLevel: formData.get('currentPtfLevel') || '',
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = softwareCreateSchema.parse(data);

			// Create software in database
			const software = await db.software.create({
				data: {
					name: validated.name,
					vendorId: validated.vendorId,
					description: validated.description || null,
					currentVersion: validated.currentVersion,
					currentPtfLevel: validated.currentPtfLevel || null,
					versionHistory: [],
					active: validated.active
				}
			});

			// Create audit log
			await createAuditLog('software', software.id, 'create', { software });

			// Redirect to software list
			throw redirect(303, '/software');
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
