import type { PageServerLoad } from './$types';
import { getInstalledBase } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';
import { readBaseParams } from './params.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const { months, compare } = readBaseParams(url);
	const [options, base] = await Promise.all([loadFilterOptions(), getInstalledBase(scope, months)]);
	return { scope, options, base, months, compare };
};
