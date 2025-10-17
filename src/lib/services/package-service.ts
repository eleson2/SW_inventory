/**
 * Service for managing software packages and LPAR deployments
 */
import type { Package, PackageItem, Lpar, LparSoftware, SoftwareVersion } from '$types';
import { compareSoftwareVersions, isVersionCompatible } from '$utils/version-parser';

/**
 * Get the subset of package items relevant for a specific customer's LPAR
 * A customer only receives the software that are relevant for them
 */
export function getCustomerPackageSubset(
	fullPackage: Package,
	customerRequirements: string[]
): PackageItem[] {
	if (!fullPackage.items) return [];
	return fullPackage.items.filter(item =>
		customerRequirements.includes(item.software_id)
	);
}

/**
 * Check if an LPAR has all required software from its assigned package
 */
export function validateLparPackageCompliance(
	lpar: Lpar,
	fullPackage: Package
): {
	compliant: boolean;
	missingSoftware: PackageItem[];
	outdatedSoftware: Array<{ item: PackageItem; installed: SoftwareVersion }>;
} {
	const missingSoftware: PackageItem[] = [];
	const outdatedSoftware: Array<{ item: PackageItem; installed: SoftwareVersion }> = [];

	if (!fullPackage.items || !lpar.lpar_software) return {
		compliant: true,
		missingSoftware,
		outdatedSoftware
	};

	for (const packageItem of fullPackage.items) {
		const installed = lpar.lpar_software.find(
			(s) => s.software_id === packageItem.software_id
		);

		if (!installed) {
			if (packageItem.required) {
				missingSoftware.push(packageItem);
			}
		} else {
			// Check if version is compatible - using current_version from lpar_software
			const installedVersion = {
				version: installed.current_version,
				ptfLevel: installed.current_ptf_level || undefined
			};
			// Note: packageItem should have software_version relation loaded for comparison
			// For now, skip version comparison as structure changed
			// TODO: Update this to use software_version_id comparison
		}
	}

	return {
		compliant: missingSoftware.length === 0 && outdatedSoftware.length === 0,
		missingSoftware,
		outdatedSoftware
	};
}

/**
 * Generate a deployment plan for upgrading an LPAR to a new package
 */
export function generateDeploymentPlan(
	lpar: Lpar,
	targetPackage: Package,
	customerRequirements: string[]
): {
	toInstall: PackageItem[];
	toUpgrade: Array<{ item: PackageItem; currentVersion: SoftwareVersion }>;
	toRemove: LparSoftware[];
	noChange: LparSoftware[];
} {
	const relevantPackageItems = getCustomerPackageSubset(targetPackage, customerRequirements);
	const toInstall: PackageItem[] = [];
	const toUpgrade: Array<{ item: PackageItem; currentVersion: SoftwareVersion }> = [];
	const toRemove: LparSoftware[] = [];
	const noChange: LparSoftware[] = [];

	if (!lpar.lpar_software) return {
		toInstall: relevantPackageItems,
		toUpgrade,
		toRemove,
		noChange
	};

	// Check each package item
	for (const packageItem of relevantPackageItems) {
		const installed = lpar.lpar_software.find(
			(s) => s.software_id === packageItem.software_id
		);

		if (!installed) {
			toInstall.push(packageItem);
		} else {
			// Compare versions using software_version_id
			// For now, mark as no change if already installed
			// TODO: Implement proper version comparison using software_version_id
			noChange.push(installed);
		}
	}

	// Check for software to remove (not in new package)
	const packageSoftwareIds = new Set(relevantPackageItems.map(i => i.software_id));
	for (const installed of lpar.lpar_software) {
		if (!packageSoftwareIds.has(installed.software_id)) {
			toRemove.push(installed);
		}
	}

	return {
		toInstall,
		toUpgrade,
		toRemove,
		noChange
	};
}

/**
 * Rollback a specific software to its previous version
 */
export function rollbackSoftware(
	lpar: Lpar,
	softwareId: string
): LparSoftware | null {
	if (!lpar.lpar_software) return null;

	const installed = lpar.lpar_software.find((s) => s.software_id === softwareId);

	if (!installed || !installed.previous_version) {
		return null;
	}

	return {
		...installed,
		current_version: installed.previous_version,
		current_ptf_level: installed.previous_ptf_level,
		previous_version: installed.current_version,
		previous_ptf_level: installed.current_ptf_level,
		rolled_back: true,
		installed_date: new Date()
	};
}

/**
 * Calculate compatibility score between LPAR and package
 * Returns a percentage of how compatible the LPAR's current software is with the package
 */
export function calculateCompatibilityScore(
	lpar: Lpar,
	targetPackage: Package
): number {
	if (!targetPackage.items || targetPackage.items.length === 0) return 100;
	if (!lpar.lpar_software) return 0;

	let compatibleCount = 0;

	for (const packageItem of targetPackage.items) {
		const installed = lpar.lpar_software.find(
			(s) => s.software_id === packageItem.software_id
		);

		if (installed) {
			// For now, count as compatible if installed
			// TODO: Implement proper version comparison using software_version_id
			compatibleCount++;
		}
	}

	return Math.round((compatibleCount / targetPackage.items.length) * 100);
}
