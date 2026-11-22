/**
 * Vendor bundles: saving with auto-created versions, CSV import matching, and building a
 * package from several bundles. Runs src/lib/server/bundles.ts against the test database.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import {
	testDb,
	cleanupTestDatabase,
	seedTestData,
	disconnectTestDatabase
} from '../../prisma/test-helpers';

// bundles.ts uses the app's db singleton; point it at the test database
vi.mock('../../src/lib/server/db.ts', async () => {
	const { testDb } = await import('../../prisma/test-helpers');
	return { db: testDb, createAuditLog: async () => {} };
});

const { saveBundle, importBundleRows, BundleValidationError } = await import('../../src/lib/server/bundles.ts');
const { mergeBundlesIntoItems } = await import('../../src/lib/utils/bundle-merge.ts');

const csvRow = (overrides: Record<string, string>) => ({
	vendor_code: 'IBM',
	bundle_code: 'RSU2510',
	bundle_name: 'IBM CST RSU2510',
	bundle_type: 'RSU',
	release_date: '2025-11-07',
	product_code: '',
	product_name: '',
	version: '',
	ptf_level: 'RSU2510',
	notes: '',
	source_url: '',
	...overrides
});

describe('Vendor bundles', () => {
	let data: Awaited<ReturnType<typeof seedTestData>>;

	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
		data = await seedTestData();
	});

	it('saves a bundle and creates a missing version (not current)', async () => {
		const { cics } = data.software;
		const saved = await saveBundle({
			vendor_id: data.vendors.ibm.id,
			name: 'IBM CST RSU2510',
			code: 'RSU2510',
			bundle_type: 'RSU',
			release_date: new Date('2025-11-07'),
			items: [{ software_id: cics.id, new_version: 'V5R6M0', new_ptf_level: 'RSU2510', _action: 'keep' }]
		});
		expect(saved).toMatchObject({ itemCount: 1, versionsCreated: 1 });

		const item = await testDb.vendor_bundle_items.findFirstOrThrow({
			where: { bundle_id: saved.id },
			include: { software_version: true }
		});
		expect(item.software_version).toMatchObject({ version: 'V5R6M0', ptf_level: 'RSU2510', is_current: false });

		// Saving again reuses the version
		const again = await saveBundle(
			{
				vendor_id: data.vendors.ibm.id,
				name: 'IBM CST RSU2510',
				code: 'RSU2510',
				bundle_type: 'RSU',
				release_date: new Date('2025-11-07'),
				items: [{ software_id: cics.id, new_version: 'V5R6M0', new_ptf_level: 'RSU2510', _action: 'keep' }]
			},
			saved.id
		);
		expect(again.versionsCreated).toBe(0);
	});

	it('rejects software from another vendor and duplicate codes', async () => {
		const base = {
			vendor_id: data.vendors.broadcom.id,
			name: 'Broadcom CA RS 2510',
			code: 'CARS2510',
			bundle_type: 'CARS' as const,
			release_date: new Date('2025-10-01')
		};
		await expect(
			saveBundle({
				...base,
				items: [{ software_id: data.software.cics.id, software_version_id: data.versions.cicsVersion.id, _action: 'keep' }]
			})
		).rejects.toBeInstanceOf(BundleValidationError);

		await saveBundle({ ...base, items: [] });
		await expect(saveBundle({ ...base, items: [] })).rejects.toThrow(/already has a bundle/);
	});

	it('imports CSV rows: matches by product code or name, adds unknown products, keeps every release', async () => {
		await testDb.software.update({ where: { id: data.software.cics.id }, data: { product_code: 'CICSTS' } });
		const db2 = await testDb.software.create({ data: { name: 'Db2', vendor_id: data.vendors.ibm.id } });
		await testDb.software_versions.create({
			data: { software_id: db2.id, version: 'V12R1M0', ptf_level: 'RSU2507', release_date: new Date('2025-08-01') }
		});

		const result = await importBundleRows([
			csvRow({ product_code: 'CICSTS', product_name: 'CICS TS', version: '6.1' }),
			csvRow({ product_code: 'CICSTS', product_name: 'CICS TS', version: '5.6' }),
			csvRow({ product_code: 'DB2X', product_name: 'Db2', version: '13' }),
			csvRow({ product_code: 'DB2X', product_name: 'Db2', version: '12' }),
			csvRow({ product_code: 'IMS', product_name: 'IMS', version: '15.5' }),
			csvRow({ vendor_code: 'NOPE', bundle_code: 'X2510', product_name: 'Foo', version: '1' })
		]);

		expect(result.counts.created).toBe(1);
		expect(result.errors).toEqual([expect.stringContaining('unknown vendor code "NOPE"')]);
		expect(result.skippedProducts).toEqual([]);
		// IMS was not in the inventory: added under the vendor, its version becomes current
		expect(result.softwareCreated).toEqual(['RSU2510: IMS [IMS]']);
		const ims = await testDb.software.findFirstOrThrow({
			where: { vendor_id: data.vendors.ibm.id, name: 'IMS' },
			include: { current_version: true }
		});
		expect(ims).toMatchObject({ product_code: 'IMS', active: true });
		expect(ims.current_version).toMatchObject({ version: '15.5', ptf_level: 'RSU2510', is_current: true });

		const bundle = await testDb.vendor_bundles.findFirstOrThrow({
			where: { code: 'RSU2510' },
			include: { items: { include: { software: true, software_version: true } } }
		});
		// Every listed release is in the bundle, in the inventory's notation where it has one
		expect(bundle.items).toHaveLength(5);
		const releasesOf = (name: string) =>
			bundle.items
				.filter((i) => i.software.name === name)
				.map((i) => `${i.software_version.version}/${i.software_version.ptf_level}`)
				.sort();
		// CICS: "5.6" is the inventory's V5R6M0; "6.1" follows its VRM notation
		expect(releasesOf('CICS Transaction Server')).toEqual(['V5R6M0/RSU2510', 'V6R1M0/RSU2510']);
		// Db2: "12" is the inventory's V12R1M0; "13" has no known spelling and is kept
		expect(releasesOf('Db2')).toEqual(['13/RSU2510', 'V12R1M0/RSU2510']);
		// The vendor's spelling is kept alongside the inventory's
		const cics61 = bundle.items.find((i) => i.software_version.version === 'V6R1M0')!.software_version;
		expect(cics61.vendor_version).toBe('6.1');
		const db212 = bundle.items.find((i) => i.software_version.version === 'V12R1M0')!.software_version;
		expect(db212.vendor_version).toBe('12'); // filled in on the existing version

		// Re-import replaces the items of the existing bundle
		const second = await importBundleRows([csvRow({ product_code: 'CICSTS', version: '6.1' })]);
		expect(second.counts.updated).toBe(1);
		expect(await testDb.vendor_bundle_items.count({ where: { bundle_id: bundle.id } })).toBe(1);
	});

	it('keeps each version/PTF level once: unchanged products are carried over to the next level', async () => {
		const broadcom = data.vendors.broadcom.id;
		const ca7 = await testDb.software.create({ data: { name: 'CA 7', vendor_id: broadcom, product_code: 'AL2121' } });
		const endevor = await testDb.software.create({ data: { name: 'Endevor', vendor_id: broadcom, product_code: 'C1G190' } });
		const cars = (yymm: string, overrides: Record<string, string>) =>
			csvRow({
				vendor_code: 'BROADCOM', bundle_code: `CARS${yymm}`, bundle_name: `CA RS ${yymm}`,
				bundle_type: 'CARS', release_date: `20${yymm.slice(0, 2)}-${yymm.slice(2)}-01`, ...overrides
			});

		await importBundleRows([
			cars('2509', { product_code: 'AL2121', version: '12.1', ptf_level: 'LU17000' }),
			cars('2509', { product_code: 'C1G190', version: '19.0', ptf_level: 'SO16000' })
		]);
		// CARS2510 only lists CA 7: Endevor had no new service
		const result = await importBundleRows([cars('2510', { product_code: 'AL2121', version: '12.1', ptf_level: 'LU17806' })]);
		expect(result).toMatchObject({ versionsCreated: 1, carriedForward: 1 });

		const levels = await testDb.vendor_bundles.findMany({
			where: { vendor_id: broadcom },
			include: { items: true },
			orderBy: { code: 'asc' }
		});
		const versionIn = (level: number, softwareId: string) =>
			levels[level].items.find((i) => i.software_id === softwareId)?.software_version_id;
		expect(levels.map((b) => b.items.length)).toEqual([2, 2]);
		expect(versionIn(1, endevor.id)).toBe(versionIn(0, endevor.id));
		expect(versionIn(1, ca7.id)).not.toBe(versionIn(0, ca7.id));
		expect(await testDb.software_versions.count({ where: { software_id: endevor.id } })).toBe(1);
		expect(await testDb.software_versions.count({ where: { software_id: ca7.id } })).toBe(2);

		// Re-importing, in another spelling, creates nothing new
		const again = await importBundleRows([cars('2510', { product_code: 'AL2121', version: '12.1.0', ptf_level: 'lu17806' })]);
		expect(again.versionsCreated).toBe(0);
		expect(await testDb.software_versions.count({ where: { software_id: ca7.id } })).toBe(2);
	});

	it('reuses an existing version written in another notation', async () => {
		const { cics } = data.software; // has V5R6M0 / PTF12345
		const saved = await saveBundle({
			vendor_id: data.vendors.ibm.id,
			name: 'RSU',
			code: 'RSU2510',
			bundle_type: 'RSU',
			release_date: new Date('2025-11-07'),
			items: [{ software_id: cics.id, new_version: '5.6', new_ptf_level: 'ptf12345', _action: 'keep' }]
		});
		expect(saved.versionsCreated).toBe(0);
		const item = await testDb.vendor_bundle_items.findFirstOrThrow({ where: { bundle_id: saved.id } });
		expect(item.software_version_id).toBe(data.versions.cicsVersion.id);
	});

	it('builds a package from two bundles and keeps the source bundle', async () => {
		const endevor = await testDb.software.create({ data: { name: 'Endevor', vendor_id: data.vendors.broadcom.id } });
		const endevorVersion = await testDb.software_versions.create({
			data: { software_id: endevor.id, version: '19.0', ptf_level: 'CARS2510', release_date: new Date('2025-10-01') }
		});
		const rsu = await saveBundle({
			vendor_id: data.vendors.ibm.id,
			name: 'RSU',
			code: 'RSU2510',
			bundle_type: 'RSU',
			release_date: new Date('2025-11-07'),
			items: [{ software_id: data.software.cics.id, software_version_id: data.versions.cicsVersion.id, _action: 'keep' }]
		});
		const cars = await saveBundle({
			vendor_id: data.vendors.broadcom.id,
			name: 'CARS',
			code: 'CARS2510',
			bundle_type: 'CARS',
			release_date: new Date('2025-10-01'),
			items: [{ software_id: endevor.id, software_version_id: endevorVersion.id, _action: 'keep' }]
		});

		const bundles = await testDb.vendor_bundles.findMany({
			where: { id: { in: [rsu.id, cars.id] } },
			include: { items: { include: { software: { select: { name: true } } } } },
			orderBy: { code: 'desc' }
		});
		const merged = mergeBundlesIntoItems([], bundles, {
			bundleCodeById: (bundleId) => bundles.find((b) => b.id === bundleId)?.code
		});
		expect(merged.added).toBe(2);

		const pkg = await testDb.packages.create({
			data: {
				name: 'From bundles',
				code: 'FROM-BUNDLES',
				version: '1.0.0',
				release_date: new Date('2025-11-15'),
				package_items: {
					create: merged.items.map((item) => ({
						software_id: item.software_id,
						software_version_id: item.software_version_id,
						order_index: item.order_index,
						source_bundle_id: item.source_bundle_id ?? null
					}))
				}
			},
			include: { package_items: { include: { source_bundle: true } } }
		});
		expect(pkg.package_items.map((i) => i.source_bundle?.code).sort()).toEqual(['CARS2510', 'RSU2510']);

		// Deleting a bundle keeps the package items (source_bundle_id set to null)
		await testDb.vendor_bundles.delete({ where: { id: cars.id } });
		const items = await testDb.package_items.findMany({ where: { package_id: pkg.id } });
		expect(items).toHaveLength(2);
		expect(items.filter((i) => i.source_bundle_id === null)).toHaveLength(1);
	});
});
