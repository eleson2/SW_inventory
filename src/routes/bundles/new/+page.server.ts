import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { message } from 'sveltekit-superforms';
import { db } from '#lib/server/db.ts';
import { bundleSchema } from '#lib/schemas/bundle.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import {
	saveBundle,
	BundleValidationError,
	loadSoftwareForBundles,
	loadVendorOptions
} from '#lib/server/bundles.ts';

export const load: PageServerLoad = async ({ url }) => {
	const [vendors, allSoftware, allBundles] = await Promise.all([
		loadVendorOptions(),
		loadSoftwareForBundles(),
		// Clone sources: latest first, so "clone previous" defaults sensibly
		db.vendor_bundles.findMany({
			include: {
				vendors: { select: { name: true } },
				items: { select: { software_id: true, software_version_id: true, notes: true } }
			},
			orderBy: [{ release_date: 'desc' }, { code: 'desc' }]
		})
	]);

	const form = await serverValidate(
		{
			vendor_id: url.searchParams.get('vendor_id') ?? '',
			bundle_type: 'OTHER',
			description: '',
			source_url: '',
			active: true,
			items: []
		},
		bundleSchema
	);

	return {
		form,
		vendors,
		allSoftware,
		allBundles,
		cloneFrom: url.searchParams.get('clone') ?? ''
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await serverValidate(event, bundleSchema);
		if (!form.valid) return fail(400, { form });

		let id: string;
		try {
			({ id } = await saveBundle(form.data));
		} catch (error) {
			if (error instanceof BundleValidationError) {
				return message(form, error.message, { status: 400 });
			}
			console.error('Error creating bundle:', error);
			return message(form, 'Failed to create bundle', { status: 500 });
		}

		redirect(303, `/bundles/${id}`);
	}
};
