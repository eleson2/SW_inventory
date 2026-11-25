import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { getRolloutProgress } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

/** ?package=<id> (several allowed) narrows to those packages */
export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const packageIds = url.searchParams.getAll('package').filter(Boolean);
	const [options, groups, packages] = await Promise.all([
		loadFilterOptions(),
		getRolloutProgress(scope, packageIds),
		db.packages.findMany({
			where: { rollouts: { some: {} } },
			select: { id: true, code: true, name: true, version: true },
			orderBy: { release_date: 'desc' }
		})
	]);
	return { scope, options, groups, packages, packageIds };
};
