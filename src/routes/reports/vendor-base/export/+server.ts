import type { RequestHandler } from './$types';
import { getVendorBase } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { VENDOR_BASE_CSV_COLUMNS, vendorBaseRecords } from '#lib/utils/vendor-base.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of the vendor installed base: one row per product x release x customer. */
export const GET: RequestHandler = async ({ url }) => {
	const base = await getVendorBase(readScope(url));
	return csvDownload('vendor-installed-base', toCsv(VENDOR_BASE_CSV_COLUMNS, vendorBaseRecords(base)));
};
