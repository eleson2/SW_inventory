/**
 * Copy vendor bundle items into a package's item list.
 *
 * Pure function (no DB access) so it runs in the package editor and in tests.
 * A bundle lists every release the vendor ships (e.g. Db2 12 and 13 in one RSU level);
 * a package has one row per software. Per software:
 * - already in the package: move to the bundle's level of the same release
 *   (or keep the row, reported in `keptRelease`, if the bundle lacks that release);
 *   with `latestOnly`, move to the bundle's highest release instead (an upgrade);
 * - not in the package: add the bundle's highest release.
 * Bundles are applied in the given order, so a later bundle wins.
 */
import type { PackageItem } from '#lib/schemas/package.ts';
import { compareVersions, equivalentVersion } from './version-parser.ts';

export interface MergeBundle {
	id: string;
	code: string;
	items: Array<{
		software_id: string;
		software_version_id: string;
		software?: { name: string } | null;
		software_version?: { version: string } | null;
	}>;
}

export interface MergeConflict {
	softwareId: string;
	softwareName: string;
	bundleCode: string;
	/** Bundle code the replaced row came from, or null for a manual row */
	replacedSource: string | null;
}

export interface KeptRelease {
	softwareName: string;
	bundleCode: string;
	/** The package's release, which the bundle does not contain */
	release: string | null;
}

export interface MergeResult {
	items: PackageItem[];
	added: number;
	replaced: number;
	unchanged: number;
	conflicts: MergeConflict[];
	keptRelease: KeptRelease[];
}

export interface MergeOptions {
	bundleCodeById?: (id: string) => string | undefined;
	/** Version string of a software_version id that is not in the bundles (the package's current rows) */
	versionOf?: (versionId: string) => string | undefined;
	/** Move software already in the package to the bundle's highest release, not its own release */
	latestOnly?: boolean;
}

type BundleItem = MergeBundle['items'][number];

function groupBySoftware(items: BundleItem[]): Map<string, BundleItem[]> {
	const groups = new Map<string, BundleItem[]>();
	for (const item of items) groups.set(item.software_id, [...(groups.get(item.software_id) ?? []), item]);
	return groups;
}

function highest(items: BundleItem[]): BundleItem {
	return [...items].sort((a, b) =>
		compareVersions(b.software_version?.version ?? '', a.software_version?.version ?? '')
	)[0];
}

export function mergeBundlesIntoItems(
	current: PackageItem[],
	bundles: MergeBundle[],
	options: MergeOptions = {}
): MergeResult {
	const { bundleCodeById = () => undefined, versionOf = () => undefined, latestOnly = false } = options;
	const items = current.map((item) => ({ ...item }));
	let added = 0;
	let replaced = 0;
	let unchanged = 0;
	const conflicts: MergeConflict[] = [];
	const keptRelease: KeptRelease[] = [];

	const allBundleItems = bundles.flatMap((b) => b.items);
	const releaseOf = (versionId: string) =>
		allBundleItems.find((i) => i.software_version_id === versionId)?.software_version?.version ??
		versionOf(versionId);

	// Rows marked for deletion still hold their order_index until saved; skip past them too
	const nextOrderIndex = () => items.reduce((max, item) => Math.max(max, item.order_index + 1), 0);

	for (const bundle of bundles) {
		for (const [softwareId, releases] of groupBySoftware(bundle.items)) {
			const name = releases[0].software?.name ?? softwareId;
			const existing = items.find((item) => item.software_id === softwareId && item._action !== 'delete');

			if (!existing) {
				const pick = highest(releases);
				items.push({
					software_id: softwareId,
					software_version_id: pick.software_version_id,
					order_index: nextOrderIndex(),
					source_bundle_id: bundle.id
				});
				added++;
				continue;
			}

			const latest = highest(releases);
			const alreadyThere = latestOnly
				? latest.software_version_id === existing.software_version_id
				: releases.some((r) => r.software_version_id === existing.software_version_id);
			if (alreadyThere) {
				existing.source_bundle_id ??= bundle.id;
				unchanged++;
				continue;
			}

			const currentRelease = releaseOf(existing.software_version_id) ?? null;
			const sameRelease = latestOnly
				? latest
				: currentRelease
					? releases.find((r) => r.software_version && equivalentVersion(r.software_version.version, currentRelease))
					: undefined;
			if (!sameRelease) {
				keptRelease.push({ softwareName: name, bundleCode: bundle.code, release: currentRelease });
				continue;
			}

			conflicts.push({
				softwareId,
				softwareName: name,
				bundleCode: bundle.code,
				replacedSource: existing.source_bundle_id
					? (bundleCodeById(existing.source_bundle_id) ?? 'another bundle')
					: null
			});
			existing.software_version_id = sameRelease.software_version_id;
			existing.source_bundle_id = bundle.id;
			replaced++;
		}
	}

	return { items, added, replaced, unchanged, conflicts, keptRelease };
}

export type ItemSource =
	| { kind: 'manual' }
	| { kind: 'bundle'; code: string }
	| { kind: 'adjusted'; code: string };

/**
 * Describe where a package item came from: copied from a bundle (any of the releases
 * it lists), copied and then given a version the bundle does not have ("adjusted"),
 * or added by hand.
 */
export function describeItemSource(
	item: Pick<PackageItem, 'software_id' | 'software_version_id' | 'source_bundle_id'>,
	bundles: MergeBundle[]
): ItemSource {
	if (!item.source_bundle_id) return { kind: 'manual' };
	const bundle = bundles.find((b) => b.id === item.source_bundle_id);
	if (!bundle) return { kind: 'bundle', code: 'other bundle' };
	const inBundle = bundle.items.some(
		(b) => b.software_id === item.software_id && b.software_version_id === item.software_version_id
	);
	return inBundle ? { kind: 'bundle', code: bundle.code } : { kind: 'adjusted', code: bundle.code };
}
