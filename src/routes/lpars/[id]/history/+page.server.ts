import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { backfillInstallHistory } from '#lib/server/install-history.ts';

/** D2: every recorded change of what this LPAR has installed, newest first. */
export const load: PageServerLoad = async ({ params }) => {
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
	return { lpar, events };
};
