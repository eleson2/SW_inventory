import type { RequestHandler } from './$types';
import { getInstalledMatrix } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { MATRIX_CSV_COLUMNS, matrixRecords } from '#lib/utils/installed-matrix.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of the installed software matrix: one row per LPAR x product, same filters as the page. */
export const GET: RequestHandler = async ({ url }) => {
	const matrix = await getInstalledMatrix(readScope(url));
	return csvDownload('installed-software', toCsv(MATRIX_CSV_COLUMNS, matrixRecords(matrix)));
};
