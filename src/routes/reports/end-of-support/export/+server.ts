import type { RequestHandler } from './$types';
import { getEndOfSupport } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { EOS_CSV_COLUMNS, eosRecords } from '#lib/utils/end-of-support.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of the end-of-support horizon: one row per product x release x LPAR. */
export const GET: RequestHandler = async ({ url }) => {
	const report = await getEndOfSupport(readScope(url));
	return csvDownload('end-of-support', toCsv(EOS_CSV_COLUMNS, eosRecords(report)), readScope(url).asOf);
};
