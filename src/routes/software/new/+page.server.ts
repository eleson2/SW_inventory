import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { createCreateAction } from '$lib/server/route-factory';
import { z } from 'zod';

// Load vendors for dropdown
export const load: PageServerLoad = async () => {
	const vendors = await db.vendors.findMany({
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
	default: createCreateAction({
		schema: softwareCreateSchema,
		model: db.software,
		entityType: 'software',
		redirectPath: '/software',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			vendorId: formData.get('vendor_id'),
			description: formData.get('description') || '',
			currentVersion: formData.get('currentVersion'),
			currentPtfLevel: formData.get('currentPtfLevel') || '',
			active: formData.get('active') === 'on'
		}),
		transformData: (validated) => ({
			name: validated.name,
			vendorId: validated.vendorId,
			description: validated.description || null,
			currentVersion: validated.currentVersion,
			currentPtfLevel: validated.currentPtfLevel || null,
			versionHistory: [],
			active: validated.active
		})
	})
};
