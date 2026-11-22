import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '#lib/server/db.ts';

export const load: PageServerLoad = async ({ params }) => {
	const bundle = await db.vendor_bundles.findUnique({
		where: { id: params.id },
		include: {
			vendors: { select: { id: true, name: true, code: true } },
			items: {
				include: {
					software: { select: { id: true, name: true, product_code: true } },
					software_version: { select: { id: true, version: true, ptf_level: true, is_current: true } }
				},
				orderBy: { software: { name: 'asc' } }
			}
		}
	});
	if (!bundle) error(404, 'Bundle not found');

	// Packages that copied items from this bundle
	const packages = await db.packages.findMany({
		where: { package_items: { some: { source_bundle_id: params.id } } },
		select: {
			id: true,
			name: true,
			code: true,
			version: true,
			_count: { select: { package_items: { where: { source_bundle_id: params.id } } } }
		},
		orderBy: { release_date: 'desc' }
	});

	return { bundle, packages };
};

export const actions: Actions = {
	delete: async ({ params }) => {
		try {
			const bundle = await db.vendor_bundles.findUnique({
				where: { id: params.id },
				include: { _count: { select: { items: true } } }
			});
			if (!bundle) return fail(404, { error: 'Bundle not found' });
			if (bundle.active) {
				return fail(400, { error: 'Cannot delete an active bundle. Please deactivate it first.' });
			}

			// Items cascade; package items built from it keep their versions (source_bundle_id becomes null)
			await db.vendor_bundles.delete({ where: { id: params.id } });
			await createAuditLog('vendor_bundle', params.id, 'delete', { ...bundle, permanently_deleted: true });
		} catch (err) {
			console.error('Error deleting bundle:', err);
			return fail(500, { error: 'Failed to delete bundle' });
		}
		redirect(303, '/bundles');
	}
};
