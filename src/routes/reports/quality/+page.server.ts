import type { PageServerLoad } from './$types';
import { getQuality } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';
import { readPeriod } from './period.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const period = readPeriod(url);
	const [options, report] = await Promise.all([loadFilterOptions(), getQuality(scope, period.start, period.end)]);
	return { scope, options, report, from: period.from, to: period.to };
};
