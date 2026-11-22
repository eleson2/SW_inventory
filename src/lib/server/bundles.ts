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
import { compareVersions, equivalentVersion, spellLikeInventory } from '#lib/utils/version-parser.ts';

type Tx = Prisma.TransactionClient;

export class BundleValidationError extends Error {}

const normalizePtf = (ptf: string | null | undefined) => ptf?.trim().toUpperCase() || null;

/**
 * Find a software version by version + PTF level, creating it if it does not exist.
 * A version/PTF level is stored once per software, under both notations: "6.1"/"rsu2510"
 * finds an existing "V6R1M0"/"RSU2510" (via version or vendor_version). A missing
 * vendor_version is filled in on the way. Created versions are not marked current; that
 * stays a deliberate choice on the software page.
 */
export async function resolveVersion(
	tx: Tx,
	softwareId: string,
	version: string,
	ptfLevel: string | null | undefined,
	releaseDate: Date,
	vendorVersion?: string | null
): Promise<{ id: string; created: boolean }> {
	const ptf = normalizePtf(ptfLevel);
	const vendor = vendorVersion?.trim() || null;
	const versions = await tx.software_versions.findMany({
		where: { software_id: softwareId },
		select: { id: true, version: true, vendor_version: true, ptf_level: true }
	});
	const sameRelease = (v: (typeof versions)[number]) =>
		equivalentVersion(v.version, version) ||
		(!!vendor && !!v.vendor_version && equivalentVersion(v.vendor_version, vendor));
	const existing = versions.find((v) => normalizePtf(v.ptf_level) === ptf && sameRelease(v));
	if (existing) {
		if (vendor && !existing.vendor_version) {
			await tx.software_versions.update({ where: { id: existing.id }, data: { vendor_version: vendor } });
		}
		return { id: existing.id, created: false };
	}

	const created = await tx.software_versions.create({
		data: {
			software_id: softwareId,
			version: version.trim(),
			vendor_version: vendor,
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

	// A bundle lists every release the vendor ships, so a software may appear several
	// times, but each version/PTF level only once (checked again after resolving new versions)
	const softwareIds = [...new Set(items.map((item) => item.software_id))];
	const chosenIds = items.map((item) => item.software_version_id).filter((id): id is string => !!id);
	if (new Set(chosenIds).size !== chosenIds.length) {
		throw new BundleValidationError('The same version/PTF level is listed twice in this bundle');
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
		const used = new Set<string>();
		for (const item of items) {
			let versionId = item.software_version_id || '';
			if (!versionId) {
				const resolved = await resolveVersion(
					tx,
					item.software_id,
					item.new_version ?? '',
					item.new_ptf_level,
					data.release_date,
					item.new_vendor_version
				);
				versionId = resolved.id;
				if (resolved.created) versionsCreated++;
			}
			if (used.has(versionId)) {
				throw new BundleValidationError(
					`Version ${item.new_version ?? ''} ${item.new_ptf_level ?? ''} is listed twice for the same software`.replace(/\s+/g, ' ')
				);
			}
			used.add(versionId);
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
	/** Products in the file that were not in the inventory and have been added */
	softwareCreated: string[];
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
		softwareCreated: [],
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

		const allVendorSoftware = await db.software.findMany({
			where: { vendor_id: vendor.id },
			select: {
				id: true,
				name: true,
				product_code: true,
				active: true,
				versions: { select: { version: true, vendor_version: true } }
			}
		});
		const vendorSoftware = allVendorSoftware.filter((s) => s.active);
		const byCode = new Map(
			vendorSoftware.filter((s) => s.product_code).map((s) => [s.product_code!.toUpperCase(), s])
		);
		const byName = new Map(vendorSoftware.map((s) => [s.name.toLowerCase(), s]));
		const inactiveNames = new Set(allVendorSoftware.filter((s) => !s.active).map((s) => s.name.toLowerCase()));
		const createdHere: Array<{ id: string; name: string }> = [];

		/** A product the vendor ships in this level but the inventory does not have yet: add it. */
		async function addSoftware(row: BundleCsvRow) {
			const name = (row.product_name || row.product_code).trim().slice(0, 100);
			const created = await db.software.create({
				data: {
					vendor_id: vendor!.id,
					name,
					product_code: row.product_code?.trim().toUpperCase() || null,
					description: `Added by import of ${bundleCode}`
				},
				select: { id: true, name: true, product_code: true, active: true }
			});
			const software = { ...created, versions: [] as Array<{ version: string; vendor_version: string | null }> };
			byName.set(name.toLowerCase(), software);
			if (software.product_code) byCode.set(software.product_code, software);
			createdHere.push({ id: software.id, name });
			result.softwareCreated.push(`${bundleCode}: ${name}${software.product_code ? ` [${software.product_code}]` : ''}`);
			await createAuditLog('software', software.id, 'create', { after: created, source: `bundle import ${bundleCode}` });
			return software;
		}

		const first = groupRows[0];
		const releaseDate = parseDate(first.release_date) ?? new Date();

		// Match rows to software; a level may list several releases of one product
		const candidates = new Map<string, { software: (typeof vendorSoftware)[number]; rows: BundleCsvRow[] }>();
		for (const row of groupRows) {
			const label = row.product_name || row.product_code || '(unnamed)';
			let software =
				(row.product_code && byCode.get(row.product_code.toUpperCase())) ||
				(row.product_name && byName.get(row.product_name.toLowerCase())) ||
				undefined;
			if (!software && (row.product_name || row.product_code) && row.version) {
				if (inactiveNames.has(label.toLowerCase())) {
					result.skippedProducts.push(`${bundleCode}: ${label} (inactive in the inventory; reactivate it to include it)`);
					result.counts.skipped++;
					continue;
				}
				software = await addSoftware(row);
			}
			if (!software) {
				result.skippedProducts.push(`${bundleCode}: ${label} (no product name or code)`);
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

		// Every release the vendor lists becomes an item, written in the inventory's notation
		// ("6.1" -> "V6R1M0", "12" -> "V12R1M0") so a release is not stored under two spellings
		const items: BundleItem[] = [];
		for (const { software, rows: softwareRows } of candidates.values()) {
			const known = software.versions.map((v) => v.version);
			const seen = new Map<string, string>();
			for (const row of softwareRows) {
				// Stored under the inventory's notation, with the vendor's spelling alongside
				const byVendorSpelling = software.versions.find(
					(v) => v.vendor_version?.trim().toUpperCase() === row.version.trim().toUpperCase()
				);
				const version = byVendorSpelling?.version ?? spellLikeInventory(row.version, known);
				const ptf = row.ptf_level || bundleCode;
				const key = `${version.toUpperCase()}|${ptf.toUpperCase()}`;
				if (seen.has(key)) {
					result.skippedProducts.push(
						`${bundleCode}: ${software.name} ${row.version} (same release as ${seen.get(key)})`
					);
					result.counts.skipped++;
					continue;
				}
				seen.set(key, row.version);
				items.push({
					software_id: software.id,
					new_version: version,
					new_vendor_version: row.version.trim(),
					new_ptf_level: ptf,
					notes: row.notes || undefined
				});
			}
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
			// Newly added products: their highest release in this level becomes the current version
			for (const created of createdHere) {
				const releases = await db.vendor_bundle_items.findMany({
					where: { bundle_id: saved.id, software_id: created.id },
					select: { software_version: { select: { id: true, version: true } } }
				});
				const top = releases
					.map((r) => r.software_version)
					.sort((a, b) => compareVersions(b.version, a.version))[0];
				if (!top) continue;
				await db.software_versions.update({ where: { id: top.id }, data: { is_current: true } });
				await db.software.update({ where: { id: created.id }, data: { current_version_id: top.id } });
			}
			if (existing) result.counts.updated++;
			else result.counts.created++;
		} catch (error) {
			result.errors.push(`${bundleCode}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	const { created, updated, skipped } = result.counts;
	result.success = result.errors.length === 0 || created + updated > 0;
	result.message =
		`Bundles: ${created} created, ${updated} updated. ${result.softwareCreated.length} new software product(s), ` +
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
				select: { id: true, version: true, vendor_version: true, ptf_level: true, is_current: true },
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
