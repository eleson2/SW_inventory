/**
 * Broadcom CA RS (CARS) service lists.
 *
 * Broadcom publishes one public PDF per product release and CA RS level:
 *   https://ftpdocs.broadcom.com/WebInterface/phpdocs/0/MSPSaccount/CARS/CARS<yymm>/<PRODUCT>.pdf
 * where <PRODUCT> is the product code + release, e.g. AL2121 (CA 7 12.1).
 * Page 1 starts with "<product name> <release> <page>" followed by the PTF list and
 * "The CA RS <yymm> service count for this release is <n>".
 *
 * There is no public index of products per level, so the product codes come from the
 * caller (--products, or software.product_code in the database).
 */
import { fetchBytes, firstOfMonth, NotFoundError, pdfPages, type BundleCsvRow } from './common.ts';

export const CARS_BASE_URL = 'https://ftpdocs.broadcom.com/WebInterface/phpdocs/0/MSPSaccount/CARS';

export interface CarsServiceList {
	productName: string;
	release: string;
	serviceCount: number;
	ptfs: string[];
	hiperCount: number;
}

/** "AL2121" -> "12.1" (fallback when the PDF header has no release) */
export function releaseFromProductCode(code: string): string {
	const digits = /(\d{2})(\d)$/.exec(code);
	return digits ? `${Number(digits[1])}.${digits[2]}` : '';
}

/** Parse the release-level service list from the extracted PDF pages. */
export function parseCarsServiceList(pages: string[], productCode = ''): CarsServiceList {
	const lines = pages.join('\n').split('\n').map((line) => line.trim());

	// Header: "CA 7 12.1 1" -> name "CA 7", release "12.1" (trailing number is the page)
	const header = /^(.*?)\s+(\d+(?:\.\d+)+)\s+\d+$/.exec(lines[0] ?? '');
	const productName = header?.[1] ?? '';
	const release = header?.[2] ?? releaseFromProductCode(productCode);

	const ptfs: string[] = [];
	let hiperCount = 0;
	let serviceCount: number | null = null;
	for (const line of lines) {
		const count = /service count for this release is (\d+)/i.exec(line);
		if (count) {
			serviceCount = Number(count[1]);
			break;
		}
		const ptf = /^([A-Z]{2}\d{5})\s+(.*)$/.exec(line);
		if (ptf) {
			ptfs.push(ptf[1]);
			if (/\bHIP/i.test(ptf[2])) hiperCount++;
		}
	}

	if (!productName && !release) throw new Error('Not a CA RS service list (no product header found)');
	return { productName, release, serviceCount: serviceCount ?? ptfs.length, ptfs, hiperCount };
}

/** Highest PTF number in the list, e.g. LU17806: the product's service level after this CA RS level. */
export function highestPtf(list: CarsServiceList): string | undefined {
	return [...list.ptfs].sort().at(-1);
}

export function carsNotes(list: CarsServiceList): string {
	if (list.serviceCount === 0) return 'No new service in this level';
	const highest = highestPtf(list);
	const hiper = list.hiperCount > 0 ? ` (${list.hiperCount} HIPER)` : '';
	return `${list.serviceCount} PTFs${hiper}${highest ? `, highest ${highest}` : ''}`;
}

export interface FetchResult {
	rows: BundleCsvRow[];
	warnings: string[];
}

export async function fetchCars(
	yymm: string,
	productCodes: string[],
	vendorCode = 'BROADCOM',
	log: (message: string) => void = () => {}
): Promise<FetchResult> {
	const level = `CARS${yymm}`;
	const rows: BundleCsvRow[] = [];
	const warnings: string[] = [];

	for (const rawCode of productCodes) {
		const code = rawCode.trim().toUpperCase();
		if (!code) continue;
		const url = `${CARS_BASE_URL}/${level}/${code}.pdf`;
		try {
			const list = parseCarsServiceList(await pdfPages(await fetchBytes(url)), code);
			log(`  ${code.padEnd(8)} ${list.productName} ${list.release}: ${carsNotes(list)}`);
			rows.push({
				vendor_code: vendorCode,
				bundle_code: level,
				bundle_name: `Broadcom CA RS ${yymm}`,
				bundle_type: 'CARS',
				release_date: firstOfMonth(yymm),
				product_code: code,
				product_name: list.productName,
				version: list.release,
				// The product's own service level, so an unchanged product keeps one version row
				ptf_level: highestPtf(list) ?? level,
				notes: `${level}: ${carsNotes(list)}`,
				source_url: `${CARS_BASE_URL}/${level}/`
			});
		} catch (error) {
			const reason =
				error instanceof NotFoundError
					? 'no service list published (wrong product code, no service this level, or level not out yet)'
					: error instanceof Error
						? error.message
						: String(error);
			warnings.push(`${code}: ${reason}`);
			log(`  ${code.padEnd(8)} skipped: ${reason}`);
		}
	}

	return { rows, warnings };
}
