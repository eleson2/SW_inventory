import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { backfillInstallHistory } from '#lib/server/install-history.ts';
import { endOfDay, installsAt } from '#lib/utils/install-history.ts';

/** D2: every recorded change of what this LPAR has installed, newest first. */
export const load: PageServerLoad = async ({ params, url }) => {
	await backfillInstallHistory();
	const lpar = await db.lpars.findUnique({
		where: { id: params.id },
		select: { id: true, code: true, name: true, customers: { select: { name: true } } }
	});
	if (!lpar) throw error(404, 'LPAR not found');
	const events = await db.lpar_software_history.findMany({
		where: { lpar_id: params.id },
		orderBy: [{ occurred_at: 'desc' }, { created_at: 'desc' }],
		select: {
			id: true,
			event: true,
			from_version: true,
			from_ptf_level: true,
			to_version: true,
			to_ptf_level: true,
			occurred_at: true,
			source: true,
			reason: true,
			reconstructed: true,
			software: { select: { id: true, name: true, vendors: { select: { name: true } } } },
			package: { select: { id: true, code: true, version: true } }
		}
	});
	// X5 point in time: what the LPAR had installed at the end of ?on=YYYY-MM-DD
	const on = url.searchParams.get('on') ?? '';
	const at = endOfDay(on);
	let installedOn: { software: { id: string; name: string; vendor: string }; version: string; ptf_level: string | null; installed: Date; rolledBack: boolean }[] | null = null;
	if (at) {
		const rows = await db.lpar_software_history.findMany({ where: { lpar_id: params.id, occurred_at: { lte: at } } });
		const names = new Map(events.map((e) => [e.software.id, { id: e.software.id, name: e.software.name, vendor: e.software.vendors.name }]));
		installedOn = installsAt(rows, at)
			.map((i) => ({
				software: names.get(i.software_id) ?? { id: i.software_id, name: i.software_id, vendor: '' },
				version: i.current_version,
				ptf_level: i.current_ptf_level,
				installed: i.installed_date,
				rolledBack: i.rolled_back
			}))
			.sort((a, b) => a.software.name.localeCompare(b.software.name));
	}
	return { lpar, events, on: at ? on : '', installedOn };
};
