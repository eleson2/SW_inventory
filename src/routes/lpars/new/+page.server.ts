import type { PageServerLoad, Actions } from './$types';
import { lparSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { zod } from 'sveltekit-superforms/adapters';
import type { LparFormData } from '$lib/types/superforms';
import { serverValidate } from '$lib/utils/superforms';

// Load customers, packages, and all LPARs for dropdowns
export const load: PageServerLoad = async ({ url }) => {
	// Check if customer_id is provided in URL query params
	const customerIdFromUrl = url.searchParams.get('customer_id');

	// Initialize Superforms with default values (pre-fill customer_id if provided)
	const form = await serverValidate(
		{
			description: '',
			current_package_id: '',
			active: true,
			customer_id: customerIdFromUrl || ''
		},
		lparSchema
	);

	const [customers, packages, allLpars, preselectedCustomer] = await Promise.all([
		db.customers.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				code: true
			}
		}),
		db.packages.findMany({
			where: { active: true },
			orderBy: { release_date: 'desc' },
			select: {
				id: true,
				name: true,
				code: true,
				version: true
			}
		}),
		db.lpars.findMany({
			where: { active: true },
			include: {
				customers: {
					select: {
						name: true,
						code: true
					}
				},
				packages: {
					select: {
						name: true,
						code: true,
						version: true
					}
				}
			},
			orderBy: { name: 'asc' }
		}),
		// Get customer info if pre-selected
		customerIdFromUrl
			? db.customers.findUnique({
				where: { id: customerIdFromUrl },
				select: { id: true, name: true, code: true }
			})
			: Promise.resolve(null)
	]);

	return {
		form,
		customers,
		packages,
		allLpars,
		preselectedCustomer
	};
};

export const actions: Actions = {
	default: async (event) => {
	// Use Superforms to validate form data
	const form = await serverValidate(event, lparSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Type-safe form data access
		const formData = form.data as LparFormData;

		// Check for unique code
		const existing = await db.lpars.findUnique({
			where: { code: formData.code }
		});

		if (existing) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: ['An LPAR with this code already exists.'] } }
				}
			});
		}

		try {
			// Create LPAR
			const lpar = await db.lpars.create({
				data: {
					name: formData.name,
					code: formData.code,
					customer_id: formData.customer_id,
					description: formData.description || null,
					current_package_id: formData.current_package_id || null,
					active: formData.active
				}
			});

			// Create audit log
			await createAuditLog('lpar', lpar.id, 'create', lpar);

			// Check if we came from a customer page (redirect back there)
			const customerIdFromUrl = new URL(event.request.url).searchParams.get('customer_id');

			if (customerIdFromUrl) {
				redirect(303, `/customers/${customerIdFromUrl}`);
			}

			// Otherwise redirect to lpars list
			redirect(303, '/lpars');
		} catch (error) {
			console.error('Error creating LPAR:', error);
			return fail(500, { form });
		}
	}
};
