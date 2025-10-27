import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { softwareWithVersionsSchema } from '$lib/schemas/software';

// Load vendors and all software for dropdown
export const load: PageServerLoad = async ({ url }) => {
	// Check if vendor_id is provided in URL query params
	const vendorIdFromUrl = url.searchParams.get('vendor_id');

	// Initialize Superforms with default values (pre-fill vendor_id if provided)
	const form = await superValidate(
		{
			description: '',
			active: true,
			versions: [],
			vendor_id: vendorIdFromUrl || ''
		},
		zod(softwareWithVersionsSchema)
	);

	const [vendors, allSoftware, preselectedVendor] = await Promise.all([
		db.vendors.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				code: true
			}
		}),
		db.software.findMany({
			where: { active: true },
			include: {
				vendors: {
					select: {
						name: true,
						code: true
					}
				},
				current_version: {
					select: {
						version: true,
						ptf_level: true,
						release_date: true
					}
				}
			},
			orderBy: { name: 'asc' }
		}),
		// Get vendor info if pre-selected
		vendorIdFromUrl
			? db.vendors.findUnique({
				where: { id: vendorIdFromUrl },
				select: { id: true, name: true, code: true }
			})
			: Promise.resolve(null)
	]);

	return {
		form,
		vendors,
		allSoftware,
		preselectedVendor
	};
};

export const actions: Actions = {
	default: async (event) => {
		// Use Superforms to validate form data
		const form = await superValidate(event, zod(softwareWithVersionsSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Check if software already exists for this vendor
			const existing = await db.software.findFirst({
				where: {
					vendor_id: form.data.vendor_id,
					name: form.data.name
				}
			});

			if (existing) {
				return fail(400, {
					form: {
						...form,
						errors: { ...form.errors, name: { _errors: ['Software with this name already exists for this vendor'] } }
					}
				});
			}

			// Create software and versions in a transaction
			const result = await db.$transaction(async (tx) => {
				// Create the software first
				const software = await tx.software.create({
					data: {
						name: form.data.name,
						vendor_id: form.data.vendor_id,
						description: form.data.description || null,
						active: form.data.active
					}
				});

				let currentVersionId: string | null = null;

				// Create versions if provided
				if (form.data.versions && form.data.versions.length > 0) {
					for (const versionData of form.data.versions) {
						const version = await tx.software_versions.create({
							data: {
								software_id: software.id,
								version: versionData.version,
								ptf_level: versionData.ptf_level || null,
								release_date: new Date(versionData.release_date),
								end_of_support: versionData.end_of_support ? new Date(versionData.end_of_support) : null,
								release_notes: versionData.release_notes || null,
								is_current: versionData.is_current
							}
						});

						// Track the current version ID
						if (versionData.is_current) {
							currentVersionId = version.id;
						}
					}
				}

				// Update software with current_version_id if set
				if (currentVersionId) {
					await tx.software.update({
						where: { id: software.id },
						data: { current_version_id: currentVersionId }
					});
				}

				// Create audit log
				await createAuditLog(
					'software',
					software.id,
					'create',
					{
						...software,
						versions_count: form.data.versions?.length || 0
					}
				);

				return software;
			});

			// Return success - client will handle redirect via onUpdated
			return { form };
		} catch (error) {
			console.error('Error creating software:', error);
			return fail(500, { form });
		}
	}
};
