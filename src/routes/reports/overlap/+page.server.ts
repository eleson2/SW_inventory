import type { PageServerLoad } from './$types';
import { getOverlap } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const sameVendor = url.searchParams.get('same') === '1';
	const [options, report] = await Promise.all([loadFilterOptions(), getOverlap(scope, sameVendor)]);
	return { scope, options, report, sameVendor, perLpar: url.searchParams.get('view') === 'lpar' };
};
