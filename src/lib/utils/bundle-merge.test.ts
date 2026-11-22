import { describe, it, expect } from 'vitest';
import { mergeBundlesIntoItems, describeItemSource, type MergeBundle } from './bundle-merge.ts';
import { nextBundleCode, bundleItemSchema } from '#lib/schemas/bundle.ts';
import { spellLikeInventory, versionName } from './version-parser.ts';
import type { PackageItem } from '#lib/schemas/package.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const cars: MergeBundle = {
	id: id(100),
	code: 'CARS2511',
	items: [
		{ software_id: id(1), software_version_id: id(11), software: { name: 'Endevor' }, software_version: { version: '19.0' } },
		{ software_id: id(2), software_version_id: id(21), software: { name: 'ACF2' }, software_version: { version: '16.0' } }
	]
};
// IBM tests several releases per level
const rsu: MergeBundle = {
	id: id(200),
	code: 'RSU2511',
	items: [
		{ software_id: id(3), software_version_id: id(31), software: { name: 'Db2' }, software_version: { version: 'V12R1M0' } },
		{ software_id: id(3), software_version_id: id(32), software: { name: 'Db2' }, software_version: { version: 'V13R1M0' } }
	]
};
// The package's existing rows: releases known from the software list
const versions: Record<string, string> = { [id(10)]: '19.0', [id(30)]: 'V12R1M0', [id(39)]: 'V11R1M0' };
const versionOf = (versionId: string) => versions[versionId];

describe('mergeBundlesIntoItems', () => {
	it('copies items from several bundles; new software gets the highest release', () => {
		const result = mergeBundlesIntoItems([], [cars, rsu]);
		expect(result.added).toBe(3);
		expect(result.items.map((i) => i.software_version_id)).toEqual([id(11), id(21), id(32)]);
		expect(result.items.map((i) => i.order_index)).toEqual([0, 1, 2]);
		expect(result.items.map((i) => i.source_bundle_id)).toEqual([id(100), id(100), id(200)]);
	});

	it('moves software already in the package to the same release and reports it', () => {
		const current: PackageItem[] = [
			{ software_id: id(1), software_version_id: id(10), order_index: 0 },
			{ software_id: id(3), software_version_id: id(30), order_index: 1 } // Db2 12 at an older level
		];
		const result = mergeBundlesIntoItems(current, [cars, rsu], { versionOf });
		expect(result.replaced).toBe(2);
		expect(result.added).toBe(1);
		expect(result.items[0]).toMatchObject({ software_version_id: id(11), source_bundle_id: id(100), order_index: 0 });
		expect(result.items[1]).toMatchObject({ software_version_id: id(31), source_bundle_id: id(200) }); // stays on 12
		expect(result.conflicts[0]).toEqual({
			softwareId: id(1), softwareName: 'Endevor', bundleCode: 'CARS2511', replacedSource: null
		});
		expect(current[0].software_version_id).toBe(id(10)); // input not mutated
	});

	it('keeps a release the bundle does not contain', () => {
		const current: PackageItem[] = [{ software_id: id(3), software_version_id: id(39), order_index: 0 }];
		const result = mergeBundlesIntoItems(current, [rsu], { versionOf });
		expect(result.items).toEqual(current);
		expect(result.keptRelease).toEqual([{ softwareName: 'Db2', bundleCode: 'RSU2511', release: 'V11R1M0' }]);
	});

	it('with latestOnly, upgrades software already in the package to the highest release', () => {
		const onTwelve: PackageItem[] = [{ software_id: id(3), software_version_id: id(31), order_index: 0 }];
		// Db2 12 at the bundle's level: unchanged normally, upgraded to 13 with latestOnly
		expect(mergeBundlesIntoItems(onTwelve, [rsu], { versionOf }).unchanged).toBe(1);
		const result = mergeBundlesIntoItems(onTwelve, [rsu], { versionOf, latestOnly: true });
		expect(result.replaced).toBe(1);
		expect(result.items[0]).toMatchObject({ software_version_id: id(32), source_bundle_id: id(200) });
		// A release the bundle lacks is upgraded too, not kept
		const onEleven: PackageItem[] = [{ software_id: id(3), software_version_id: id(39), order_index: 0 }];
		const fromEleven = mergeBundlesIntoItems(onEleven, [rsu], { versionOf, latestOnly: true });
		expect(fromEleven.keptRelease).toEqual([]);
		expect(fromEleven.items[0].software_version_id).toBe(id(32));
		// Already on the latest: unchanged
		expect(mergeBundlesIntoItems(fromEleven.items, [rsu], { latestOnly: true }).unchanged).toBe(1);
	});

	it('leaves identical items alone', () => {
		const once = mergeBundlesIntoItems([], [cars, rsu]).items;
		const again = mergeBundlesIntoItems(once, [cars, rsu]);
		expect(again.unchanged).toBe(3);
		expect(again.items).toHaveLength(3);
		expect(again.conflicts).toEqual([]);
	});

	it('ignores rows marked for deletion and skips past their order_index', () => {
		const current: PackageItem[] = [
			{ id: id(50), software_id: id(1), software_version_id: id(10), order_index: 0, _action: 'delete' }
		];
		const result = mergeBundlesIntoItems(current, [cars]);
		expect(result.added).toBe(2);
		expect(result.items.filter((i) => i._action !== 'delete').map((i) => i.order_index)).toEqual([1, 2]);
	});
});

describe('describeItemSource', () => {
	it('distinguishes bundle, adjusted and manual items', () => {
		expect(describeItemSource({ software_id: id(1), software_version_id: id(11), source_bundle_id: id(100) }, [cars]))
			.toEqual({ kind: 'bundle', code: 'CARS2511' });
		expect(describeItemSource({ software_id: id(3), software_version_id: id(31), source_bundle_id: id(200) }, [rsu]))
			.toEqual({ kind: 'bundle', code: 'RSU2511' }); // the lower release is also from the bundle
		expect(describeItemSource({ software_id: id(1), software_version_id: id(12), source_bundle_id: id(100) }, [cars]))
			.toEqual({ kind: 'adjusted', code: 'CARS2511' });
		expect(describeItemSource({ software_id: id(1), software_version_id: id(12), source_bundle_id: null }, [cars]))
			.toEqual({ kind: 'manual' });
	});
});

describe('spellLikeInventory', () => {
	it('writes vendor releases in the notation the inventory uses', () => {
		expect(spellLikeInventory('5.6', ['V5R4M0', 'V5R6M0'])).toBe('V5R6M0');
		expect(spellLikeInventory('12', ['V12R1M0', 'V13R1M0'])).toBe('V12R1M0');
		expect(spellLikeInventory('15', ['V15R2M0', 'V15R1M0'])).toBe('V15R1M0');
		expect(spellLikeInventory('6.3', ['V5R4M0', 'V5R6M0'])).toBe('V6R3M0');
		expect(spellLikeInventory('3.2', ['V2R4', 'V3R1'])).toBe('V3R2');
		expect(spellLikeInventory('4.8.0', [])).toBe('4.8.0');
		expect(spellLikeInventory('13', ['V12R1M0'])).toBe('13'); // not guessed: Db2 13 could be V13R1M0
	});

	it('follows the notation most versions use, so one odd entry does not decide', () => {
		expect(spellLikeInventory('6.2', ['V5R4M0', 'V5R6M0', '6.3'])).toBe('V6R2M0');
		expect(spellLikeInventory('6.2', ['6.1', '6.3', 'V5R6M0'])).toBe('6.2');
	});
});

describe('versionName', () => {
	it('adds the vendor notation when it differs', () => {
		expect(versionName({ version: 'V6R1M0', vendor_version: '6.1' })).toBe('V6R1M0 [6.1]');
		expect(versionName({ version: '12.1', vendor_version: '12.1' })).toBe('12.1');
		expect(versionName({ version: 'V5R6M0', vendor_version: null })).toBe('V5R6M0');
	});
});

describe('nextBundleCode', () => {
	it('increments the yymm suffix', () => {
		expect(nextBundleCode('CARS2511')).toBe('CARS2512');
		expect(nextBundleCode('RSU2512')).toBe('RSU2601');
		expect(nextBundleCode('CUSTOM')).toBe('CUSTOM');
	});
});

describe('bundleItemSchema', () => {
	it('requires an existing version or a new version', () => {
		expect(bundleItemSchema.safeParse({ software_id: id(1) }).success).toBe(false);
		expect(bundleItemSchema.safeParse({ software_id: id(1), software_version_id: id(11) }).success).toBe(true);
		expect(bundleItemSchema.safeParse({ software_id: id(1), new_version: '19.0', new_ptf_level: 'CARS2511' }).success).toBe(true);
	});
});
