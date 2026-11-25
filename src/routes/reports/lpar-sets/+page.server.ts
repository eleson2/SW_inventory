import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db, createAuditLog } from '#lib/server/db.ts';
import { loadFilterOptions } from '#lib/server/report-scope.ts';

export const load: PageServerLoad = async () => {
	const options = await loadFilterOptions();
	return { sets: options.sets, customers: options.customers, lpars: options.lpars };
};

/** Validated name, description and LPAR ids from a set form, or an error message. */
async function readSetForm(form: FormData, ownId?: string) {
	const name = String(form.get('name') ?? '').trim();
	const description = String(form.get('description') ?? '').trim() || null;
	const ids = [...new Set(form.getAll('lpar').map(String).filter(Boolean))];
	if (!name || name.length > 100) return { error: 'Name is required (at most 100 characters).' };
	if (ids.length === 0) return { error: 'Tick at least one LPAR.' };
	const clash = await db.lpar_sets.findFirst({ where: { name, ...(ownId && { id: { not: ownId } }) } });
	if (clash) return { error: `A set named "${name}" already exists.` };
	const lpars = await db.lpars.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } });
	if (lpars.length !== ids.length) return { error: 'Some LPARs no longer exist; reload the page.' };
	return { name, description, ids };
}

/** Only redirect back into the app's own report pages. */
function safeRedirect(value: FormDataEntryValue | null) {
	const target = String(value ?? '');
	return target.startsWith('/reports') && !target.startsWith('//') ? target : '/reports/lpar-sets';
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const input = await readSetForm(form);
		if ('error' in input) return fail(400, { error: input.error });
		const set = await db.lpar_sets.create({
			data: {
				name: input.name,
				description: input.description,
				members: { create: input.ids.map((lpar_id) => ({ lpar_id })) }
			}
		});
		await createAuditLog('lpar_set', set.id, 'create', { name: set.name, lpar_ids: input.ids });
		const target = new URL(safeRedirect(form.get('redirectTo')), 'http://x');
		if (target.pathname !== '/reports/lpar-sets') target.searchParams.set('set', set.id);
		redirect(303, target.pathname + target.search);
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const existing = await db.lpar_sets.findUnique({ where: { id } });
		if (!existing) return fail(404, { error: 'That set no longer exists.' });
		const input = await readSetForm(form, id);
		if ('error' in input) return fail(400, { error: input.error, id });
		await db.$transaction([
			db.lpar_set_members.deleteMany({ where: { set_id: id } }),
			db.lpar_sets.update({
				where: { id },
				data: {
					name: input.name,
					description: input.description,
					members: { create: input.ids.map((lpar_id) => ({ lpar_id })) }
				}
			})
		]);
		await createAuditLog('lpar_set', id, 'update', {
			before: { name: existing.name },
			after: { name: input.name, lpar_ids: input.ids }
		});
		return { saved: id };
	},

	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const existing = await db.lpar_sets.findUnique({ where: { id }, include: { members: true } });
		if (!existing) return fail(404, { error: 'That set no longer exists.' });
		await db.lpar_sets.delete({ where: { id } });
		await createAuditLog('lpar_set', id, 'delete', {
			name: existing.name,
			lpar_ids: existing.members.map((m) => m.lpar_id)
		});
		return { deleted: existing.name };
	}
};
