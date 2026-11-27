import type { PageServerLoad, Actions } from './$types';
import { vendorUpdateSchema } from '#lib/schemas/index.ts';
import { db, createAuditLog, checkUniqueConstraint } from '#lib/server/db.ts';
import { error, fail } from '@sveltejs/kit';
import { serverValidate } from '#lib/utils/superforms.ts';
import { requirePermission } from '#lib/server/permissions.ts';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePermission(locals, 'edit_vendor', { vendor: params.id });
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
		requirePermission(event.locals, 'edit_vendor', { vendor: event.params.id });
	const form = await serverValidate(event, vendorUpdateSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code using helper
		const uniqueCheck = await checkUniqueConstraint(db.vendors, 'code', form.data.code, event.params.id);
		if (uniqueCheck.exists) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: [uniqueCheck.error!] } }
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
