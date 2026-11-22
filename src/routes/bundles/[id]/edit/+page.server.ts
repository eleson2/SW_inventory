import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { message } from 'sveltekit-superforms';
import { db } from '#lib/server/db.ts';
import { bundleUpdateSchema, type BundleType } from '#lib/schemas/bundle.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import {
	saveBundle,
	BundleValidationError,
	loadSoftwareForBundles,
	loadVendorOptions
} from '#lib/server/bundles.ts';

export const load: PageServerLoad = async ({ params }) => {
	const bundle = await db.vendor_bundles.findUnique({
		where: { id: params.id },
		include: { items: { orderBy: { software: { name: 'asc' } } } }
	});
	if (!bundle) error(404, 'Bundle not found');

	const [vendors, allSoftware] = await Promise.all([loadVendorOptions(), loadSoftwareForBundles()]);

	const form = await serverValidate(
		{
			vendor_id: bundle.vendor_id,
			name: bundle.name,
			code: bundle.code,
			bundle_type: bundle.bundle_type as BundleType,
			release_date: bundle.release_date,
			description: bundle.description ?? '',
			source_url: bundle.source_url ?? '',
			active: bundle.active,
			items: bundle.items.map((item) => ({
				id: item.id,
				software_id: item.software_id,
				software_version_id: item.software_version_id,
				notes: item.notes ?? undefined,
				_action: 'keep' as const
			}))
		},
		bundleUpdateSchema
	);

	return { form, bundle, vendors, allSoftware };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await serverValidate(event, bundleUpdateSchema);
		if (!form.valid) return fail(400, { form });

		try {
			await saveBundle(form.data, event.params.id);
		} catch (err) {
			if (err instanceof BundleValidationError) {
				return message(form, err.message, { status: 400 });
			}
			console.error('Error updating bundle:', err);
			return message(form, 'Failed to update bundle', { status: 500 });
		}

		redirect(303, `/bundles/${event.params.id}`);
	}
};
