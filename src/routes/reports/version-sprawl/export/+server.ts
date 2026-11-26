import type { RequestHandler } from './$types';
import { getVersionSprawl } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { SPRAWL_CSV_COLUMNS, sprawlRecords } from '#lib/utils/inventory-reports.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of version sprawl: one row per product x release + PTF level. */
export const GET: RequestHandler = async ({ url }) => {
	const rows = await getVersionSprawl(readScope(url));
	return csvDownload('version-sprawl', toCsv(SPRAWL_CSV_COLUMNS, sprawlRecords(rows)), readScope(url).asOf);
};
