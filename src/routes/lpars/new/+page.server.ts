import type { PageServerLoad, Actions } from './$types';
import { lparSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

// Load customers, packages, and all LPARs for dropdowns
export const load: PageServerLoad = async ({ url }) => {
	// Check if customer_id is provided in URL query params
	const customerIdFromUrl = url.searchParams.get('customer_id');

	// Initialize Superforms with default values (pre-fill customer_id if provided)
	// @ts-expect-error - Superforms type inference issue with Zod validators
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
		// @ts-expect-error - Superforms type inference issue with Zod validators
		const form = await superValidate(event, zod(lparSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code
		const existing = await db.lpars.findUnique({
			// @ts-expect-error - Type inference from Zod schema
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
					// @ts-ignore - Type inference from Zod schema
					name: form.data.name,
					// @ts-ignore
					code: form.data.code,
					// @ts-ignore
					customer_id: form.data.customer_id,
					// @ts-ignore
					description: form.data.description || null,
					// @ts-ignore
					current_package_id: form.data.current_package_id || null,
					// @ts-ignore
					active: form.data.active
				}
			});

			// Create audit log
			await createAuditLog('lpar', lpar.id, 'create', lpar);

			// Return success - client will handle redirect via onUpdated
			return { form };
		} catch (error) {
			console.error('Error creating LPAR:', error);
			return fail(500, { form });
		}
	}
};
