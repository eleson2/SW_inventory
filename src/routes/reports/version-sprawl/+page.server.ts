import type { PageServerLoad } from './$types';
import { getVersionSprawl } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, rows] = await Promise.all([loadFilterOptions(), getVersionSprawl(scope)]);
	return { scope, options, rows };
};
