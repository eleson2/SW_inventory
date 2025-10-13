import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params }) => {
	const [software, vendors] = await Promise.all([
		db.software.findUnique({
			where: { id: params.id },
			include: { vendor: true }
		}),
		db.vendor.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, code: true }
		})
	]);

	if (!software) {
		throw error(404, 'Software not found');
	}

	return {
		software,
		vendors
	};
};

const softwareUpdateSchema = z.object({
	name: z.string().min(2).max(100),
	vendorId: z.string().uuid(),
	description: z.string().max(500).optional(),
	currentVersion: z.string().min(1).max(50),
	currentPtfLevel: z.string().max(50).optional().or(z.literal('')),
	active: z.boolean()
});

export const actions: Actions = {
	default: async ({ request, params }) => {
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
			const validated = softwareUpdateSchema.parse(data);

			const oldSoftware = await db.software.findUnique({
				where: { id: params.id }
			});

			const software = await db.software.update({
				where: { id: params.id },
				data: {
					name: validated.name,
					vendorId: validated.vendorId,
					description: validated.description || null,
					currentVersion: validated.currentVersion,
					currentPtfLevel: validated.currentPtfLevel || null,
					active: validated.active
				}
			});

			await createAuditLog('software', software.id, 'update', {
				old: oldSoftware,
				new: software
			});

			throw redirect(303, `/software/${software.id}`);
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
