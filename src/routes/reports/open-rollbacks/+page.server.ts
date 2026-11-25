import type { PageServerLoad } from './$types';
import { getOpenRollbacks } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, rows] = await Promise.all([loadFilterOptions(), getOpenRollbacks(scope)]);
	return { scope, options, rows };
};
