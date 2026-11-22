import { describe, it, expect } from 'vitest';
import { mergeBundlesIntoItems, describeItemSource, type MergeBundle } from './bundle-merge.ts';
import { nextBundleCode, bundleItemSchema } from '#lib/schemas/bundle.ts';
import type { PackageItem } from '#lib/schemas/package.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const cars: MergeBundle = {
	id: id(100),
	code: 'CARS2511',
	items: [
		{ software_id: id(1), software_version_id: id(11), software: { name: 'Endevor' } },
		{ software_id: id(2), software_version_id: id(21), software: { name: 'ACF2' } }
	]
};
const rsu: MergeBundle = {
	id: id(200),
	code: 'RSU2511',
	items: [{ software_id: id(3), software_version_id: id(31), software: { name: 'CICS' } }]
};

describe('mergeBundlesIntoItems', () => {
	it('copies items from several bundles with consecutive order_index and source', () => {
		const result = mergeBundlesIntoItems([], [cars, rsu]);
		expect(result.added).toBe(3);
		expect(result.items.map((i) => i.order_index)).toEqual([0, 1, 2]);
		expect(result.items.map((i) => i.source_bundle_id)).toEqual([id(100), id(100), id(200)]);
	});

	it('replaces the version of software already in the package and reports a conflict', () => {
		const current: PackageItem[] = [
			{ software_id: id(1), software_version_id: id(10), order_index: 0 }
		];
		const result = mergeBundlesIntoItems(current, [cars]);
		expect(result.replaced).toBe(1);
		expect(result.added).toBe(1);
		expect(result.items[0]).toMatchObject({ software_version_id: id(11), source_bundle_id: id(100), order_index: 0 });
		expect(result.conflicts).toEqual([
			{ softwareId: id(1), softwareName: 'Endevor', bundleCode: 'CARS2511', replacedSource: null }
		]);
		expect(current[0].software_version_id).toBe(id(10)); // input not mutated
	});

	it('leaves identical items alone', () => {
		const once = mergeBundlesIntoItems([], [cars]).items;
		const again = mergeBundlesIntoItems(once, [cars]);
		expect(again.unchanged).toBe(2);
		expect(again.items).toHaveLength(2);
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
		expect(describeItemSource({ software_id: id(1), software_version_id: id(12), source_bundle_id: id(100) }, [cars]))
			.toEqual({ kind: 'adjusted', code: 'CARS2511' });
		expect(describeItemSource({ software_id: id(1), software_version_id: id(12), source_bundle_id: null }, [cars]))
			.toEqual({ kind: 'manual' });
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
