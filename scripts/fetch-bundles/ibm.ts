/**
 * IBM z/OS Consolidated Service Test (CST) / Recommended Service Upgrade (RSU).
 *
 * Public documents:
 *   https://public.dhe.ibm.com/systems/z/servicetest/RSU<yymm>.pdf          report per level
 *   https://public.dhe.ibm.com/eserver/zseries/assigns/rsu<yymm>.txt        ++ASSIGN PTF list
 *
 * Quarterly reports (RSUyy03/06/09/12) list the tested products and releases under
 * "What Service was Installed". Monthly addenda only list HIPER/PE fixes and refer to
 * their quarterly report, which is then used for the product list.
 * The ++ASSIGN list has PTF numbers but no product, so it only gives a total count.
 */
import { fetchBytes, fetchText, findWrittenDate, firstOfMonth, NotFoundError, pdfPages, type BundleCsvRow } from './common.ts';
import type { FetchResult } from './broadcom.ts';

export const RSU_REPORT_URL = 'https://public.dhe.ibm.com/systems/z/servicetest';
export const RSU_ASSIGN_URL = 'https://public.dhe.ibm.com/eserver/zseries/assigns';

export interface RsuProduct {
	name: string;
	version: string;
	/** Product name without spaces/punctuation, used as software.product_code ("CICS TS" -> "CICSTS") */
	code: string;
}

/** WAS is listed per fix pack ("- Fix pack 9.0.5.28 w/ ifixes", since RSU2609) under an unbulleted name */
const WAS_NAME = 'WebSphere Application Server for z/OS';

export function productCodeFromName(name: string): string {
	return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "V12" -> "12", "V9.3.5" -> "9.3.5", "V2R4" stays (VRM form) */
function normalizeVersion(token: string): string {
	return /^V\d+R\d+/i.test(token) ? token.toUpperCase() : token.replace(/^V/i, '');
}

/** Products and releases from the "What Service was Installed" section of a quarterly report. */
export function parseRsuProducts(pages: string[]): RsuProduct[] {
	const text = pages.join('\n');
	const start = text.search(/What Service was Installed/i);
	if (start < 0) return [];
	const rest = text.slice(start);
	const end = rest.search(/\n\s*(Roll-out of|Appendix A|Highlights of)/i);
	const section = end > 0 ? rest.slice(0, end) : rest;

	const products: RsuProduct[] = [];
	for (const rawLine of section.split('\n')) {
		const line = rawLine.trim();
		if (!/^[-•]\s+/.test(line) || /\bbuild\b/i.test(line)) continue; // Java build sub-lines of WAS
		const fixPack = /^[-•]\s+Fix ?pack\s+(\d+(?:\.\d+)+)/i.exec(line);
		const match = fixPack
			? ([line, WAS_NAME, fixPack[1]] as const)
			: /^[-•]\s+(.+?)\s+(V\d+R\d+(?:M\d+)?|V?\d+(?:\.\d+)+|V\d+)(?=\s|$)/i.exec(line);
		if (!match) continue;
		const name = match[1].trim();
		const product = { name, version: normalizeVersion(match[2]), code: productCodeFromName(name) };
		if (!products.some((p) => p.code === product.code && p.version === product.version)) {
			products.push(product);
		}
	}
	return products;
}

export function isQuarterly(yymm: string): boolean {
	return ['03', '06', '09', '12'].includes(yymm.slice(2));
}

/** Quarterly report referenced by a monthly addendum (e.g. RSU2510 -> RSU2509) */
export function referencedQuarterly(pages: string[], yymm: string): string | null {
	const refs = [...pages.join('\n').matchAll(/servicetest\/RSU(\d{4})\.pdf/gi)]
		.map((m) => m[1])
		.filter((ref) => ref !== yymm && isQuarterly(ref));
	return refs[0] ?? null;
}

export function countAssignedPtfs(assignText: string): number {
	return (assignText.match(/\+\+ASSIGN\s+SOURCEID/gi) ?? []).length;
}

export async function fetchRsu(
	yymm: string,
	vendorCode = 'IBM',
	log: (message: string) => void = () => {}
): Promise<FetchResult> {
	const level = `RSU${yymm}`;
	const warnings: string[] = [];
	const reportUrl = `${RSU_REPORT_URL}/${level}.pdf`;

	let pages: string[];
	try {
		pages = await pdfPages(await fetchBytes(reportUrl));
	} catch (error) {
		if (error instanceof NotFoundError) {
			throw new Error(`${level} report not found at ${reportUrl} (not published yet?)`);
		}
		throw error;
	}
	const releaseDate = findWrittenDate(pages[0] ?? '') ?? firstOfMonth(yymm);
	log(`  ${level} report dated ${releaseDate}`);

	let products = parseRsuProducts(pages);
	let productSource = level;
	if (products.length === 0) {
		const quarterly = isQuarterly(yymm) ? null : referencedQuarterly(pages, yymm);
		if (!quarterly) throw new Error(`No product list found in ${level} and no quarterly report referenced`);
		productSource = `RSU${quarterly}`;
		log(`  monthly addendum; products from quarterly report ${productSource}`);
		products = parseRsuProducts(await pdfPages(await fetchBytes(`${RSU_REPORT_URL}/${productSource}.pdf`)));
	}
	if (products.length === 0) throw new Error(`Could not read the product list from ${productSource}`);

	let ptfNote = '';
	try {
		const count = countAssignedPtfs(await fetchText(`${RSU_ASSIGN_URL}/rsu${yymm}.txt`));
		ptfNote = `; ${count} PTFs assigned ${level} (all products)`;
		log(`  ${count} PTFs in ++ASSIGN list`);
	} catch (error) {
		warnings.push(`PTF list rsu${yymm}.txt not available: ${error instanceof Error ? error.message : error}`);
	}

	const rows: BundleCsvRow[] = products.map((product) => ({
		vendor_code: vendorCode,
		bundle_code: level,
		bundle_name: `IBM CST ${level}`,
		bundle_type: 'RSU',
		release_date: releaseDate,
		product_code: product.code,
		product_name: product.name,
		version: product.version,
		ptf_level: level,
		notes: `CST tested (${productSource} product list)${ptfNote}`,
		source_url: reportUrl
	}));
	for (const product of products) log(`  ${product.code.padEnd(20)} ${product.name} ${product.version}`);

	return { rows, warnings };
}
