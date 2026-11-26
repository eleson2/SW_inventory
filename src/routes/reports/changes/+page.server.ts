import type { PageServerLoad } from './$types';
import { getChangeHistory } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';
import { readMonthPeriod } from '#lib/utils/change-history.ts';

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const period = readMonthPeriod(url);
	const hidePtf = url.searchParams.get('ptf') === '0';
	const customerView = url.searchParams.get('view') === 'customer';
	const [options, report] = await Promise.all([
		loadFilterOptions(),
		getChangeHistory(scope, period.start, period.end, hidePtf)
	]);
	return { scope, options, report, from: period.from, to: period.to, hidePtf, customerView };
};
