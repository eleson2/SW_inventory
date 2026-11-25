import type { PageServerLoad } from './$types';
import { getMaintenanceUptake } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const [options, vendors] = await Promise.all([loadFilterOptions(), getMaintenanceUptake(scope)]);
	return { scope, options, vendors };
};
