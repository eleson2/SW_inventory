/**
 * Shared report scope: which LPARs and which software a report covers, read from the URL.
 *
 *   ?customer=<id>&customer=<id>   customers (none = all)
 *   &lpar=<id>&lpar=<id>           ticked LPARs within those customers (none = all of them)
 *   &vendor=<id>  &software=<id>   narrow the software shown (none = all)
 *   &set=<id>                      the LPAR set the selection came from (label only)
 *
 * Used by every report so filters behave the same everywhere (see ReportFilters.svelte).
 */
import { db } from './db.ts';

export interface ReportScope {
	customerIds: string[];
	lparIds: string[];
	vendorIds: string[];
	softwareIds: string[];
	setId: string | null;
}

export function readScope(url: URL): ReportScope {
	const all = (key: string) => [...new Set(url.searchParams.getAll(key).filter(Boolean))];
	return {
		customerIds: all('customer'),
		lparIds: all('lpar'),
		vendorIds: all('vendor'),
		softwareIds: all('software'),
		setId: url.searchParams.get('set') || null
	};
}

/** Prisma `where` for the LPARs in scope (active LPARs of active customers). */
export function lparWhere(scope: ReportScope) {
	return {
		active: true,
		customers: { active: true },
		...(scope.customerIds.length > 0 && { customer_id: { in: scope.customerIds } }),
		...(scope.lparIds.length > 0 && { id: { in: scope.lparIds } })
	};
}

/** Prisma `where` for the software in scope (active software of active vendors). */
export function softwareWhere(scope: ReportScope) {
	return {
		active: true,
		vendors: { active: true },
		...(scope.vendorIds.length > 0 && { vendor_id: { in: scope.vendorIds } }),
		...(scope.softwareIds.length > 0 && { id: { in: scope.softwareIds } })
	};
}

export type ReportFilterOptions = Awaited<ReturnType<typeof loadFilterOptions>>;

/** Everything the filter bar offers: customers, their LPARs (with installed software, for
 * "Only LPARs running"), vendors, software and saved LPAR sets. */
export async function loadFilterOptions() {
	const [customers, lpars, vendors, software, sets] = await Promise.all([
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
			select: { id: true, name: true, vendor_id: true },
			orderBy: { name: 'asc' }
		}),
		db.lpar_sets.findMany({
			select: { id: true, name: true, description: true, members: { select: { lpar_id: true } } },
			orderBy: { name: 'asc' }
		})
	]);
	return {
		customers,
		lpars: lpars.map(({ lpar_software, ...l }) => ({ ...l, softwareIds: lpar_software.map((s) => s.software_id) })),
		vendors,
		software,
		sets: sets.map(({ members, ...s }) => ({ ...s, lparIds: members.map((m) => m.lpar_id) }))
	};
}
