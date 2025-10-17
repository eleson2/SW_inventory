import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

const versionSchema = z.object({
	version: z.string().min(1, 'Version is required').max(50),
	ptf_level: z.string().max(50).optional().or(z.literal('')),
	release_date: z.coerce.date(),
	end_of_support: z.coerce.date().optional().nullable(),
	release_notes: z.string().max(1000).optional().or(z.literal(''))
});

export const load: PageServerLoad = async ({ params }) => {
	const software = await db.software.findUnique({
		where: { id: params.id },
		include: {
			vendors: true,
			versions: {
				orderBy: [
					{ is_current: 'desc' },
					{ release_date: 'desc' }
				]
			}
		}
	});

	if (!software) {
		throw error(404, 'Software not found');
	}

	return {
		software
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const formData = await request.formData();
		const data = {
			version: formData.get('version'),
			ptf_level: formData.get('ptf_level') || '',
			release_date: formData.get('release_date'),
			end_of_support: formData.get('end_of_support') || null,
			release_notes: formData.get('release_notes') || ''
		};

		// Validate
		const result = versionSchema.safeParse(data);
		if (!result.success) {
			return {
				errors: result.error.flatten().fieldErrors,
				message: 'Validation failed'
			};
		}

		// Get current software
		const software = await db.software.findUnique({
			where: { id: params.id }
		});

		if (!software) {
			return {
				message: 'Software not found'
			};
		}

		try {
			// Create new version in transaction
			await db.$transaction(async (tx) => {
				// Mark all existing versions as not current
				await tx.software_versions.updateMany({
					where: {
						software_id: params.id,
						is_current: true
					},
					data: {
						is_current: false
					}
				});

				// Create new version
				const newVersion = await tx.software_versions.create({
					data: {
						software_id: params.id,
						version: result.data.version,
						ptf_level: result.data.ptf_level || null,
						release_date: result.data.release_date,
						end_of_support: result.data.end_of_support || null,
						release_notes: result.data.release_notes || null,
						is_current: true
					}
				});

				// Update software to point to new current version
				await tx.software.update({
					where: { id: params.id },
					data: {
						current_version_id: newVersion.id
					}
				});

				// Audit log
				await createAuditLog(
					'software',
					params.id,
					'version_update',
					{
						new_version: result.data.version,
						new_ptf_level: result.data.ptf_level,
						release_notes: result.data.release_notes
					}
				);
			});

			throw redirect(303, `/software/${params.id}`);
		} catch (err) {
			if (err instanceof Error && err.message.includes('redirect')) {
				throw err;
			}

			console.error('Error creating version:', err);
			return {
				message: 'Failed to create version'
			};
		}
	}
};
