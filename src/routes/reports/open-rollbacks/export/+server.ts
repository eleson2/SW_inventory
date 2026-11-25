import type { RequestHandler } from './$types';
import { getOpenRollbacks } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { OPEN_ROLLBACK_CSV_COLUMNS, openRollbackRecords } from '#lib/utils/rollbacks.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of open rollbacks: one row per rolled-back install. */
export const GET: RequestHandler = async ({ url }) => {
	const rows = await getOpenRollbacks(readScope(url));
	return csvDownload('open-rollbacks', toCsv(OPEN_ROLLBACK_CSV_COLUMNS, openRollbackRecords(rows)));
};
