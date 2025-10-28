import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	// Get all customers for filter dropdown
	const customers = await db.customers.findMany({
		where: { active: true },
		select: { id: true, name: true, code: true },
		orderBy: { name: 'asc' }
	});

	// Get selected customer IDs from query params
	const customerIds = url.searchParams.getAll('customer');

	// Query the report view
	let reportData: any[] = [];

	if (customerIds.length > 0) {
		// Filter by selected customers
		reportData = await db.$queryRaw`
			SELECT
				customer_id,
				customer_name,
				customer_code,
				software_id,
				software_name,
				vendor_name,
				vendor_code,
				version,
				ptf_level,
				release_date,
				lpar_count,
				lpar_names,
				lpar_codes,
				latest_install_date,
				has_rollbacks
			FROM software_per_customer
			WHERE customer_id = ANY(${customerIds}::uuid[])
			ORDER BY customer_name, software_name, release_date DESC
		`;
	} else {
		// No filter - show all
		reportData = await db.$queryRaw`
			SELECT
				customer_id,
				customer_name,
				customer_code,
				software_id,
				software_name,
				vendor_name,
				vendor_code,
				version,
				ptf_level,
				release_date,
				lpar_count,
				lpar_names,
				lpar_codes,
				latest_install_date,
				has_rollbacks
			FROM software_per_customer
			ORDER BY customer_name, software_name, release_date DESC
		`;
	}

	return {
		customers,
		reportData,
		selectedCustomerIds: customerIds
	};
};

export const actions: Actions = {
	// Export to CSV action
	export: async ({ url }) => {
		const customerIds = url.searchParams.getAll('customer');

		let reportData: any[] = [];

		if (customerIds.length > 0) {
			reportData = await db.$queryRaw`
				SELECT
					customer_name,
					customer_code,
					software_name,
					vendor_name,
					vendor_code,
					version,
					ptf_level,
					release_date,
					lpar_count,
					has_rollbacks
				FROM software_per_customer
				WHERE customer_id = ANY(${customerIds}::uuid[])
				ORDER BY customer_name, software_name, release_date DESC
			`;
		} else {
			reportData = await db.$queryRaw`
				SELECT
					customer_name,
					customer_code,
					software_name,
					vendor_name,
					vendor_code,
					version,
					ptf_level,
					release_date,
					lpar_count,
					has_rollbacks
				FROM software_per_customer
				ORDER BY customer_name, software_name, release_date DESC
			`;
		}

		// Generate CSV
		const headers = [
			'Customer',
			'Customer Code',
			'Software',
			'Vendor',
			'Vendor Code',
			'Version',
			'PTF Level',
			'Release Date',
			'LPAR Count',
			'Has Rollbacks'
		];

		const csvRows = [
			headers.join(','),
			...reportData.map((row: any) => [
				`"${row.customer_name}"`,
				row.customer_code,
				`"${row.software_name}"`,
				`"${row.vendor_name}"`,
				row.vendor_code,
				row.version,
				row.ptf_level || '',
				row.release_date ? new Date(row.release_date).toISOString().split('T')[0] : '',
				row.lpar_count,
				row.has_rollbacks ? 'Yes' : 'No'
			].join(','))
		];

		const csv = csvRows.join('\n');

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="software-by-customer-${new Date().toISOString().split('T')[0]}.csv"`
			}
		});
	}
};
