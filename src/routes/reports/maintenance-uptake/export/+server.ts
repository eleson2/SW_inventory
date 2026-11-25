import type { RequestHandler } from './$types';
import { getMaintenanceUptake } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { UPTAKE_CSV_COLUMNS, uptakeRecords } from '#lib/utils/maintenance-level.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of maintenance uptake: one row per vendor level. */
export const GET: RequestHandler = async ({ url }) => {
	const vendors = await getMaintenanceUptake(readScope(url));
	return csvDownload('maintenance-uptake', toCsv(UPTAKE_CSV_COLUMNS, uptakeRecords(vendors)));
};
