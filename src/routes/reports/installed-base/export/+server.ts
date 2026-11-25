import type { RequestHandler } from './$types';
import { getInstalledBase } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { BASE_CSV_COLUMNS, baseRecords } from '#lib/utils/installed-base.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';
import { readBaseParams } from '../params.ts';

/** CSV of the installed base: one row per month x vendor (plus "All vendors"). */
export const GET: RequestHandler = async ({ url }) => {
	const base = await getInstalledBase(readScope(url), readBaseParams(url).months);
	return csvDownload('installed-base', toCsv(BASE_CSV_COLUMNS, baseRecords(base)));
};
