import type { PageServerLoad, Actions } from './$types';
import { lparSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

// Load customers, packages, and all LPARs for dropdowns
// @ts-expect-error - TypeScript has difficulty inferring complex Zod schema types in function return
export const load: PageServerLoad = async ({ url }) => {
	// Check if customer_id is provided in URL query params
	const customerIdFromUrl = url.searchParams.get('customer_id');

	// Initialize Superforms with default values (pre-fill customer_id if provided)
	const form = await superValidate(
		{
			description: '',
			current_package_id: '',
			active: true,
			customer_id: customerIdFromUrl || ''
		},
		zod(lparSchema)
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
	// @ts-expect-error - TypeScript has difficulty inferring complex Zod schema types
	const form = await superValidate(event, zod(lparSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code
		const existing = await db.lpars.findUnique({
			where: { code: form.data.code }
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
					name: form.data.name,
					code: form.data.code,
					customer_id: form.data.customer_id,
					description: form.data.description || null,
					current_package_id: form.data.current_package_id || null,
					active: form.data.active
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
