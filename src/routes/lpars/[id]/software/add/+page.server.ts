import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';
import { z } from 'zod';

// Schema for adding software to LPAR
const lparSoftwareAddSchema = z.object({
	software_id: z.string().uuid('Invalid software ID'),
	software_version_id: z.string().uuid('Invalid version ID')
});

export const load: PageServerLoad = async ({ params }) => {
	const lparId = params.id;

	// Get LPAR info
	const lpar = await db.lpars.findUnique({
		where: { id: lparId },
		select: {
			id: true,
			name: true,
			code: true,
			customers: {
				select: {
					id: true,
					name: true
				}
			},
			packages: {
				select: {
					id: true,
					name: true,
					code: true,
					version: true
				}
			},
			lpar_software: {
				select: {
					software_id: true
				}
			}
		}
	});

	if (!lpar) {
		throw error(404, 'LPAR not found');
	}

	// Get all software with their versions, excluding already installed software
	const installedSoftwareIds = lpar.lpar_software.map(ls => ls.software_id);

	const software = await db.software.findMany({
		where: {
			active: true,
			id: {
				notIn: installedSoftwareIds
			}
		},
		include: {
			vendors: true,
			versions: {
				orderBy: [{ is_current: 'desc' }, { release_date: 'desc' }]
			}
		},
		orderBy: { name: 'asc' }
	});

	return {
		lpar,
		software
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const lparId = params.id;
		const formData = await request.formData();

		// Extract and validate form data
		const data = {
			software_id: formData.get('software_id'),
			software_version_id: formData.get('software_version_id')
		};

		// Validate
		const validation = lparSoftwareAddSchema.safeParse(data);
		if (!validation.success) {
			return fail(400, {
				errors: validation.error.flatten().fieldErrors,
				message: 'Validation failed'
			});
		}

		const validated = validation.data;

		try {
			// Check if this software is already installed on this LPAR
			const existing = await db.lpar_software.findUnique({
				where: {
					lpar_id_software_id: {
						lpar_id: lparId,
						software_id: validated.software_id
					}
				}
			});

			if (existing) {
				return fail(400, {
					errors: { software_id: ['This software is already installed on this LPAR'] },
					message: 'This software is already installed on this LPAR'
				});
			}

			// Get the version details
			const version = await db.software_versions.findUnique({
				where: { id: validated.software_version_id },
				select: {
					version: true,
					ptf_level: true
				}
			});

			if (!version) {
				return fail(400, {
					errors: { software_version_id: ['Invalid version selected'] },
					message: 'Invalid version selected'
				});
			}

			// Create the LPAR software installation
			await db.lpar_software.create({
				data: {
					lpar_id: lparId,
					software_id: validated.software_id,
					current_version: version.version,
					current_ptf_level: version.ptf_level,
					installed_date: new Date(),
					rolled_back: false
				}
			});

			// Create audit log
			await db.audit_log.create({
				data: {
					entity_type: 'lpar_software',
					entity_id: lparId,
					action: 'create',
					changes: {
						software_id: validated.software_id,
						version: version.version,
						ptf_level: version.ptf_level
					}
				}
			});
		} catch (err) {
			console.error('Error installing software on LPAR:', err);
			return fail(500, {
				message: 'Failed to install software on LPAR'
			});
		}

		throw redirect(303, `/lpars/${lparId}`);
	}
};
