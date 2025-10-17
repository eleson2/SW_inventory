import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';

// Load vendors and all software for dropdown
export const load: PageServerLoad = async () => {
	const [vendors, allSoftware] = await Promise.all([
		db.vendors.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				code: true
			}
		}),
		db.software.findMany({
			where: { active: true },
			include: {
				vendors: {
					select: {
						name: true,
						code: true
					}
				},
				current_version: {
					select: {
						version: true,
						ptf_level: true,
						release_date: true
					}
				}
			},
			orderBy: { name: 'asc' }
		})
	]);

	return {
		vendors,
		allSoftware
	};
};

// Schema for software creation with initial version
const softwareCreateSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	vendor_id: z.string().uuid('Please select a vendor'),
	description: z.string().max(500).optional(),
	version: z.string().min(1, 'Version is required').max(50),
	ptf_level: z.string().max(50).optional().or(z.literal('')),
	release_date: z.coerce.date(),
	active: z.boolean().default(true)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const data = {
			name: formData.get('name'),
			vendor_id: formData.get('vendor_id'),
			description: formData.get('description') || '',
			version: formData.get('version'),
			ptf_level: formData.get('ptf_level') || '',
			release_date: formData.get('release_date'),
			active: formData.get('active') === 'on'
		};

		// Validate
		const validation = softwareCreateSchema.safeParse(data);
		if (!validation.success) {
			return fail(400, {
				errors: validation.error.flatten().fieldErrors,
				message: 'Validation failed'
			});
		}

		const validated = validation.data;

		try {
			// Check if software already exists for this vendor
			const existing = await db.software.findFirst({
				where: {
					vendor_id: validated.vendor_id,
					name: validated.name
				}
			});

			if (existing) {
				return fail(400, {
					errors: { name: ['Software with this name already exists for this vendor'] },
					message: 'Software with this name already exists for this vendor'
				});
			}

			// Create software and initial version in a transaction
			const result = await db.$transaction(async (tx) => {
				// Create the software first
				const software = await tx.software.create({
					data: {
						name: validated.name,
						vendor_id: validated.vendor_id,
						description: validated.description || null,
						active: validated.active
					}
				});

				// Create the initial version
				const version = await tx.software_versions.create({
					data: {
						software_id: software.id,
						version: validated.version,
						ptf_level: validated.ptf_level || null,
						release_date: validated.release_date,
						is_current: true
					}
				});

				// Update software to set current_version_id
				await tx.software.update({
					where: { id: software.id },
					data: { current_version_id: version.id }
				});

				// Create audit log
				await tx.audit_log.create({
					data: {
						entity_type: 'software',
						entity_id: software.id,
						action: 'create',
						changes: {
							...software,
							initial_version: version
						}
					}
				});

				return software;
			});

			throw redirect(303, `/software/${result.id}`);
		} catch (error) {
			if (error instanceof Response) throw error;

			console.error('Error creating software:', error);
			return fail(500, {
				message: 'Failed to create software'
			});
		}
	}
};
