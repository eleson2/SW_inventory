import type { PageServerLoad, Actions } from './$types';
import { vendorSchema } from '$schemas';
import { db } from '$lib/server/db';
import { serverValidate } from '$lib/utils/superforms';
import { createFormAction } from '$lib/server/form-actions';

// Load all vendors for clone dropdown
export const load: PageServerLoad = async () => {
	// Initialize Superforms with default values
	const form = await serverValidate(
		{ website: '', contact_email: '', active: true },
		vendorSchema
	);

	const allVendors = await db.vendors.findMany({
		where: { active: true },
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			code: true,
			website: true,
			contact_email: true,
			active: true
		}
	});

	return {
		form,
		allVendors
	};
};

export const actions: Actions = {
	default: createFormAction({
		schema: vendorSchema,
		model: db.vendors,
		entityType: 'vendor',
		redirectPath: (id) => `/vendors/${id}`,
		transform: (data) => ({
			name: data.name,
			code: data.code,
			website: data.website || null,
			contact_email: data.contact_email || null,
			active: data.active
		})
	})
};
