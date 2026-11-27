import type { PageServerLoad, Actions } from './$types';
import { vendorSchema } from '#lib/schemas/index.ts';
import { db } from '#lib/server/db.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import { createFormAction } from '#lib/server/form-actions.ts';
import { requirePermission } from '#lib/server/permissions.ts';

// Load all vendors for clone dropdown
export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'manage_vendors');
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

const create = createFormAction({
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
});

export const actions: Actions = {
	default: async (event) => {
		requirePermission(event.locals, 'manage_vendors');
		return create(event);
	}
};
