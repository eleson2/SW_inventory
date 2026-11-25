/**
 * Vendor installed base (report R3): per product and release, how many LPARs and customers
 * run it, with the PTF range. Pure functions; the database query is in #lib/server/reports.ts.
 */
import { comparePtfLevels, compareVersions, equivalentVersion } from './version-parser.ts';

export interface BaseCustomer {
	id: string;
	code: string;
	name: string;
}
export interface BaseLpar {
	id: string;
	code: string;
	customer: BaseCustomer;
}
export interface BaseSoftware {
	id: string;
	name: string;
	product_code: string | null;
	vendor: { id: string; code: string; name: string };
	/** Version of the product's current release (software.current_version), if any */
	current_version: string | null;
	/** Known versions, to write installs in the inventory's notation ("6.1" -> "V6R1M0") */
	versions: { version: string; vendor_version: string | null }[];
}
export interface BaseInstall {
	lpar_id: string;
	software_id: string;
	version: string;
	ptf_level: string | null;
}

export interface PtfRange {
	oldest: string | null;
	newest: string | null;
}
export interface BaseRelease extends PtfRange {
	release: string;
	isCurrent: boolean;
	lparCount: number;
	customerCount: number;
	/** Share of the product's LPARs on this release, 0..1 */
	share: number;
	lparCodes: string[];
	/** Per customer id: its LPARs on this release and their PTF range */
	byCustomer: Record<string, PtfRange & { lparCodes: string[] }>;
}
export interface BaseProduct {
	software: BaseSoftware;
	lparCount: number;
	customerCount: number;
	/** Newest release first */
	releases: BaseRelease[];
}
export interface VendorBase {
	totals: {
		products: number;
		lpars: number;
		customers: number;
		installs: number;
		/** Installs on their product's current release */
		onCurrent: number;
	};
	/** Customers with at least one install in scope, by name */
	customers: BaseCustomer[];
	vendors: { vendor: BaseSoftware['vendor']; products: BaseProduct[] }[];
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** The release an install belongs to, in the inventory's notation where known. */
export function releaseOf(install: { version: string }, software: Pick<BaseSoftware, 'versions'>): string {
	const v = install.version.trim();
	const known = software.versions.find(
		(k) => equivalentVersion(k.version, v) || (!!k.vendor_version && equivalentVersion(k.vendor_version, v))
	);
	return known?.version ?? v;
}

function ptfRange(levels: (string | null)[]): PtfRange {
	const sorted = levels.filter((p): p is string => !!p).sort(comparePtfLevels);
	return { oldest: sorted[0] ?? null, newest: sorted.at(-1) ?? null };
}

export function buildVendorBase(input: {
	lpars: BaseLpar[];
	software: BaseSoftware[];
	installs: BaseInstall[];
}): VendorBase {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));

	// software id -> release -> installs
	const grouped = new Map<string, Map<string, { lpar: BaseLpar; ptf: string | null }[]>>();
	const allLpars = new Set<string>();
	const allCustomers = new Map<string, BaseCustomer>();
	let installs = 0;
	let onCurrent = 0;
	for (const install of input.installs) {
		const lpar = lparById.get(install.lpar_id);
		const software = softwareById.get(install.software_id);
		if (!lpar || !software) continue; // outside the scope
		const release = releaseOf(install, software);
		let releases = grouped.get(software.id);
		if (!releases) grouped.set(software.id, (releases = new Map()));
		releases.set(release, [...(releases.get(release) ?? []), { lpar, ptf: install.ptf_level }]);
		allLpars.add(lpar.id);
		allCustomers.set(lpar.customer.id, lpar.customer);
		installs++;
		if (software.current_version && equivalentVersion(software.current_version, release)) onCurrent++;
	}

	const vendors = new Map<string, VendorBase['vendors'][number]>();
	for (const [softwareId, releases] of grouped) {
		const software = softwareById.get(softwareId)!;
		const everyone = [...releases.values()].flat();
		const lparCount = new Set(everyone.map((i) => i.lpar.id)).size;
		const product: BaseProduct = {
			software,
			lparCount,
			customerCount: new Set(everyone.map((i) => i.lpar.customer.id)).size,
			releases: [...releases]
				.map(([release, list]): BaseRelease => {
					const byCustomer: BaseRelease['byCustomer'] = {};
					for (const customerId of new Set(list.map((i) => i.lpar.customer.id))) {
						const mine = list.filter((i) => i.lpar.customer.id === customerId);
						byCustomer[customerId] = {
							lparCodes: mine.map((i) => i.lpar.code).sort(byText),
							...ptfRange(mine.map((i) => i.ptf))
						};
					}
					return {
						release,
						isCurrent: !!software.current_version && equivalentVersion(software.current_version, release),
						lparCount: list.length,
						customerCount: Object.keys(byCustomer).length,
						share: lparCount ? list.length / lparCount : 0,
						lparCodes: list.map((i) => i.lpar.code).sort(byText),
						byCustomer,
						...ptfRange(list.map((i) => i.ptf))
					};
				})
				.sort((a, b) => compareVersions(b.release, a.release))
		};
		let group = vendors.get(software.vendor.id);
		if (!group) vendors.set(software.vendor.id, (group = { vendor: software.vendor, products: [] }));
		group.products.push(product);
	}

	const groups = [...vendors.values()].sort((a, b) => byText(a.vendor.name, b.vendor.name));
	for (const g of groups) g.products.sort((a, b) => byText(a.software.name, b.software.name));
	return {
		totals: {
			products: grouped.size,
			lpars: allLpars.size,
			customers: allCustomers.size,
			installs,
			onCurrent
		},
		customers: [...allCustomers.values()].sort((a, b) => byText(a.name, b.name)),
		vendors: groups
	};
}

export const VENDOR_BASE_CSV_COLUMNS = [
	'vendor',
	'product',
	'product_code',
	'release',
	'current_release',
	'customer',
	'customer_code',
	'lpar_count',
	'lpars',
	'oldest_ptf',
	'newest_ptf'
] as const;

/** One record per product x release x customer. */
export function vendorBaseRecords(base: VendorBase): Record<(typeof VENDOR_BASE_CSV_COLUMNS)[number], string>[] {
	const customers = new Map(base.customers.map((c) => [c.id, c]));
	const out: Record<(typeof VENDOR_BASE_CSV_COLUMNS)[number], string>[] = [];
	for (const { vendor, products } of base.vendors) {
		for (const { software, releases } of products) {
			for (const r of releases) {
				for (const customer of base.customers) {
					const c = r.byCustomer[customer.id];
					if (!c) continue;
					out.push({
						vendor: vendor.name,
						product: software.name,
						product_code: software.product_code ?? '',
						release: r.release,
						current_release: r.isCurrent ? 'yes' : 'no',
						customer: customers.get(customer.id)!.name,
						customer_code: customer.code,
						lpar_count: String(c.lparCodes.length),
						lpars: c.lparCodes.join(' '),
						oldest_ptf: c.oldest ?? '',
						newest_ptf: c.newest ?? ''
					});
				}
			}
		}
	}
	return out;
}
