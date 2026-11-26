/**
 * V3 overlapping products: installed products of the same category from different vendors
 * (optionally also the same vendor), for consolidation and negotiation. Portfolio level: a
 * category overlaps when such products are installed anywhere in scope; LPARs running two
 * of them side by side are counted and highlighted. Pure functions; query in #lib/server/reports.ts.
 */

export interface OverlapLpar {
	id: string;
	code: string;
	name: string;
	customer: { id: string; code: string; name: string };
}

export interface OverlapSoftware {
	id: string;
	name: string;
	vendor: { id: string; code: string; name: string };
	category: { id: string; name: string } | null;
}

export interface OverlapProduct {
	software: OverlapSoftware;
	lparIds: string[];
	customers: number;
	/** Share of the LPARs running any product of the category */
	share: number;
	/** Other products of the category on the same LPARs, with the number of shared LPARs */
	alsoOn: { software: OverlapSoftware; lpars: number }[];
}

export interface OverlapCategory {
	category: { id: string; name: string };
	vendors: number;
	products: OverlapProduct[];
	/** LPARs running any product of the category */
	lparIds: string[];
	/** LPARs running two overlapping products of the category side by side */
	sideBySide: string[];
}

export interface OverlapReport {
	categories: OverlapCategory[];
	lpars: OverlapLpar[];
	/** Installed products in scope without a category (not included) */
	unclassified: number;
	productsInvolved: number;
	lparsWithOverlap: number;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Two products overlap: always across vendors, within a vendor only when asked */
const overlaps = (a: OverlapSoftware, b: OverlapSoftware, sameVendor: boolean) =>
	a.id !== b.id && (sameVendor || a.vendor.id !== b.vendor.id);

export function buildOverlap(
	input: { lpars: OverlapLpar[]; software: OverlapSoftware[]; installs: { lpar_id: string; software_id: string }[] },
	sameVendor = false
): OverlapReport {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));

	// software id -> LPARs running it (in scope)
	const running = new Map<string, Set<string>>();
	for (const i of input.installs) {
		if (!lparById.has(i.lpar_id) || !softwareById.has(i.software_id)) continue;
		let set = running.get(i.software_id);
		if (!set) running.set(i.software_id, (set = new Set()));
		set.add(i.lpar_id);
	}

	const byCategory = new Map<string, OverlapSoftware[]>();
	let unclassified = 0;
	for (const id of running.keys()) {
		const s = softwareById.get(id)!;
		if (!s.category) {
			unclassified++;
			continue;
		}
		byCategory.set(s.category.id, [...(byCategory.get(s.category.id) ?? []), s]);
	}

	const categories: OverlapCategory[] = [];
	for (const list of byCategory.values()) {
		const vendors = new Set(list.map((s) => s.vendor.id)).size;
		if (vendors < 2 && !(sameVendor && list.length > 1)) continue;

		const lparIds = [...new Set(list.flatMap((s) => [...running.get(s.id)!]))];
		const sideBySide = lparIds.filter((lparId) => {
			const here = list.filter((s) => running.get(s.id)!.has(lparId));
			return here.some((a) => here.some((b) => overlaps(a, b, sameVendor)));
		});
		const products = list
			.map((s): OverlapProduct => {
				const mine = running.get(s.id)!;
				return {
					software: s,
					lparIds: [...mine],
					customers: new Set([...mine].map((id) => lparById.get(id)!.customer.id)).size,
					share: mine.size / lparIds.length,
					alsoOn: list
						.filter((o) => overlaps(s, o, sameVendor))
						.map((o) => ({ software: o, lpars: [...running.get(o.id)!].filter((id) => mine.has(id)).length }))
						.filter((o) => o.lpars > 0)
						.sort((a, b) => b.lpars - a.lpars || byText(a.software.name, b.software.name))
				};
			})
			.sort((a, b) => b.lparIds.length - a.lparIds.length || byText(a.software.name, b.software.name));
		categories.push({ category: list[0].category!, vendors, products, lparIds, sideBySide });
	}
	categories.sort(
		(a, b) =>
			b.sideBySide.length - a.sideBySide.length ||
			b.products.length - a.products.length ||
			byText(a.category.name, b.category.name)
	);

	return {
		categories,
		lpars: [...lparById.values()].sort((a, b) => byText(a.customer.name, b.customer.name) || byText(a.code, b.code)),
		unclassified,
		productsInvolved: categories.reduce((n, c) => n + c.products.length, 0),
		lparsWithOverlap: new Set(categories.flatMap((c) => c.sideBySide)).size
	};
}

export const OVERLAP_CSV_COLUMNS = [
	'category',
	'product',
	'vendor',
	'customer',
	'lpar',
	'overlaps_on_lpar'
] as const;

/** CSV rows: one per category x product x LPAR, with the overlapping products on that LPAR */
export function overlapRecords(report: OverlapReport): Record<(typeof OVERLAP_CSV_COLUMNS)[number], string>[] {
	const lparById = new Map(report.lpars.map((l) => [l.id, l]));
	return report.categories.flatMap((c) =>
		c.products.flatMap((p) =>
			p.lparIds
				.map((id) => lparById.get(id)!)
				.sort((a, b) => byText(a.customer.name, b.customer.name) || byText(a.code, b.code))
				.map((l) => ({
					category: c.category.name,
					product: p.software.name,
					vendor: p.software.vendor.name,
					customer: l.customer.name,
					lpar: l.code,
					overlaps_on_lpar: c.products
						.filter((o) => p.alsoOn.some((a) => a.software.id === o.software.id) && o.lparIds.includes(l.id))
						.map((o) => o.software.name)
						.join('; ')
				}))
		)
	);
}
