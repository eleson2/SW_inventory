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
	return fullPackage.items.filter(item =>
		customerRequirements.includes(item.softwareId)
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

	for (const packageItem of fullPackage.items) {
		const installed = lpar.softwareInstalled.find(
			s => s.softwareId === packageItem.softwareId
		);

		if (!installed) {
			if (packageItem.required) {
				missingSoftware.push(packageItem);
			}
		} else {
			// Check if version is compatible
			if (!isVersionCompatible(installed.version, packageItem.version)) {
				outdatedSoftware.push({
					item: packageItem,
					installed: installed.version
				});
			}
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

	// Check each package item
	for (const packageItem of relevantPackageItems) {
		const installed = lpar.softwareInstalled.find(
			s => s.softwareId === packageItem.softwareId
		);

		if (!installed) {
			toInstall.push(packageItem);
		} else {
			const comparison = compareSoftwareVersions(installed.version, packageItem.version);
			if (comparison < 0) {
				// Installed version is older
				toUpgrade.push({
					item: packageItem,
					currentVersion: installed.version
				});
			} else if (comparison === 0) {
				noChange.push(installed);
			}
		}
	}

	// Check for software to remove (not in new package)
	const packageSoftwareIds = new Set(relevantPackageItems.map(i => i.softwareId));
	for (const installed of lpar.softwareInstalled) {
		if (!packageSoftwareIds.has(installed.softwareId)) {
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
	const installed = lpar.softwareInstalled.find(s => s.softwareId === softwareId);

	if (!installed || !installed.previousVersion) {
		return null;
	}

	return {
		...installed,
		version: installed.previousVersion,
		previousVersion: installed.version,
		rolledBack: true,
		installedDate: new Date()
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
	if (targetPackage.items.length === 0) return 100;

	let compatibleCount = 0;

	for (const packageItem of targetPackage.items) {
		const installed = lpar.softwareInstalled.find(
			s => s.softwareId === packageItem.softwareId
		);

		if (installed && isVersionCompatible(installed.version, packageItem.version, false)) {
			compatibleCount++;
		}
	}

	return Math.round((compatibleCount / targetPackage.items.length) * 100);
}
