import type { RequestHandler } from './$types';
import { getWhereUsed } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { WHERE_USED_CSV_COLUMNS, whereUsedRecords } from '#lib/utils/inventory-reports.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of where used: one row per LPAR x product. */
export const GET: RequestHandler = async ({ url }) => {
	const release = url.searchParams.get('release');
	const report = await getWhereUsed(
		readScope(url),
		url.searchParams.getAll('product').filter(Boolean),
		release ? [release] : []
	);
	return csvDownload('where-used', toCsv(WHERE_USED_CSV_COLUMNS, whereUsedRecords(report)));
};
