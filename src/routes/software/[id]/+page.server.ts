import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = createDetailLoader({
	model: db.software,
	entityName: 'Software',
	include: {
		vendors: true,
		current_version: true,
		versions: {
			orderBy: {
				release_date: 'desc'
			}
		}
	}
});

export const actions: Actions = {
	delete: async ({ params }) => {
		try {
			// Check if software exists and get all dependencies
			const software = await db.software.findUnique({
				where: { id: params.id },
				include: {
					versions: {
						include: {
							package_items: true
						}
					}
				}
			});

			if (!software) {
				return fail(404, { error: 'Software not found' });
			}

			// Rule 1: Cannot delete active software
			if (software.active) {
				return fail(400, {
					error: 'Cannot delete active software. Please deactivate it first.'
				});
			}

			// Rule 2: Check if any version is used in packages
			const versionsInPackages = software.versions.filter(v =>
				v.package_items && v.package_items.length > 0
			);
			if (versionsInPackages.length > 0) {
				return fail(400, {
					error: `Cannot delete software. ${versionsInPackages.length} version(s) are used in packages.`
				});
			}

			// Rule 3: Check if software is installed on any LPAR
			const lparInstallations = await db.lpar_software.count({
				where: { software_id: params.id }
			});
			if (lparInstallations > 0) {
				return fail(400, {
					error: `Cannot delete software. It is installed on ${lparInstallations} LPAR(s).`
				});
			}

			// Safe to hard delete (cascade will delete versions)
			await db.software.delete({
				where: { id: params.id }
			});

			await createAuditLog('software', params.id, 'delete', {
				...software,
				permanently_deleted: true
			});

			throw redirect(303, '/software');
		} catch (error) {
			if (error instanceof Response) throw error;

			console.error('Error deleting software:', error);
			return fail(500, { error: 'Failed to delete software' });
		}
	}
};
