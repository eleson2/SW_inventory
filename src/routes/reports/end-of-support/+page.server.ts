import type { PageServerLoad } from './$types';
import { getEndOfSupport } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, report] = await Promise.all([loadFilterOptions(), getEndOfSupport(scope)]);
	return { scope, options, report };
};
