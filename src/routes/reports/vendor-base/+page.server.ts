import type { PageServerLoad } from './$types';
import { getVendorBase } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, base] = await Promise.all([loadFilterOptions(), getVendorBase(scope)]);
	return { scope, options, base };
};
