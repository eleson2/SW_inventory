/**
 * Vendor bundle persistence (Broadcom CARS, IBM RSU, ...).
 *
 * A bundle is a vendor maintenance level: a list of software versions/PTF levels.
 * Packages copy bundle items (see src/lib/utils/bundle-merge.ts); the copy keeps
 * package_items.source_bundle_id so the origin stays visible.
 */
import type { Prisma } from '@prisma/client';
import { db, createAuditLog } from './db.ts';
import { transactionTimeouts } from './db-dialect.ts';
import {
	BUNDLE_CSV_COLUMNS,
	type BundleCsvRow,
	type BundleItem,
	type BundleType
} from '#lib/schemas/bundle.ts';
import { compareVersions, releaseMatchLength } from '#lib/utils/version-parser.ts';

type Tx = Prisma.TransactionClient;

export class BundleValidationError extends Error {}

/** Same version in another notation: "6.1" = "V6R1M0" = "6.1.0"; non-numeric versions must match exactly. */
function sameVersion(a: string, b: string): boolean {
	if (a.trim().toUpperCase() === b.trim().toUpperCase()) return true;
	return /\d/.test(a) && /\d/.test(b) && compareVersions(a, b) === 0;
}

const normalizePtf = (ptf: string | null | undefined) => ptf?.trim().toUpperCase() || null;

/**
 * Find a software version by version + PTF level, creating it if it does not exist.
 * A version/PTF level is stored once per software: "6.1"/"rsu2510" finds an existing
 * "V6R1M0"/"RSU2510". Created versions are not marked current; that stays a deliberate
 * choice on the software page.
 */
export async function resolveVersion(
	tx: Tx,
	softwareId: string,
	version: string,
	ptfLevel: string | null | undefined,
	releaseDate: Date
): Promise<{ id: string; created: boolean }> {
	const ptf = normalizePtf(ptfLevel);
	const versions = await tx.software_versions.findMany({
		where: { software_id: softwareId },
		select: { id: true, version: true, ptf_level: true }
	});
	const existing = versions.find((v) => normalizePtf(v.ptf_level) === ptf && sameVersion(v.version, version));
	if (existing) return { id: existing.id, created: false };

	const created = await tx.software_versions.create({
		data: {
			software_id: softwareId,
			version: version.trim(),
			ptf_level: ptf,
			release_date: releaseDate,
			is_current: false
		},
		select: { id: true }
	});
	return { id: created.id, created: true };
}

export interface BundleData {
	vendor_id: string;
	name: string;
	code: string;
	bundle_type: BundleType;
	release_date: Date;
	description?: string;
	source_url?: string;
	active?: boolean;
	items: BundleItem[];
}

export interface SaveBundleResult {
	id: string;
	versionsCreated: number;
	itemCount: number;
}

/**
 * Create (existingId undefined) or update a bundle with its items in one transaction.
 * Item rows are replaced wholesale: bundle items have no identity outside the bundle
 * (packages copy them), so diffing would buy nothing.
 */
export async function saveBundle(data: BundleData, existingId?: string): Promise<SaveBundleResult> {
	const items = data.items.filter((item) => item._action !== 'delete');

	const softwareIds = items.map((item) => item.software_id);
	if (new Set(softwareIds).size !== softwareIds.length) {
		throw new BundleValidationError('Each software product can only appear once in a bundle');
	}

	const duplicate = await db.vendor_bundles.findFirst({
		where: {
			vendor_id: data.vendor_id,
			code: data.code,
			...(existingId ? { id: { not: existingId } } : {})
		},
		select: { id: true }
	});
	if (duplicate) {
		throw new BundleValidationError(`This vendor already has a bundle with code ${data.code}`);
	}

	if (softwareIds.length > 0) {
		const foreign = await db.software.findMany({
			where: { id: { in: softwareIds }, vendor_id: { not: data.vendor_id } },
			select: { name: true }
		});
		if (foreign.length > 0) {
			throw new BundleValidationError(
				`Software from another vendor cannot be in this bundle: ${foreign.map((s) => s.name).join(', ')}`
			);
		}
	}

	const master = {
		vendor_id: data.vendor_id,
		name: data.name,
		code: data.code,
		bundle_type: data.bundle_type,
		release_date: data.release_date,
		description: data.description || null,
		source_url: data.source_url || null,
		...(data.active !== undefined ? { active: data.active } : {})
	};

	const before = existingId
		? await db.vendor_bundles.findUnique({ where: { id: existingId }, include: { items: true } })
		: null;
	if (existingId && !before) throw new BundleValidationError('Bundle not found');

	const result = await db.$transaction(async (tx) => {
		const bundle = existingId
			? await tx.vendor_bundles.update({ where: { id: existingId }, data: master })
			: await tx.vendor_bundles.create({ data: master });

		if (existingId) {
			await tx.vendor_bundle_items.deleteMany({ where: { bundle_id: bundle.id } });
		}

		let versionsCreated = 0;
		for (const item of items) {
			let versionId = item.software_version_id || '';
			if (!versionId) {
				const resolved = await resolveVersion(
					tx,
					item.software_id,
					item.new_version ?? '',
					item.new_ptf_level,
					data.release_date
				);
				versionId = resolved.id;
				if (resolved.created) versionsCreated++;
			}
			await tx.vendor_bundle_items.create({
				data: {
					bundle_id: bundle.id,
					software_id: item.software_id,
					software_version_id: versionId,
					notes: item.notes || null
				}
			});
		}

		return { id: bundle.id, versionsCreated, itemCount: items.length };
	}, transactionTimeouts());

	// Audit outside the transaction: SQLite allows only one writer at a time
	await createAuditLog('vendor_bundle', result.id, existingId ? 'update' : 'create', {
		...(before ? { before } : {}),
		after: { ...master, items_count: result.itemCount, versions_created: result.versionsCreated }
	});

	return result;
}

/**
 * Active bundles with their items, for building packages, plus any (inactive)
 * bundles in includeIds so existing package items can still show their source.
 */
export function loadBundlesForPackages(includeIds: Array<string | null> = []) {
	const ids = includeIds.filter((id): id is string => !!id);
	return db.vendor_bundles.findMany({
		where: ids.length > 0 ? { OR: [{ active: true }, { id: { in: ids } }] } : { active: true },
		include: {
			vendors: { select: { id: true, name: true, code: true } },
			items: {
				include: {
					software: { select: { name: true } },
					software_version: { select: { version: true, ptf_level: true } }
				}
			}
		},
		orderBy: [{ release_date: 'desc' }, { code: 'asc' }]
	});
}

// ---------------------------------------------------------------------------
// CSV / spreadsheet import
// ---------------------------------------------------------------------------

export interface BundleImportResult {
	success: boolean;
	message: string;
	counts: { created: number; updated: number; skipped: number };
	versionsCreated: number;
	/** Products not in the file, kept at the version they had in the previous level */
	carriedForward: number;
	skippedProducts: string[];
	errors: string[];
}

/** Turn a header row + data rows (as returned by XLSX sheet_to_json header:1) into objects. */
export function parseBundleRows(data: unknown[][]): BundleCsvRow[] {
	const [header, ...rows] = data;
	if (!header) return [];
	const index = header.map((h) => String(h ?? '').trim().toLowerCase());
	const missing = ['vendor_code', 'bundle_code', 'version'].filter((c) => !index.includes(c));
	if (missing.length > 0) {
		throw new BundleValidationError(`Missing column(s): ${missing.join(', ')}`);
	}
	return rows
		.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
		.map((row) => {
			const out = {} as BundleCsvRow;
			for (const column of BUNDLE_CSV_COLUMNS) {
				const i = index.indexOf(column);
				out[column] = i >= 0 ? String(row[i] ?? '').trim() : '';
			}
			return out;
		});
}

function parseDate(value: string): Date | null {
	if (!value) return null;
	// Excel serial dates arrive as numbers-in-strings
	if (/^\d{5}$/.test(value)) return new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000);
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function guessBundleType(code: string): BundleType {
	if (code.startsWith('CARS')) return 'CARS';
	if (code.startsWith('RSU')) return 'RSU';
	return 'OTHER';
}

/**
 * Import bundle rows. Rows are grouped per (vendor, bundle code); a bundle is created
 * if missing, otherwise its items are replaced. Products are matched on
 * software.product_code, then on name within the vendor. Unmatched products are
 * skipped and reported: vendor bundles cover many products the provider does not manage.
 */
export async function importBundleRows(rows: BundleCsvRow[]): Promise<BundleImportResult> {
	const result: BundleImportResult = {
		success: true,
		message: '',
		counts: { created: 0, updated: 0, skipped: 0 },
		versionsCreated: 0,
		carriedForward: 0,
		skippedProducts: [],
		errors: []
	};

	const groups = new Map<string, BundleCsvRow[]>();
	for (const row of rows) {
		const key = `${row.vendor_code.toUpperCase()}|${row.bundle_code.toUpperCase()}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}

	for (const [key, groupRows] of groups) {
		const [vendorCode, bundleCode] = key.split('|');
		const vendor = await db.vendors.findUnique({ where: { code: vendorCode } });
		if (!vendor) {
			result.errors.push(`${bundleCode}: unknown vendor code "${vendorCode}"`);
			result.counts.skipped += groupRows.length;
			continue;
		}

		const vendorSoftware = await db.software.findMany({
			where: { vendor_id: vendor.id, active: true },
			select: { id: true, name: true, product_code: true, versions: { select: { version: true } } }
		});
		const byCode = new Map(
			vendorSoftware.filter((s) => s.product_code).map((s) => [s.product_code!.toUpperCase(), s])
		);
		const byName = new Map(vendorSoftware.map((s) => [s.name.toLowerCase(), s]));

		const first = groupRows[0];
		const releaseDate = parseDate(first.release_date) ?? new Date();

		// Match rows to software; a level may list several releases of one product
		const candidates = new Map<string, { software: (typeof vendorSoftware)[number]; rows: BundleCsvRow[] }>();
		for (const row of groupRows) {
			const software =
				(row.product_code && byCode.get(row.product_code.toUpperCase())) ||
				(row.product_name && byName.get(row.product_name.toLowerCase()));
			const label = row.product_name || row.product_code || '(unnamed)';
			if (!software) {
				result.skippedProducts.push(`${bundleCode}: ${label}${row.product_code ? ` [${row.product_code}]` : ''}`);
				result.counts.skipped++;
				continue;
			}
			if (!row.version) {
				result.errors.push(`${bundleCode}: ${label} has no version`);
				result.counts.skipped++;
				continue;
			}
			const entry = candidates.get(software.id) ?? { software, rows: [] };
			entry.rows.push(row);
			candidates.set(software.id, entry);
		}

		const items: BundleItem[] = [];
		for (const { software, rows: softwareRows } of candidates.values()) {
			// "6.1" / "12" and "V6R1M0" / "V12R1M0" are the same release: reuse the inventory's spelling
			const bestKnown = (version: string) => {
				let best: { version: string; score: number } | undefined;
				for (const v of software.versions) {
					const score = releaseMatchLength(v.version, version);
					if (score > 0 && (!best || score > best.score)) best = { version: v.version, score };
				}
				return best;
			};
			// Prefer the listed release that best matches one the inventory has, else the highest listed
			const scored = softwareRows.map((row) => ({ row, known: bestKnown(row.version) }));
			const matched = scored
				.filter((s) => s.known)
				.sort((a, b) => b.known!.score - a.known!.score || compareVersions(b.row.version, a.row.version))[0];
			const chosen = matched?.row ?? [...softwareRows].sort((a, b) => compareVersions(b.version, a.version))[0];
			const knownSpelling = (version: string) => bestKnown(version)?.version;
			for (const other of softwareRows) {
				if (other === chosen) continue;
				result.skippedProducts.push(
					`${bundleCode}: ${software.name} ${other.version} (other release; ${chosen.version} used)`
				);
				result.counts.skipped++;
			}
			items.push({
				software_id: software.id,
				new_version: knownSpelling(chosen.version) ?? chosen.version,
				new_ptf_level: chosen.ptf_level || bundleCode,
				notes: chosen.notes || undefined
			});
		}

		const existing = await db.vendor_bundles.findFirst({
			where: { vendor_id: vendor.id, code: bundleCode },
			select: { id: true, active: true, description: true, source_url: true }
		});
		const bundleType =
			(['CARS', 'RSU', 'OTHER'] as const).find((t) => t === first.bundle_type.toUpperCase()) ??
			guessBundleType(bundleCode);

		// A level is complete: products the vendor did not list (Broadcom only publishes
		// service lists for products with new PTFs) keep their version from the previous level.
		const previous = await db.vendor_bundles.findFirst({
			where: {
				vendor_id: vendor.id,
				bundle_type: bundleType,
				release_date: { lte: releaseDate },
				code: { not: bundleCode }
			},
			orderBy: [{ release_date: 'desc' }, { code: 'desc' }],
			select: {
				code: true,
				items: { select: { software_id: true, software_version_id: true, software: { select: { active: true } } } }
			}
		});
		const listed = new Set(items.map((item) => item.software_id));
		for (const item of previous?.items ?? []) {
			if (listed.has(item.software_id) || !item.software.active) continue;
			items.push({
				software_id: item.software_id,
				software_version_id: item.software_version_id,
				notes: `Unchanged since ${previous!.code}`
			});
			result.carriedForward++;
		}

		try {
			const saved = await saveBundle(
				{
					vendor_id: vendor.id,
					name: first.bundle_name || `${vendor.name} ${bundleCode}`,
					code: bundleCode,
					bundle_type: bundleType,
					release_date: releaseDate,
					description: existing
						? (existing.description ?? undefined)
						: `Imported ${new Date().toISOString().slice(0, 10)}`,
					source_url: first.source_url || existing?.source_url || undefined,
					active: existing ? existing.active : true,
					items
				},
				existing?.id
			);
			result.versionsCreated += saved.versionsCreated;
			if (existing) result.counts.updated++;
			else result.counts.created++;
		} catch (error) {
			result.errors.push(`${bundleCode}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	const { created, updated, skipped } = result.counts;
	result.success = result.errors.length === 0 || created + updated > 0;
	result.message =
		`Bundles: ${created} created, ${updated} updated. ` +
		`${result.versionsCreated} new version(s), ${result.carriedForward} unchanged product(s) carried over ` +
		`from the previous level. ${skipped} row(s) skipped.`;
	return result;
}

/** Software with versions, for the bundle item dropdowns. */
export function loadSoftwareForBundles() {
	return db.software.findMany({
		where: { active: true },
		select: {
			id: true,
			name: true,
			vendor_id: true,
			product_code: true,
			versions: {
				select: { id: true, version: true, ptf_level: true, is_current: true },
				orderBy: [{ release_date: 'desc' }, { version: 'desc' }]
			}
		},
		orderBy: { name: 'asc' }
	});
}

/** Active vendors, for the bundle vendor dropdown. */
export function loadVendorOptions() {
	return db.vendors.findMany({
		where: { active: true },
		select: { id: true, name: true, code: true },
		orderBy: { name: 'asc' }
	});
}
