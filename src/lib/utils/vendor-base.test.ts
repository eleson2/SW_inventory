import { describe, it, expect } from 'vitest';
import { buildVendorBase, releaseOf, vendorBaseRecords, VENDOR_BASE_CSV_COLUMNS } from './vendor-base.ts';
import { toCsv } from './csv.ts';

const ibm = { id: 'v-ibm', code: 'IBM', name: 'IBM' };
const bc = { id: 'v-bc', code: 'BROADCOM', name: 'Broadcom' };
const acme = { id: 'c-acme', code: 'ACME', name: 'Acme' };
const globex = { id: 'c-globex', code: 'GLOBEX', name: 'Globex' };
const lpars = [
	{ id: 'l1', code: 'ACME1', customer: acme },
	{ id: 'l2', code: 'ACME2', customer: acme },
	{ id: 'l3', code: 'GLX1', customer: globex }
];
const cics = {
	id: 's-cics',
	name: 'CICS',
	product_code: 'CICSTS',
	vendor: ibm,
	current_version: 'V6R1M0',
	versions: [
		{ version: 'V6R1M0', vendor_version: '6.1' },
		{ version: 'V5R6M0', vendor_version: null }
	]
};
const endevor = { id: 's-end', name: 'Endevor', product_code: null, vendor: bc, current_version: null, versions: [] };

describe('releaseOf', () => {
	it('writes the install in the inventory notation', () => {
		expect(releaseOf({ version: '6.1' }, cics)).toBe('V6R1M0');
		expect(releaseOf({ version: '5.6' }, cics)).toBe('V5R6M0');
		expect(releaseOf({ version: ' V7R1M0 ' }, cics)).toBe('V7R1M0');
	});
});

describe('buildVendorBase', () => {
	const base = buildVendorBase({
		lpars,
		software: [cics, endevor],
		installs: [
			{ lpar_id: 'l1', software_id: 's-cics', version: 'V6R1M0', ptf_level: 'UI90002' },
			{ lpar_id: 'l2', software_id: 's-cics', version: '6.1', ptf_level: 'UI90001' },
			{ lpar_id: 'l3', software_id: 's-cics', version: 'V5R6M0', ptf_level: null },
			{ lpar_id: 'l3', software_id: 's-end', version: 'V18R2M0', ptf_level: 'SO12345' },
			{ lpar_id: 'other', software_id: 's-cics', version: 'V6R1M0', ptf_level: null } // out of scope
		]
	});

	it('counts totals and the share on the current release', () => {
		expect(base.totals).toEqual({ products: 2, lpars: 3, customers: 2, installs: 4, onCurrent: 2 });
		expect(base.customers.map((c) => c.code)).toEqual(['ACME', 'GLOBEX']);
	});

	it('groups by vendor and product, newest release first, with PTF ranges', () => {
		expect(base.vendors.map((v) => v.vendor.name)).toEqual(['Broadcom', 'IBM']);
		const product = base.vendors[1].products[0];
		expect(product).toMatchObject({ lparCount: 3, customerCount: 2 });
		expect(product.releases.map((r) => [r.release, r.isCurrent, r.lparCount, r.customerCount])).toEqual([
			['V6R1M0', true, 2, 1],
			['V5R6M0', false, 1, 1]
		]);
		expect(product.releases[0]).toMatchObject({ oldest: 'UI90001', newest: 'UI90002', share: 2 / 3 });
		expect(product.releases[0].byCustomer['c-acme'].lparCodes).toEqual(['ACME1', 'ACME2']);
		expect(product.releases[1]).toMatchObject({ oldest: null, newest: null });
	});

	it('exports one CSV row per product x release x customer', () => {
		const records = vendorBaseRecords(base);
		expect(records).toHaveLength(3);
		expect(records[1]).toMatchObject({
			product: 'CICS',
			release: 'V6R1M0',
			current_release: 'yes',
			customer: 'Acme',
			lpar_count: '2',
			lpars: 'ACME1 ACME2',
			oldest_ptf: 'UI90001',
			newest_ptf: 'UI90002'
		});
		expect(toCsv(VENDOR_BASE_CSV_COLUMNS, records).split('\r\n')[0]).toBe(VENDOR_BASE_CSV_COLUMNS.join(','));
	});
});
