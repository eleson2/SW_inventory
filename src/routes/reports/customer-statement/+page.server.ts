import type { PageServerLoad } from './$types';
import { getInstalledMatrix, getStatementChanges } from '#lib/server/reports.ts';
import { loadFilterOptions, readScope } from '#lib/server/report-scope.ts';

const DAY = 86_400_000;

/** ?since=YYYY-MM-DD, default 90 days ago */
function readSince(url: URL) {
	const raw = url.searchParams.get('since');
	const parsed = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : null;
	const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.now() - 90 * DAY);
	return since.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ url }) => {
	const scope = readScope(url);
	const since = readSince(url);
	const options = await loadFilterOptions();
	if (scope.customerIds.length === 0) return { scope, options, since, matrix: null, changes: [] };

	const matrix = await getInstalledMatrix(scope);
	const changes = await getStatementChanges(
		matrix.lpars.map((l) => l.id),
		matrix.vendors.flatMap((v) => v.rows.map((r) => r.software.id)),
		new Date(`${since}T00:00:00Z`)
	);
	return { scope, options, since, matrix, changes };
};
