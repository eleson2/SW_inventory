import type { RequestHandler } from './$types';
import { getRolloutProgress } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { ROLLOUT_CSV_COLUMNS, rolloutRecords } from '#lib/utils/rollout.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of rollout progress: one row per package x LPAR. */
export const GET: RequestHandler = async ({ url }) => {
	const groups = await getRolloutProgress(readScope(url), url.searchParams.getAll('package').filter(Boolean));
	return csvDownload('rollout', toCsv(ROLLOUT_CSV_COLUMNS, rolloutRecords(groups)));
};
