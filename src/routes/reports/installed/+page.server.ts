import type { PageServerLoad } from './$types';
import { getInstalledMatrix } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, matrix] = await Promise.all([loadFilterOptions(), getInstalledMatrix(scope)]);
	return { scope, options, matrix };
};
