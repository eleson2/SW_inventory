import type { RequestHandler } from './$types';
import { getLowFootprint } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { FOOTPRINT_CSV_COLUMNS, footprintRecords, readMaxLpars } from '#lib/utils/low-footprint.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of low-footprint products: one row per listed product, then the products installed nowhere. */
export const GET: RequestHandler = async ({ url }) => {
	const report = await getLowFootprint(readScope(url), readMaxLpars(url.searchParams.get('max')));
	return csvDownload('low-footprint', toCsv(FOOTPRINT_CSV_COLUMNS, footprintRecords(report)));
};
