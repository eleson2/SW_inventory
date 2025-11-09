/**
 * Cloning utilities for Products, Packages, and LPARs
 * Provides functions to duplicate entities with all their relationships
 */
import { db, createAuditLog } from './db';

/**
 * Clone a software product with optional version cloning
 * Creates a new software with all metadata from the source
 */
export async function cloneSoftware(
	sourceId: string,
	newName: string,
	newDescription?: string,
	cloneVersions: boolean = true,
	userId?: string
) {
	const source = await db.software.findUnique({
		where: { id: sourceId },
		include: {
			vendors: true,
			versions: cloneVersions // Only include if cloning
		}
	});

	if (!source) {
		throw new Error('Source software not found');
	}

	return await db.$transaction(async (tx) => {
		// Create the new software first (without current_version_id)
		const cloned = await tx.software.create({
			data: {
				name: newName,
				vendor_id: source.vendor_id,
				description: newDescription || source.description,
				active: source.active
				// current_version_id will be set after cloning versions
			}
		});

		let currentVersionId: string | null = null;

		// Clone versions if requested
		if (cloneVersions && source.versions && source.versions.length > 0) {
			for (const version of source.versions) {
				const clonedVersion = await tx.software_versions.create({
					data: {
						software_id: cloned.id, // Link to NEW software
						version: version.version,
						ptf_level: version.ptf_level,
						release_date: version.release_date,
						end_of_support: version.end_of_support,
						release_notes: version.release_notes,
						is_current: version.is_current
					}
				});

				if (version.is_current) {
					currentVersionId = clonedVersion.id;
				}
			}

			// Update software with current version if one was marked current
			if (currentVersionId) {
				await tx.software.update({
					where: { id: cloned.id },
					data: { current_version_id: currentVersionId }
				});
			}
		}

		// Create audit log
		await createAuditLog('software', cloned.id, 'create', {
			action: 'clone',
			sourceId,
			sourceName: source.name,
			newName,
			versionsCloned: cloneVersions ? (source.versions?.length || 0) : 0,
			...cloned
		}, userId);

		return cloned;
	});
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
	const source = await db.packages.findUnique({
		where: { id: sourceId },
		include: {
			package_items: {
				include: { software: true },
				orderBy: { order_index: 'asc' }
			}
		}
	});

	if (!source) {
		throw new Error('Source package not found');
	}

	// Check if code already exists
	const existing = await db.packages.findFirst({
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
		const newPackage = await tx.packages.create({
			data: {
				name: newName,
				code: newCode,
				version: newVersion,
				description: `Cloned from: ${source.name} (${source.code} ${source.version})

${source.description || ''}`.trim(),
				release_date: new Date(),
				active: source.active
			}
		});

		// Clone all package items
		for (const item of source.package_items) {
			await tx.package_items.create({
				data: {
					package_id: newPackage.id,
					software_id: item.software_id,
					software_version_id: item.software_version_id,
					required: item.required,
					order_index: item.order_index
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
		itemsCloned: source.package_items.length
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
	const source = await db.lpars.findUnique({
		where: { id: sourceId },
		include: {
			customers: true,
			packages: true,
			lpar_software: {
				include: { software: true }
			}
		}
	});

	if (!source) {
		throw new Error('Source LPAR not found');
	}

	// Use provided customer or source customer
	const targetCustomerId = customerId || source.customer_id;

	// Check if code already exists
	const existing = await db.lpars.findUnique({
		where: { code: newCode }
	});

	if (existing) {
		throw new Error('LPAR with this code already exists');
	}

	// Create cloned LPAR with software in a transaction
	const cloned = await db.$transaction(async (tx) => {
		const newLpar = await tx.lpars.create({
			data: {
				name: newName,
				code: newCode,
				customer_id: targetCustomerId,
				description: `Cloned from: ${source.name} (${source.code})

${source.description || ''}`.trim(),
				current_package_id: source.current_package_id,
				active: source.active
			}
		});

		// Clone all installed software
		for (const sw of source.lpar_software) {
			await tx.lpar_software.create({
				data: {
					lpar_id: newLpar.id,
					software_id: sw.software_id,
					current_version: sw.current_version,
					current_ptf_level: sw.current_ptf_level,
					previous_version: sw.previous_version,
					previous_ptf_level: sw.previous_ptf_level,
					installed_date: new Date(),
					rolled_back: false // Reset rollback status for cloned LPAR
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
		softwareCloned: source.lpar_software.length
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
	const source = await db.customers.findUnique({
		where: { id: sourceId },
		include: {
			lpars: true
		}
	});

	if (!source) {
		throw new Error('Source customer not found');
	}

	// Check if code already exists
	const existing = await db.customers.findUnique({
		where: { code: newCode }
	});

	if (existing) {
		throw new Error('Customer with this code already exists');
	}

	const cloned = await db.customers.create({
		data: {
			name: newName,
			code: newCode,
			description: `Cloned from: ${source.name} (${source.code})

${source.description || ''}`.trim(),
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
	const source = await db.vendors.findUnique({
		where: { id: sourceId },
		include: {
			software: true
		}
	});

	if (!source) {
		throw new Error('Source vendor not found');
	}

	// Check if code already exists
	const existing = await db.vendors.findUnique({
		where: { code: newCode }
	});

	if (existing) {
		throw new Error('Vendor with this code already exists');
	}

	const cloned = await db.vendors.create({
		data: {
			name: newName,
			code: newCode,
			website: source.website,
			contact_email: source.contact_email,
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
				include: { vendors: true }
			});
			return {
				name: software?.name,
				vendor: software?.vendors?.name,
				currentVersionId: software?.current_version_id
			};
		}
		case 'package': {
			const pkg = await db.packages.findUnique({
				where: { id: sourceId },
				include: { package_items: true }
			});
			return {
				name: pkg?.name,
				code: pkg?.code,
				version: pkg?.version,
				itemCount: pkg?.package_items.length || 0,
				releaseDate: pkg?.release_date
			};
		}
		case 'lpar': {
			const lpar = await db.lpars.findUnique({
				where: { id: sourceId },
				include: {
					customers: true,
					packages: true,
					lpar_software: true
				}
			});
			return {
				name: lpar?.name,
				code: lpar?.code,
				customer: lpar?.customers?.name,
				package: lpar?.packages?.name,
				softwareCount: lpar?.lpar_software.length || 0
			};
		}
		case 'customer': {
			const customer = await db.customers.findUnique({
				where: { id: sourceId },
				include: { lpars: true }
			});
			return {
				name: customer?.name,
				code: customer?.code,
				lparCount: customer?.lpars?.length || 0,
				active: customer?.active
			};
		}
		case 'vendor': {
			const vendor = await db.vendors.findUnique({
				where: { id: sourceId },
				include: { software: true }
			});
			return {
				name: vendor?.name,
				code: vendor?.code,
				website: vendor?.website,
				softwareCount: vendor?.software?.length || 0,
				active: vendor?.active
			};
		}
	}
}
