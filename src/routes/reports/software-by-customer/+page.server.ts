import type { PageServerLoad, Actions } from './$types';
import { db } from '#lib/server/db.ts';
import { getSoftwareByCustomer } from '#lib/server/reports.ts';

export const load: PageServerLoad = async ({ url }) => {
	// Get all customers for filter dropdown
	const customers = await db.customers.findMany({
		where: { active: true },
		select: { id: true, name: true, code: true },
		orderBy: { name: 'asc' }
	});

	// Get selected customer IDs from query params
	const customerIds = url.searchParams.getAll('customer');
	const reportData = await getSoftwareByCustomer(customerIds);

	return {
		customers,
		reportData,
		selectedCustomerIds: customerIds
	};
};

export const actions: Actions = {
	// Export to CSV action
	export: async ({ url }) => {
		const reportData = await getSoftwareByCustomer(url.searchParams.getAll('customer'));

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
			...reportData.map((row) => [
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
