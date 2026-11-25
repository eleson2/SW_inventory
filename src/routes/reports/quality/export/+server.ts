import type { RequestHandler } from './$types';
import { getQuality } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { QUALITY_CSV_COLUMNS, qualityRecords } from '#lib/utils/rollbacks.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';
import { readPeriod } from '../period.ts';

/** CSV of the quality record: one row per rollback in the period. */
export const GET: RequestHandler = async ({ url }) => {
	const period = readPeriod(url);
	const report = await getQuality(readScope(url), period.start, period.end);
	return csvDownload('rollbacks', toCsv(QUALITY_CSV_COLUMNS, qualityRecords(report)));
};
