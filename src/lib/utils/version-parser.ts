/**
 * Utilities for parsing and comparing software versions and PTF levels
 */
import type { SoftwareVersion } from '$types';

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
export function comparePtfLevels(p1: string | undefined, p2: string | undefined): number {
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
export function formatSoftwareVersion(sv: SoftwareVersion): string {
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
