/**
 * Cloning utilities for Products, Packages, and LPARs
 * Provides functions to duplicate entities with all their relationships
 */
import { db, createAuditLog } from './db';

/**
 * Clone a software product
 * Creates a new software with all metadata from the source
 */
export async function cloneSoftware(
	sourceId: string,
	newName: string,
	userId?: string
) {
	const source = await db.software.findUnique({
		where: { id: sourceId },
		include: { vendor: true }
	});

	if (!source) {
		throw new Error('Source software not found');
	}

	const cloned = await db.software.create({
		data: {
			name: newName,
			vendorId: source.vendorId,
			description: `Cloned from: ${source.name}\n\n${source.description || ''}`.trim(),
			currentVersion: source.currentVersion,
			currentPtfLevel: source.currentPtfLevel,
			versionHistory: source.versionHistory,
			active: source.active
		}
	});

	// Create audit log
	await createAuditLog('software', cloned.id, 'create', {
		action: 'clone',
		sourceId,
		sourceName: source.name,
		newName,
		...cloned
	}, userId);

	return cloned;
}

/**
 * Clone a package with all its items
 * Creates a new package version with all software dependencies
 */
export async function clonePackage(
	sourceId: string,
	newName: string,
	newCode: string,
	newVersion: string,
	userId?: string
) {
	const source = await db.package.findUnique({
		where: { id: sourceId },
		include: {
			items: {
				include: { software: true },
				orderBy: { orderIndex: 'asc' }
			}
		}
	});

	if (!source) {
		throw new Error('Source package not found');
	}

	// Check if code already exists
	const existing = await db.package.findFirst({
		where: {
			code: newCode,
			version: newVersion
		}
	});

	if (existing) {
		throw new Error('Package with this code and version already exists');
	}

	// Create cloned package with items in a transaction
	const cloned = await db.$transaction(async (tx) => {
		const newPackage = await tx.package.create({
			data: {
				name: newName,
				code: newCode,
				version: newVersion,
				description: `Cloned from: ${source.name} (${source.code} ${source.version})\n\n${source.description || ''}`.trim(),
				releaseDate: new Date(),
				active: source.active
			}
		});

		// Clone all package items
		for (const item of source.items) {
			await tx.packageItem.create({
				data: {
					packageId: newPackage.id,
					softwareId: item.softwareId,
					version: item.version,
					ptfLevel: item.ptfLevel,
					required: item.required,
					orderIndex: item.orderIndex
				}
			});
		}

		return newPackage;
	});

	// Create audit log
	await createAuditLog('package', cloned.id, 'create', {
		action: 'clone',
		sourceId,
		sourceName: source.name,
		sourceCode: source.code,
		sourceVersion: source.version,
		newName,
		newCode,
		newVersion,
		itemsCloned: source.items.length
	}, userId);

	return cloned;
}

/**
 * Clone an LPAR with all installed software
 * Optionally assign to a different customer
 */
export async function cloneLpar(
	sourceId: string,
	newName: string,
	newCode: string,
	customerId?: string,
	userId?: string
) {
	const source = await db.lpar.findUnique({
		where: { id: sourceId },
		include: {
			customer: true,
			currentPackage: true,
			softwareInstalled: {
				include: { software: true }
			}
		}
	});

	if (!source) {
		throw new Error('Source LPAR not found');
	}

	// Use provided customer or source customer
	const targetCustomerId = customerId || source.customerId;

	// Check if code already exists
	const existing = await db.lpar.findUnique({
		where: { code: newCode }
	});

	if (existing) {
		throw new Error('LPAR with this code already exists');
	}

	// Create cloned LPAR with software in a transaction
	const cloned = await db.$transaction(async (tx) => {
		const newLpar = await tx.lpar.create({
			data: {
				name: newName,
				code: newCode,
				customerId: targetCustomerId,
				description: `Cloned from: ${source.name} (${source.code})\n\n${source.description || ''}`.trim(),
				currentPackageId: source.currentPackageId,
				active: source.active
			}
		});

		// Clone all installed software
		for (const sw of source.softwareInstalled) {
			await tx.lparSoftware.create({
				data: {
					lparId: newLpar.id,
					softwareId: sw.softwareId,
					currentVersion: sw.currentVersion,
					currentPtfLevel: sw.currentPtfLevel,
					previousVersion: sw.previousVersion,
					previousPtfLevel: sw.previousPtfLevel,
					installedDate: new Date(),
					rolledBack: false // Reset rollback status for cloned LPAR
				}
			});
		}

		return newLpar;
	});

	// Create audit log
	await createAuditLog('lpar', cloned.id, 'create', {
		action: 'clone',
		sourceId,
		sourceName: source.name,
		sourceCode: source.code,
		newName,
		newCode,
		customerId: targetCustomerId,
		softwareCloned: source.softwareInstalled.length
	}, userId);

	return cloned;
}

/**
 * Clone a customer
 * Creates a new customer with metadata from the source
 */
export async function cloneCustomer(
	sourceId: string,
	newName: string,
	newCode: string,
	userId?: string
) {
	const source = await db.customer.findUnique({
		where: { id: sourceId },
		include: {
			lpars: true
		}
	});

	if (!source) {
		throw new Error('Source customer not found');
	}

	// Check if code already exists
	const existing = await db.customer.findUnique({
		where: { code: newCode }
	});

	if (existing) {
		throw new Error('Customer with this code already exists');
	}

	const cloned = await db.customer.create({
		data: {
			name: newName,
			code: newCode,
			description: `Cloned from: ${source.name} (${source.code})\n\n${source.description || ''}`.trim(),
			active: source.active
		}
	});

	// Create audit log
	await createAuditLog('customer', cloned.id, 'create', {
		action: 'clone',
		sourceId,
		sourceName: source.name,
		sourceCode: source.code,
		newName,
		newCode
	}, userId);

	return cloned;
}

/**
 * Clone a vendor
 * Creates a new vendor with metadata from the source
 */
export async function cloneVendor(
	sourceId: string,
	newName: string,
	newCode: string,
	userId?: string
) {
	const source = await db.vendor.findUnique({
		where: { id: sourceId },
		include: {
			software: true
		}
	});

	if (!source) {
		throw new Error('Source vendor not found');
	}

	// Check if code already exists
	const existing = await db.vendor.findUnique({
		where: { code: newCode }
	});

	if (existing) {
		throw new Error('Vendor with this code already exists');
	}

	const cloned = await db.vendor.create({
		data: {
			name: newName,
			code: newCode,
			website: source.website,
			contactEmail: source.contactEmail,
			active: source.active
		}
	});

	// Create audit log
	await createAuditLog('vendor', cloned.id, 'create', {
		action: 'clone',
		sourceId,
		sourceName: source.name,
		sourceCode: source.code,
		newName,
		newCode
	}, userId);

	return cloned;
}

/**
 * Get clone preview - shows what will be cloned
 */
export async function getClonePreview(entityType: 'software' | 'package' | 'lpar' | 'customer' | 'vendor', sourceId: string) {
	switch (entityType) {
		case 'software': {
			const software = await db.software.findUnique({
				where: { id: sourceId },
				include: { vendor: true }
			});
			return {
				name: software?.name,
				vendor: software?.vendor?.name,
				version: software?.currentVersion,
				ptfLevel: software?.currentPtfLevel,
				versionHistory: Array.isArray(software?.versionHistory) ? (software.versionHistory as any[]).length : 0
			};
		}
		case 'package': {
			const pkg = await db.package.findUnique({
				where: { id: sourceId },
				include: { items: true }
			});
			return {
				name: pkg?.name,
				code: pkg?.code,
				version: pkg?.version,
				itemCount: pkg?.items.length || 0,
				releaseDate: pkg?.releaseDate
			};
		}
		case 'lpar': {
			const lpar = await db.lpar.findUnique({
				where: { id: sourceId },
				include: {
					customer: true,
					currentPackage: true,
					softwareInstalled: true
				}
			});
			return {
				name: lpar?.name,
				code: lpar?.code,
				customer: lpar?.customer?.name,
				package: lpar?.currentPackage?.name,
				softwareCount: lpar?.softwareInstalled.length || 0
			};
		}
		case 'customer': {
			const customer = await db.customer.findUnique({
				where: { id: sourceId },
				include: { lpars: true }
			});
			return {
				name: customer?.name,
				code: customer?.code,
				lparCount: customer?.lpars.length || 0,
				active: customer?.active
			};
		}
		case 'vendor': {
			const vendor = await db.vendor.findUnique({
				where: { id: sourceId },
				include: { software: true }
			});
			return {
				name: vendor?.name,
				code: vendor?.code,
				website: vendor?.website,
				softwareCount: vendor?.software.length || 0,
				active: vendor?.active
			};
		}
	}
}
