import type { RequestHandler } from './$types';
import { getOverlap } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { OVERLAP_CSV_COLUMNS, overlapRecords } from '#lib/utils/overlap.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of overlapping products: one row per category x product x LPAR. */
export const GET: RequestHandler = async ({ url }) => {
	const report = await getOverlap(readScope(url), url.searchParams.get('same') === '1');
	return csvDownload('overlapping-products', toCsv(OVERLAP_CSV_COLUMNS, overlapRecords(report)));
};
