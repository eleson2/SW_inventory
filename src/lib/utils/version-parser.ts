/**
 * Utilities for parsing and comparing software versions and PTF levels
 */
import type { SoftwareVersion } from '#lib/types/index.ts';

/**
 * Parse vendor designation into version and PTF level
 * Examples:
 * - "V2R4M0-PTF12345" -> { version: "V2R4M0", ptfLevel: "PTF12345" }
 * - "2.4.0 (PTF 12345)" -> { version: "2.4.0", ptfLevel: "PTF 12345" }
 * - "14.5" -> { version: "14.5", ptfLevel: undefined }
 */
export function parseVendorDesignation(designation: string): SoftwareVersion {
	const patterns = [
		// Pattern: V2R4M0-PTF12345
		/^([VvRrMm0-9.]+)[-_]+(PTF[0-9]+)$/i,
		// Pattern: 2.4.0 (PTF 12345)
		/^([0-9.]+)\s*\(PTF\s*([0-9]+)\)$/i,
		// Pattern: V2R4M0 PTF12345
		/^([VvRrMm0-9.]+)\s+(PTF[0-9]+)$/i,
		// Pattern: 2.4.0-SP1
		/^([0-9.]+)[-_]+(SP[0-9]+)$/i,
	];

	for (const pattern of patterns) {
		const match = designation.match(pattern);
		if (match) {
			return {
				version: match[1].trim(),
				ptfLevel: match[2].trim()
			};
		}
	}

	// No PTF level found, return as version only
	return {
		version: designation.trim(),
		ptfLevel: undefined
	};
}

/**
 * Compare two version strings
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split(/[.VvRrMm]/).filter(p => p).map(p => parseInt(p) || 0);
	const parts2 = v2.split(/[.VvRrMm]/).filter(p => p).map(p => parseInt(p) || 0);

	const maxLength = Math.max(parts1.length, parts2.length);

	for (let i = 0; i < maxLength; i++) {
		const p1 = parts1[i] || 0;
		const p2 = parts2[i] || 0;

		if (p1 < p2) return -1;
		if (p1 > p2) return 1;
	}

	return 0;
}

/**
 * Compare two PTF levels
 * Returns: -1 if p1 < p2, 0 if equal, 1 if p1 > p2
 */
export function comparePtfLevels(p1: string | null | undefined, p2: string | null | undefined): number {
	if (!p1 && !p2) return 0;
	if (!p1) return -1;
	if (!p2) return 1;

	const num1 = parseInt(p1.replace(/\D/g, ''));
	const num2 = parseInt(p2.replace(/\D/g, ''));

	if (num1 < num2) return -1;
	if (num1 > num2) return 1;
	return 0;
}

/**
 * Compare two software versions including PTF levels
 * Returns: -1 if sv1 < sv2, 0 if equal, 1 if sv1 > sv2
 */
export function compareSoftwareVersions(sv1: SoftwareVersion, sv2: SoftwareVersion): number {
	const versionCompare = compareVersions(sv1.version, sv2.version);
	if (versionCompare !== 0) return versionCompare;

	return comparePtfLevels(sv1.ptfLevel, sv2.ptfLevel);
}

/**
 * Format a software version for display
 */
export function formatSoftwareVersion(sv: SoftwareVersion | null | undefined): string {
	if (!sv) return 'N/A';
	const ptf = (sv as any).ptfLevel || (sv as any).ptf_level;
	if (ptf) {
		return `${sv.version} (${ptf})`;
	}
	return sv.version;
}

/**
 * Check if a version is compatible with a package version requirement
 */
export function isVersionCompatible(
	installed: SoftwareVersion,
	required: SoftwareVersion,
	strict: boolean = false
): boolean {
	const comparison = compareSoftwareVersions(installed, required);

	if (strict) {
		// Strict mode: must match exactly
		return comparison === 0;
	} else {
		// Lenient mode: installed must be >= required
		return comparison >= 0;
	}
}

/**
 * Exact match of a version/PTF pair as stored (no numeric normalisation).
 * Treats null, undefined and '' PTF levels as equal.
 */
export function sameVersion(
	a: { version: string; ptf_level: string | null | undefined },
	b: { version: string; ptf_level: string | null | undefined }
): boolean {
	return a.version === b.version && (a.ptf_level || null) === (b.ptf_level || null);
}

/**
 * lpar_software stores version/PTF strings; map them back to a software_versions id.
 * Returns '' when no matching version exists.
 */
export function findVersionId(
	softwareById: Map<string, { versions: { id: string; version: string; ptf_level: string | null }[] }>,
	install: { software_id: string; current_version: string; current_ptf_level: string | null }
): string {
	const target = { version: install.current_version, ptf_level: install.current_ptf_level };
	return softwareById.get(install.software_id)?.versions.find((v) => sameVersion(v, target))?.id ?? '';
}

/**
 * How many leading release components two version strings share, if one is a prefix of
 * the other: "6.1" vs "V6R1M0" -> 2, "12" vs "V12R1M0" -> 1, "12" vs "V13R1M0" -> 0.
 * Vendors publish releases in different notations; this matches them up.
 */
export function releaseMatchLength(a: string, b: string): number {
	const parts = (v: string) => v.split(/[.VvRrMm]/).filter((p) => p).map((p) => parseInt(p) || 0);
	const pa = parts(a);
	const pb = parts(b);
	const n = Math.min(pa.length, pb.length);
	for (let i = 0; i < n; i++) if (pa[i] !== pb[i]) return 0;
	return n;
}

/**
 * Same version in another notation: "6.1" = "V6R1M0" = "6.1.0".
 * Versions without digits must match exactly (case-insensitive).
 */
export function equivalentVersion(a: string, b: string): boolean {
	if (a.trim().toUpperCase() === b.trim().toUpperCase()) return true;
	return /\d/.test(a) && /\d/.test(b) && compareVersions(a, b) === 0;
}

const versionParts = (v: string) =>
	v
		.split(/[.VvRrMm]/)
		.filter((p) => p)
		.map((p) => parseInt(p) || 0);

/**
 * Write a vendor's release in the notation the inventory already uses for that product,
 * so one release is not stored under two spellings:
 * - same release in another notation: "6.1" -> "V6R1M0"
 * - a shorter release that is a prefix of known ones: "12" -> "V12R1M0", "15" -> "V15R1M0"
 *   (the lowest match: IBM's "IMS 15" is 15.1)
 * - otherwise, dotted releases follow a mostly-VRM inventory: "6.3" -> "V6R3M0", "3.2" -> "V3R2"
 * The vendor's own spelling is kept separately in software_versions.vendor_version.
 */
export function spellLikeInventory(version: string, known: string[]): string {
	const trimmed = version.trim();
	const exact = known.find((k) => equivalentVersion(k, trimmed));
	if (exact) return exact;

	const parts = versionParts(trimmed);
	if (/\d/.test(trimmed)) {
		const prefixOf = known
			.filter((k) => {
				const kp = versionParts(k);
				return kp.length > parts.length && parts.every((p, i) => p === kp[i]);
			})
			.sort(compareVersions);
		if (prefixOf.length > 0) return prefixOf[0];
	}

	// Follow the notation most of the product's versions use, so one odd entry does not decide
	const vrm = known.filter((k) => /^V\d+R\d+(M\d+)?$/i.test(k));
	if (/^\d+(\.\d+)+$/.test(trimmed) && vrm.length * 2 > known.length) {
		const [v, r, m = 0] = parts;
		return vrm.every((k) => /M\d+$/i.test(k)) ? `V${v}R${r}M${m}` : `V${v}R${r}`;
	}
	return trimmed;
}

/**
 * Version for display with the vendor's notation when it differs: "V6R1M0 [6.1]".
 */
export function versionName(v: { version: string; vendor_version?: string | null }): string {
	const vendor = v.vendor_version?.trim();
	return vendor && vendor.toUpperCase() !== v.version.trim().toUpperCase() ? `${v.version} [${vendor}]` : v.version;
}
