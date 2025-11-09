import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { serverValidate } from '$lib/utils/superforms';

// Schema for deployment form
const deploymentSchema = z.object({
	lparIds: z.array(z.string()).min(1, 'Select at least one LPAR')
});

export const load: PageServerLoad = async ({ params }) => {
	const packageId = params.id;

	// Validate form with default empty array
	const form = await serverValidate({ lparIds: [] }, deploymentSchema);

	// Get the package with its items
	const pkg = await db.packages.findUnique({
		where: { id: packageId },
		include: {
			package_items: {
				include: {
					software: {
						select: {
							name: true,
							vendor_id: true
						}
					},
					software_version: {
						select: {
							version: true,
							ptf_level: true
						}
					}
				},
				orderBy: { order_index: 'asc' }
			}
		}
	});

	if (!pkg) {
		throw redirect(303, '/packages');
	}

	// Get all active LPARs with their current packages
	const lpars = await db.lpars.findMany({
		where: { active: true },
		include: {
			customers: {
				select: {
					id: true,
					name: true
				}
			},
			current_package: {
				select: {
					id: true,
					name: true,
					version: true
				}
			}
		},
		orderBy: { name: 'asc' }
	});

	return {
		form,
		package: pkg,
		lpars
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const packageId = params.id;

		// Validate form data
		const form = await serverValidate(request, deploymentSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		const lparIds = form.data.lparIds;

		try {
			// Update each selected LPAR to point to this package
			await db.$transaction(async (tx) => {
				for (const lparId of lparIds) {
					// Update the LPAR's current package
					await tx.lpars.update({
						where: { id: lparId },
						data: {
							current_package_id: packageId,
							updated_at: new Date()
						}
					});

					// Create audit log for the deployment
					await createAuditLog(
						'lpar',
						lparId,
						'update',
						{
							action: 'package_deployment',
							package_id: packageId,
							deployed_at: new Date()
						}
					);
				}
			});

			// Redirect back to package page
			redirect(303, `/packages/${packageId}`);
		} catch (error) {
			console.error('Error deploying package:', error);
			return fail(500, { form });
		}
	}
};
