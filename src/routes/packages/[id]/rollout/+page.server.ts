import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { backfillRollouts, planRollouts, RolloutError, updateRollouts } from '#lib/server/rollouts.ts';

export const load: PageServerLoad = async ({ params }) => {
	await backfillRollouts();
	const pkg = await db.packages.findUnique({
		where: { id: params.id },
		select: { id: true, code: true, name: true, version: true, release_date: true, active: true }
	});
	if (!pkg) error(404, 'Package not found');
	const [rollouts, lpars] = await Promise.all([
		db.lpar_package_rollouts.findMany({
			where: { package_id: params.id },
			include: {
				lpar: { select: { id: true, code: true, name: true, customers: { select: { id: true, code: true, name: true } } } }
			}
		}),
		db.lpars.findMany({
			where: { active: true, customers: { active: true } },
			select: {
				id: true,
				code: true,
				name: true,
				customers: { select: { id: true, name: true } },
				packages: { select: { code: true, version: true } }
			},
			orderBy: { code: 'asc' }
		})
	]);
	return { pkg, rollouts, lpars };
};

/** YYYY-MM-DD -> Date (UTC midnight); '' -> null; anything else -> undefined (invalid) */
function readDate(value: FormDataEntryValue | null): Date | null | undefined {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
	const d = new Date(`${raw}T00:00:00Z`);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

export const actions: Actions = {
	plan: async ({ params, request }) => {
		const form = await request.formData();
		const lparIds = form.getAll('lpar').map(String).filter(Boolean);
		const plannedDate = readDate(form.get('planned_date'));
		const notes = String(form.get('notes') ?? '').trim().slice(0, 500) || null;
		if (lparIds.length === 0) return fail(400, { message: 'Pick at least one LPAR' });
		if (plannedDate === undefined) return fail(400, { message: 'Planned date is not a valid date' });
		const { added, skipped } = await planRollouts(params.id, lparIds, plannedDate, notes);
		return {
			message: `Rollout ${plannedDate ? 'planned' : 'initiated'} for ${added} LPAR(s)` +
				(skipped ? `; ${skipped} already had a rollout of this package` : '')
		};
	},

	setDate: async ({ params, request }) => {
		const form = await request.formData();
		const ids = form.getAll('id').map(String).filter(Boolean);
		if (ids.length === 0) return fail(400, { message: 'Pick at least one rollout' });
		const plannedDate = readDate(form.get('planned_date'));
		if (plannedDate === undefined) return fail(400, { message: 'Planned date is not a valid date' });
		return change(params.id, ids, { plannedDate }, (n) =>
			plannedDate ? `Planned date set for ${n} rollout(s)` : `Planned date cleared for ${n} rollout(s)`
		);
	},

	cancel: async ({ params, request }) => {
		const ids = (await request.formData()).getAll('id').map(String).filter(Boolean);
		if (ids.length === 0) return fail(400, { message: 'Pick at least one rollout' });
		return change(params.id, ids, { cancel: true }, (n) => `Cancelled ${n} rollout(s)`);
	}
};

async function change(packageId: string, ids: string[], what: Parameters<typeof updateRollouts>[2], done: (n: number) => string) {
	try {
		return { message: done(await updateRollouts(packageId, ids, what)) };
	} catch (e) {
		if (e instanceof RolloutError) return fail(400, { message: e.message });
		throw e;
	}
}
