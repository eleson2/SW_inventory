import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

const versionSchema = z.object({
	newVersion: z.string().min(1, 'Version is required').max(50),
	newPtfLevel: z.string().max(50).optional().or(z.literal('')),
	releaseNotes: z.string().max(1000).optional().or(z.literal(''))
});

export const load: PageServerLoad = async ({ params }) => {
	const software = await db.software.findUnique({
		where: { id: params.id },
		include: {
			vendors: true
		}
	});

	if (!software) {
		throw error(404, 'Software not found');
	}

	return {
		software: {
			...software,
			versionHistory: Array.isArray(software.version_history)
				? software.version_history
				: []
		}
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const formData = await request.formData();
		const data = {
			newVersion: formData.get('newVersion'),
			newPtfLevel: formData.get('newPtfLevel'),
			releaseNotes: formData.get('releaseNotes')
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

		// Parse existing version history
		const versionHistory = Array.isArray(software.version_history)
			? software.version_history
			: [];

		// Add current version to history
		const newHistoryEntry = {
			version: software.current_version,
			ptfLevel: software.current_ptf_level || null,
			timestamp: new Date().toISOString(),
			releaseNotes: result.data.releaseNotes || null
		};

		const updatedHistory = [newHistoryEntry, ...versionHistory];

		// Update software with new version
		const updated = await db.software.update({
			where: { id: params.id },
			data: {
				current_version: result.data.newVersion,
				current_ptf_level: result.data.newPtfLevel || null,
				version_history: updatedHistory,
				updated_at: new Date()
			}
		});

		// Audit log
		await createAuditLog(
			'software',
			params.id,
			'version_update',
			{
				old_version: software.current_version,
				old_ptf_level: software.current_ptf_level,
				new_version: result.data.newVersion,
				new_ptf_level: result.data.newPtfLevel,
				release_notes: result.data.releaseNotes
			}
		);

		throw redirect(303, `/software/${params.id}`);
	}
};
