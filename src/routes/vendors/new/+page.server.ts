import type { PageServerLoad, Actions } from './$types';
import { vendorSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { SuperForm } from '$lib/types/superforms';

// Load all vendors for clone dropdown
export const load: PageServerLoad = async () => {
	// Initialize Superforms with default values
	const form = await superValidate(
		{ website: '', contact_email: '', active: true },
		zod(vendorSchema)
	) as SuperForm<typeof vendorSchema>;

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
	default: async (event) => {
	// Use Superforms to validate form data
	const form = await superValidate(event, zod(vendorSchema)) as SuperForm<typeof vendorSchema>;

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code
		const existing = await db.vendors.findUnique({
			where: { code: form.data.code }
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
			// Create vendor
			const vendor = await db.vendors.create({
				data: {
					name: form.data.name,
					code: form.data.code,
					website: form.data.website || null,
					contact_email: form.data.contact_email || null,
					active: form.data.active
				}
			});

			// Create audit log
			await createAuditLog('vendor', vendor.id, 'create', vendor);

			// Redirect to vendor detail page
			redirect(303, `/vendors/${vendor.id}`);
		} catch (error) {
			console.error('Error creating vendor:', error);
			return fail(500, { form });
		}
	}
};
