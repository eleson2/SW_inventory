import type { PageServerLoad } from './$types';
import { getAuditDefence } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, report] = await Promise.all([loadFilterOptions(), getAuditDefence(scope)]);
	return { scope, options, report, showRemoved: url.searchParams.get('removed') !== '0' };
};
