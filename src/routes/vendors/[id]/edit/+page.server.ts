import type { PageServerLoad, Actions } from './$types';
import { vendorUpdateSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load: PageServerLoad = async ({ params }) => {
	const vendor = await db.vendors.findUnique({
		where: { id: params.id }
	});

	if (!vendor) {
		throw error(404, 'Vendor not found');
	}

	// Initialize Superforms with existing vendor data
	const form = await superValidate(vendor, zod(vendorUpdateSchema));

	return { form, vendor };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod(vendorUpdateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code
		const existing = await db.vendors.findFirst({
			where: {
				code: form.data.code,
				id: { not: event.params.id }
			}
		});

		if (existing) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: ['A vendor with this code already exists.'] } }
				}
			});
		}

		try {
			const vendor = await db.vendors.update({
				where: { id: event.params.id },
				data: {
					name: form.data.name,
					code: form.data.code,
					website: form.data.website || null,
					contact_email: form.data.contact_email || null,
					active: form.data.active
				}
			});

			await createAuditLog('vendor', vendor.id, 'update', vendor);

			throw redirect(303, `/vendors/${vendor.id}`);
		} catch (err) {
			if (err instanceof Response) throw err;

			console.error('Error updating vendor:', err);
			return fail(500, { form });
		}
	}
};
