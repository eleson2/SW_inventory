import type { PageServerLoad } from './$types';
import { getTrends } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';
import { readTrendParams } from './params.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = { ...readScope(url), asOf: null }; // a series of month ends, not one past date
	const { months, groupBy } = readTrendParams(url);
	const [options, report] = await Promise.all([loadFilterOptions(), getTrends(scope, months)]);
	return { scope, options, report, months, groupBy };
};
