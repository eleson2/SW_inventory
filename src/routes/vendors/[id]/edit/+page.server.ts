import type { PageServerLoad, Actions } from './$types';
import { vendorUpdateSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';
import { serverValidate } from '$lib/utils/superforms';

export const load: PageServerLoad = async ({ params }) => {
	const vendor = await db.vendors.findUnique({
		where: { id: params.id }
	});

	if (!vendor) {
		throw error(404, 'Vendor not found');
	}

	// Initialize Superforms with existing vendor data
	const form = await serverValidate(vendor, vendorUpdateSchema);

	return { form, vendor };
};

export const actions: Actions = {
	default: async (event) => {
	const form = await serverValidate(event, vendorUpdateSchema);

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
			// Get current vendor state
			const currentVendor = await db.vendors.findUnique({
				where: { id: event.params.id }
			});

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

			// CASCADE: If vendor is being deactivated, deactivate all its software
			if (currentVendor?.active && !form.data.active) {
				await db.software.updateMany({
					where: { vendor_id: vendor.id },
					data: { active: false, updated_at: new Date() }
				});
			}

			await createAuditLog('vendor', vendor.id, 'update', vendor);

			// Return success - client will handle redirect via onUpdated
			return { form };
		} catch (err) {
			console.error('Error updating vendor:', err);
			return fail(500, { form });
		}
	}
};
