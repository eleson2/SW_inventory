import type { RequestHandler } from './$types';
import { getMaintenanceLevels } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { LEVEL_CSV_COLUMNS, levelRecords } from '#lib/utils/maintenance-level.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of maintenance levels: one row per LPAR x vendor. */
export const GET: RequestHandler = async ({ url }) => {
	const report = await getMaintenanceLevels(readScope(url));
	return csvDownload('maintenance-level', toCsv(LEVEL_CSV_COLUMNS, levelRecords(report)), readScope(url).asOf);
};
