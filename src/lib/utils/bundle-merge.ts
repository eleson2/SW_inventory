/**
 * Copy vendor bundle items into a package's item list.
 *
 * Pure function (no DB access) so it runs in the package editor and in tests.
 * Bundles are applied in the given order; for software already in the package,
 * the bundle's version replaces the existing one (a later bundle wins).
 */
import type { PackageItem } from '#lib/schemas/package.ts';

export interface MergeBundle {
	id: string;
	code: string;
	items: Array<{
		software_id: string;
		software_version_id: string;
		software?: { name: string } | null;
	}>;
}

export interface MergeConflict {
	softwareId: string;
	softwareName: string;
	bundleCode: string;
	/** Bundle code the replaced row came from, or null for a manual row */
	replacedSource: string | null;
}

export interface MergeResult {
	items: PackageItem[];
	added: number;
	replaced: number;
	unchanged: number;
	conflicts: MergeConflict[];
}

export function mergeBundlesIntoItems(
	current: PackageItem[],
	bundles: MergeBundle[],
	bundleCodeById: (id: string) => string | undefined = () => undefined
): MergeResult {
	const items = current.map((item) => ({ ...item }));
	let added = 0;
	let replaced = 0;
	let unchanged = 0;
	const conflicts: MergeConflict[] = [];

	// Rows marked for deletion still hold their order_index until saved; skip past them too
	const nextOrderIndex = () => items.reduce((max, item) => Math.max(max, item.order_index + 1), 0);

	for (const bundle of bundles) {
		for (const bundleItem of bundle.items) {
			const existing = items.find(
				(item) => item.software_id === bundleItem.software_id && item._action !== 'delete'
			);

			if (!existing) {
				items.push({
					software_id: bundleItem.software_id,
					software_version_id: bundleItem.software_version_id,
					order_index: nextOrderIndex(),
					source_bundle_id: bundle.id
				});
				added++;
				continue;
			}

			if (existing.software_version_id === bundleItem.software_version_id) {
				existing.source_bundle_id ??= bundle.id;
				unchanged++;
				continue;
			}

			conflicts.push({
				softwareId: bundleItem.software_id,
				softwareName: bundleItem.software?.name ?? bundleItem.software_id,
				bundleCode: bundle.code,
				replacedSource: existing.source_bundle_id
					? (bundleCodeById(existing.source_bundle_id) ?? 'another bundle')
					: null
			});
			existing.software_version_id = bundleItem.software_version_id;
			existing.source_bundle_id = bundle.id;
			replaced++;
		}
	}

	return { items, added, replaced, unchanged, conflicts };
}

export type ItemSource =
	| { kind: 'manual' }
	| { kind: 'bundle'; code: string }
	| { kind: 'adjusted'; code: string };

/**
 * Describe where a package item came from: copied unchanged from a bundle,
 * copied and then given another version ("adjusted"), or added by hand.
 */
export function describeItemSource(
	item: Pick<PackageItem, 'software_id' | 'software_version_id' | 'source_bundle_id'>,
	bundles: MergeBundle[]
): ItemSource {
	if (!item.source_bundle_id) return { kind: 'manual' };
	const bundle = bundles.find((b) => b.id === item.source_bundle_id);
	if (!bundle) return { kind: 'bundle', code: 'other bundle' };
	const bundleItem = bundle.items.find((b) => b.software_id === item.software_id);
	if (bundleItem && bundleItem.software_version_id === item.software_version_id) {
		return { kind: 'bundle', code: bundle.code };
	}
	return { kind: 'adjusted', code: bundle.code };
}
