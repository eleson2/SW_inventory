/**
 * Parser tests against text extracted from real vendor documents
 * (Broadcom CA RS 2307/2510 service list for CA 7 12.1, IBM RSU2406 and RSU2510 reports).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCarsServiceList, carsNotes, highestPtf, releaseFromProductCode } from './broadcom.ts';
import { parseRsuProducts, referencedQuarterly, countAssignedPtfs, isQuarterly } from './ibm.ts';
import { toCsv, levelYymm, findWrittenDate } from './common.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');
const pagesOf = (name: string) => fixture(name).split('\f');

describe('Broadcom CA RS service list', () => {
	it('reads product, release and PTFs (CARS2307, with HIPER)', () => {
		const list = parseCarsServiceList(pagesOf('cars2307-al2121.txt'), 'AL2121');
		expect(list).toMatchObject({ productName: 'CA 7', release: '12.1', serviceCount: 7, hiperCount: 1 });
		expect(list.ptfs).toEqual(['LU10220', 'LU10459', 'LU10461', 'LU10464', 'LU10540', 'LU10549', 'LU10551']);
		expect(carsNotes(list)).toBe('7 PTFs (1 HIPER), highest LU10551');
	});

	it('stops at the release count and ignores the per-FMID lists (CARS2510)', () => {
		const list = parseCarsServiceList(pagesOf('cars2510-al2121.txt'), 'AL2121');
		expect(list.ptfs).toEqual(['LU17405', 'LU17806']);
		expect(carsNotes(list)).toBe('2 PTFs, highest LU17806');
		expect(highestPtf(list)).toBe('LU17806');
	});

	it('derives the release from the product code', () => {
		expect(releaseFromProductCode('AL2121')).toBe('12.1');
		expect(releaseFromProductCode('CCS150')).toBe('15.0');
	});
});

describe('IBM RSU report', () => {
	it('reads tested products from a quarterly report', () => {
		const products = parseRsuProducts(pagesOf('rsu2406.txt'));
		const byName = (name: string) => products.filter((p) => p.name === name).map((p) => p.version);
		expect(byName('CICS TS')).toEqual(['6.1', '5.6']);
		expect(byName('Db2')).toEqual(['12', '13']);
		expect(byName('z/OS')).toEqual(['V2R4', 'V2R5', '3.1']);
		expect(byName('IRLM')).toEqual(['2.3']);
		expect(byName('IBM MQ')).toEqual(['9.3.5', '9.3.0', '9.2.0']);
		expect(products.find((p) => p.name === 'CICS TS')?.code).toBe('CICSTS');
		expect(products.some((p) => p.name.startsWith('Java 8'))).toBe(false);
	});

	it('reads WebSphere fix-pack bullets as WAS releases (RSU2609 layout)', () => {
		const page = [
			'What Service was Installed',
			'WebSphere Application Server for',
			'z/OS V9',
			'- Fix pack 9.0.5.28 w/ ifixes',
			'9.0.5.15-WS-WASProd-IFPH71757',
			'- Fixpack 8.5.5.29',
			'- CICS TS 6.2'
		].join('\n');
		expect(parseRsuProducts([page])).toEqual([
			{ name: 'WebSphere Application Server for z/OS', version: '9.0.5.28', code: 'WEBSPHEREAPPLICATIONSERVERFORZOS' },
			{ name: 'WebSphere Application Server for z/OS', version: '8.5.5.29', code: 'WEBSPHEREAPPLICATIONSERVERFORZOS' },
			{ name: 'CICS TS', version: '6.2', code: 'CICSTS' }
		]);
	});

	it('finds the quarterly report a monthly addendum refers to', () => {
		const pages = pagesOf('rsu2510.txt');
		expect(parseRsuProducts(pages)).toEqual([]);
		expect(referencedQuarterly(pages, '2510')).toBe('2509');
		expect(findWrittenDate(pages[0])).toBe('2025-11-07');
		expect(isQuarterly('2509')).toBe(true);
		expect(isQuarterly('2510')).toBe(false);
	});

	it('counts ++ASSIGN statements', () => {
		expect(countAssignedPtfs(fixture('rsu2510-assign.txt'))).toBe(3);
	});
});

describe('common helpers', () => {
	it('parses level codes', () => {
		expect(levelYymm('CARS2511')).toBe('2511');
		expect(levelYymm('RSU2512')).toBe('2512');
		expect(() => levelYymm('CARS2513')).toThrow();
	});

	it('writes CSV with quoting', () => {
		const csv = toCsv([
			{
				vendor_code: 'IBM', bundle_code: 'RSU2510', bundle_name: 'IBM CST RSU2510', bundle_type: 'RSU',
				release_date: '2025-11-07', product_code: 'CICSTS', product_name: 'CICS TS', version: '6.1',
				ptf_level: 'RSU2510', notes: 'a, "quoted" note', source_url: ''
			}
		]);
		expect(csv.split('\r\n')[1]).toBe(
			'IBM,RSU2510,IBM CST RSU2510,RSU,2025-11-07,CICSTS,CICS TS,6.1,RSU2510,"a, ""quoted"" note",,' // empty source_url and end_of_support
		);
	});
});
