import type { RequestHandler } from './$types';
import { getChangeHistory } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { CHANGE_CSV_COLUMNS, changeRecords, readMonthPeriod } from '#lib/utils/change-history.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of the change history: one row per change; ?view=customer leaves out internal columns' content. */
export const GET: RequestHandler = async ({ url }) => {
	const period = readMonthPeriod(url);
	const report = await getChangeHistory(readScope(url), period.start, period.end, url.searchParams.get('ptf') === '0');
	const customerView = url.searchParams.get('view') === 'customer';
	return csvDownload(`changes-${period.from}-to-${period.to}`, toCsv(CHANGE_CSV_COLUMNS, changeRecords(report, customerView)));
};
