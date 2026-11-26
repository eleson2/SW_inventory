import type { RequestHandler } from './$types';
import { getCurrency } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { CURRENCY_CSV_COLUMNS, currencyRecords } from '#lib/utils/inventory-reports.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of the currency score: one row per LPAR. */
export const GET: RequestHandler = async ({ url }) => {
	const report = await getCurrency(readScope(url));
	return csvDownload('currency', toCsv(CURRENCY_CSV_COLUMNS, currencyRecords(report)), readScope(url).asOf);
};
