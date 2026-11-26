/**
 * Shared report scope: which LPARs and which software a report covers, read from the URL.
 *
 *   ?customer=<id>&customer=<id>   customers (none = all)
 *   &lpar=<id>&lpar=<id>           ticked LPARs within those customers (none = all of them)
 *   &env=PROD&env=none             LPARs of these environments (none = not set)
 *   &vendor=<id>  &software=<id>   narrow the software shown (none = all)
 *   &category=<id>|none            software of these categories (none = unclassified)
 *   &set=<id>                      the LPAR set the selection came from (label only)
 *
 * Used by every report so filters behave the same everywhere (see ReportFilters.svelte).
 */
import { db } from './db.ts';
import { UNCLASSIFIED } from '#lib/utils/software-category.ts';
import { NO_ENVIRONMENT, isEnvironment } from '#lib/utils/environment.ts';

export interface ReportScope {
	customerIds: string[];
	lparIds: string[];
	/** LPAR environments (PROD/TEST/DEV/DR); NO_ENVIRONMENT ("none") = not set */
	environments: string[];
	vendorIds: string[];
	softwareIds: string[];
	/** Category ids; UNCLASSIFIED ("none") = software without a category */
	categoryIds: string[];
	setId: string | null;
}

export function readScope(url: URL): ReportScope {
	const all = (key: string) => [...new Set(url.searchParams.getAll(key).filter(Boolean))];
	return {
		customerIds: all('customer'),
		lparIds: all('lpar'),
		environments: all('env').filter((e) => isEnvironment(e) || e === NO_ENVIRONMENT),
		vendorIds: all('vendor'),
		softwareIds: all('software'),
		categoryIds: all('category'),
		setId: url.searchParams.get('set') || null
	};
}

/** Prisma `where` for the LPARs in scope (active LPARs of active customers). */
export function lparWhere(scope: ReportScope) {
	return {
		active: true,
		customers: { active: true },
		...(scope.customerIds.length > 0 && { customer_id: { in: scope.customerIds } }),
		...(scope.lparIds.length > 0 && { id: { in: scope.lparIds } }),
		...(scope.environments.length > 0 && { AND: [environmentWhere(scope.environments)] })
	};
}

/** Prisma `where` for the software in scope (active software of active vendors). */
export function softwareWhere(scope: ReportScope) {
	return {
		active: true,
		vendors: { active: true },
		...(scope.vendorIds.length > 0 && { vendor_id: { in: scope.vendorIds } }),
		...(scope.softwareIds.length > 0 && { id: { in: scope.softwareIds } }),
		...(scope.categoryIds.length > 0 && { AND: [categoryWhere(scope.categoryIds)] })
	};
}

function environmentWhere(environments: string[]) {
	const set = environments.filter((e) => e !== NO_ENVIRONMENT);
	if (!environments.includes(NO_ENVIRONMENT)) return { environment: { in: set } };
	return set.length ? { OR: [{ environment: { in: set } }, { environment: null }] } : { environment: null };
}

function categoryWhere(categoryIds: string[]) {
	const ids = categoryIds.filter((id) => id !== UNCLASSIFIED);
	const none = categoryIds.includes(UNCLASSIFIED);
	if (!none) return { category_id: { in: ids } };
	return ids.length ? { OR: [{ category_id: { in: ids } }, { category_id: null }] } : { category_id: null };
}

export type ReportFilterOptions = Awaited<ReturnType<typeof loadFilterOptions>>;

/** Everything the filter bar offers: customers, their LPARs (with installed software, for
 * "Only LPARs running"), vendors, software, categories and saved LPAR sets. */
export async function loadFilterOptions() {
	const [customers, lpars, vendors, software, sets, categories] = await Promise.all([
		db.customers.findMany({
			where: { active: true },
			select: { id: true, code: true, name: true },
			orderBy: { name: 'asc' }
		}),
		db.lpars.findMany({
			where: { active: true, customers: { active: true } },
			select: {
				id: true,
				code: true,
				name: true,
				customer_id: true,
				environment: true,
				lpar_software: { select: { software_id: true } }
			},
			orderBy: { code: 'asc' }
		}),
		db.vendors.findMany({
			where: { active: true },
			select: { id: true, code: true, name: true },
			orderBy: { name: 'asc' }
		}),
		db.software.findMany({
			where: { active: true, vendors: { active: true } },
			select: { id: true, name: true, vendor_id: true, category_id: true },
			orderBy: { name: 'asc' }
		}),
		db.lpar_sets.findMany({
			select: { id: true, name: true, description: true, members: { select: { lpar_id: true } } },
			orderBy: { name: 'asc' }
		}),
		db.software_categories.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
	]);
	return {
		customers,
		lpars: lpars.map(({ lpar_software, ...l }) => ({ ...l, softwareIds: lpar_software.map((s) => s.software_id) })),
		vendors,
		software,
		categories,
		sets: sets.map(({ members, ...s }) => ({ ...s, lparIds: members.map((m) => m.lpar_id) }))
	};
}
