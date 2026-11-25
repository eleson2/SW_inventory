import type { PageServerLoad } from './$types';
import { getWhereUsed } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

/** ?product=<software id> (a list, so several products can be allowed later) &release=<release> */
export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const products = url.searchParams.getAll('product').filter(Boolean);
	const [options, report] = await Promise.all([loadFilterOptions(), getWhereUsed(scope, products)]);
	return { scope, options, products, release: url.searchParams.get('release') ?? '', report };
};
