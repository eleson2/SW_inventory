import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db, createAuditLog } from '#lib/server/db.ts';
import {
	SUGGESTED_CATEGORIES,
	categoryChanges,
	categoryNameError,
	cleanCategoryName,
	sameCategoryName
} from '#lib/utils/software-category.ts';

export const load: PageServerLoad = async () => {
	const [categories, software] = await Promise.all([
		db.software_categories.findMany({
			orderBy: { name: 'asc' },
			include: { _count: { select: { software: { where: { active: true } } } } }
		}),
		db.software.findMany({
			where: { active: true },
			select: { id: true, name: true, product_code: true, category_id: true, vendors: { select: { id: true, name: true } } },
			orderBy: [{ vendors: { name: 'asc' } }, { name: 'asc' }]
		})
	]);
	return {
		categories: categories.map(({ _count, ...c }) => ({ ...c, products: _count.software })),
		software,
		suggested: SUGGESTED_CATEGORIES
	};
};

async function readCategoryForm(form: FormData, ownId?: string) {
	const name = cleanCategoryName(String(form.get('name') ?? ''));
	const description = String(form.get('description') ?? '').trim() || null;
	const others = await db.software_categories.findMany({
		where: ownId ? { id: { not: ownId } } : {},
		select: { name: true }
	});
	const error = categoryNameError(name, others.map((o) => o.name));
	return error ? { error } : { name, description };
}

export const actions: Actions = {
	create: async ({ request }) => {
		const input = await readCategoryForm(await request.formData());
		if ('error' in input) return fail(400, { error: input.error });
		const category = await db.software_categories.create({ data: input });
		await createAuditLog('software_category', category.id, 'create', input);
		return { message: `Added "${category.name}".` };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const existing = await db.software_categories.findUnique({ where: { id } });
		if (!existing) return fail(404, { error: 'That category no longer exists.' });
		const input = await readCategoryForm(form, id);
		if ('error' in input) return fail(400, { error: input.error, id });
		await db.software_categories.update({ where: { id }, data: input });
		await createAuditLog('software_category', id, 'update', {
			before: { name: existing.name, description: existing.description },
			after: input
		});
		return { message: `Saved "${input.name}".` };
	},

	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const existing = await db.software_categories.findUnique({ where: { id } });
		if (!existing) return fail(404, { error: 'That category no longer exists.' });
		const products = await db.software.findMany({ where: { category_id: id }, select: { id: true } });
		await db.$transaction([
			db.software.updateMany({ where: { category_id: id }, data: { category_id: null } }),
			db.software_categories.delete({ where: { id } })
		]);
		await createAuditLog('software_category', id, 'delete', {
			name: existing.name,
			unclassified_software_ids: products.map((p) => p.id)
		});
		return {
			message: `Deleted "${existing.name}"${products.length ? `; ${products.length} product(s) are now unclassified` : ''}.`
		};
	},

	addSuggested: async () => {
		const existing = (await db.software_categories.findMany({ select: { name: true } })).map((c) => c.name);
		const missing = SUGGESTED_CATEGORIES.filter((name) => !existing.some((e) => sameCategoryName(e, name)));
		for (const name of missing) {
			const category = await db.software_categories.create({ data: { name } });
			await createAuditLog('software_category', category.id, 'create', { name, source: 'suggested' });
		}
		return { message: missing.length ? `Added ${missing.length} categories.` : 'All suggested categories already exist.' };
	},

	classify: async ({ request }) => {
		const form = await request.formData();
		const submitted = new Map<string, string>();
		for (const [key, value] of form) {
			if (key.startsWith('cat.')) submitted.set(key.slice(4), String(value));
		}
		const [software, categories] = await Promise.all([
			db.software.findMany({ where: { id: { in: [...submitted.keys()] } }, select: { id: true, category_id: true } }),
			db.software_categories.findMany({ select: { id: true } })
		]);
		const changes = categoryChanges(
			new Map(software.map((s) => [s.id, s.category_id])),
			submitted,
			new Set(categories.map((c) => c.id))
		);
		if (changes.length === 0) return { message: 'Nothing changed.' };
		await db.$transaction(
			changes.map((c) => db.software.update({ where: { id: c.softwareId }, data: { category_id: c.to } }))
		);
		for (const c of changes) {
			await createAuditLog('software', c.softwareId, 'update', {
				action: 'classify',
				before: { category_id: c.from },
				after: { category_id: c.to }
			});
		}
		return { message: `Saved the category of ${changes.length} product${changes.length === 1 ? '' : 's'}.` };
	}
};
