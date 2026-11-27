import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '#lib/server/db.ts';
import { transactionTimeouts } from '#lib/server/db-dialect.ts';
import { z } from 'zod';
import { requirePermission } from '#lib/server/permissions.ts';
import { softwareTarget } from '#lib/server/scopes.ts';

const versionSchema = z.object({
	version: z.string().min(1, 'Version is required').max(50),
	ptf_level: z.string().max(50),
	release_date: z.coerce.date(),
	end_of_support: z.coerce.date().optional(),
	release_notes: z.string().max(1000)
});

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePermission(locals, 'edit_software', await softwareTarget(params.id));
	const software = await db.software.findUnique({
		where: { id: params.id },
		include: {
			vendors: true,
			current_version: true,
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
	default: async ({ params, request, locals }) => {
		requirePermission(locals, 'edit_software', await softwareTarget(params.id));
		const formData = await request.formData();
		const data = {
			version: formData.get('version'),
			ptf_level: formData.get('ptf_level') || '',
			release_date: formData.get('release_date'),
			end_of_support: formData.get('end_of_support') || undefined,
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
			const endOfSupport = await db.$transaction(async (tx) => {
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

				// Support ends per release: a new PTF level inherits the release's date, and a
				// date given here applies to every PTF level of the release
				const endOfSupport =
					result.data.end_of_support ??
					(
						await tx.software_versions.findFirst({
							where: { software_id: params.id, version: result.data.version, end_of_support: { not: null } },
							select: { end_of_support: true }
						})
					)?.end_of_support ??
					null;
				if (result.data.end_of_support) {
					await tx.software_versions.updateMany({
						where: { software_id: params.id, version: result.data.version },
						data: { end_of_support: result.data.end_of_support }
					});
				}

				// Create new version
				const newVersion = await tx.software_versions.create({
					data: {
						software_id: params.id,
						version: result.data.version,
						ptf_level: result.data.ptf_level || null,
						release_date: result.data.release_date,
						end_of_support: endOfSupport,
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

				return endOfSupport;
			}, transactionTimeouts());

			// After the commit: createAuditLog uses its own connection, and SQLite allows one writer
			await createAuditLog('software', params.id, 'version_update', {
				new_version: result.data.version,
				new_ptf_level: result.data.ptf_level,
				end_of_support: endOfSupport,
				release_notes: result.data.release_notes
			});
		} catch (err) {
			console.error('Error creating version:', err);
			return {
				message: 'Failed to create version'
			};
		}

		redirect(303, `/software/${params.id}`);
	}
};
