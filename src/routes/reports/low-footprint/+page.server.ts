import type { PageServerLoad } from './$types';
import { getLowFootprint } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';
import { readMaxLpars } from '#lib/utils/low-footprint.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, report] = await Promise.all([
		loadFilterOptions(),
		getLowFootprint(scope, readMaxLpars(url.searchParams.get('max')))
	]);
	return { scope, options, report };
};
