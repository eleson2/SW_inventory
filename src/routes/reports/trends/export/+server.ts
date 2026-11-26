import type { RequestHandler } from './$types';
import { getTrends } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { TREND_CSV_COLUMNS, trendRecords } from '#lib/utils/trends.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';
import { readTrendParams } from '../params.ts';

/** CSV of the trends: one row per month end and group (total, vendor or customer). */
export const GET: RequestHandler = async ({ url }) => {
	const { months, groupBy } = readTrendParams(url);
	const report = await getTrends({ ...readScope(url), asOf: null }, months);
	return csvDownload(`trends-${groupBy}-${months}m`, toCsv(TREND_CSV_COLUMNS, trendRecords(report, groupBy)));
};
