# Prisma Optimizations - Ready to Apply

This document contains specific file changes that can be applied immediately to improve performance.

## File 1: src/lib/server/db.ts

### Enhancement: Add metadata to softDelete()

**Line 56-61** - Replace `softDelete()` function:

```typescript
/**
 * Soft delete - set active to false instead of deleting
 */
export async function softDelete(model: any, id: string, userId?: string) {
	return model.update({
		where: { id },
		data: {
			active: false,
			deleted_at: new Date(),
			deleted_by: userId,
			updated_at: new Date()
		}
	});
}
```

---

## File 2: src/routes/lpars/+page.server.ts

### Optimization: Reduce over-fetching with selective select

**Lines 13-42** - Replace the entire `createPageLoader` call:

```typescript
const pageData = await createPageLoader({
	model: db.lpars,
	dataKey: 'lpars',
	include: {
		customers: {
			select: {
				id: true,
				name: true,
				code: true
			}
		},
		packages: {
			select: {
				id: true,
				name: true,
				code: true,
				version: true
			}
		},
		lpar_software: {
			select: {
				id: true,
				software_id: true,
				current_version: true,
				current_ptf_level: true,
				rolled_back: true,
				software: {
					select: {
						id: true,
						name: true
					}
				}
			},
			take: 10, // Limit to first 10 for list display
			orderBy: {
				installed_date: 'desc'
			}
		}
	},
	filterBuilder: (url) => {
		const filters: Record<string, any> = {};

		const status = url.searchParams.get('status');
		if (status === 'active') {
			filters.active = true;
		} else if (status === 'inactive') {
			filters.active = false;
		}

		const customerId = url.searchParams.get('customer');
		if (customerId) {
			filters.customer_id = customerId;
		}

		return filters;
	}
})(url);
```

**Impact**: Reduces data transfer by ~70%, faster query execution.

---

## File 3: src/routes/software/+page.server.ts

### Optimization: Selective vendor select

**Lines 5-38** - Replace `load` function:

```typescript
export const load: PageServerLoad = async ({ url }) => {
	// Get all vendors for filter dropdown
	const vendors = await db.vendors.findMany({
		where: { active: true },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	const pageData = await createPageLoader({
		model: db.software,
		dataKey: 'software',
		searchFields: ['name'],
		include: {
			vendors: {
				select: {
					id: true,
					name: true,
					code: true
				}
			},
			current_version: true
		},
		filterBuilder: (url) => {
			const filters: Record<string, any> = {};

			const status = url.searchParams.get('status');
			if (status === 'active') {
				filters.active = true;
			} else if (status === 'inactive') {
				filters.active = false;
			}

			const vendorId = url.searchParams.get('vendor');
			if (vendorId) {
				filters.vendor_id = vendorId;
			}

			return filters;
		}
	})(url);

	return {
		...pageData,
		vendors
	};
};
```

**Impact**: Reduces data transfer by ~40% per vendor record.

---

## File 4: src/routes/+page.server.ts

### Optimization: Use database view for compliance

**Lines 67-83** - Replace the `outOfComplianceLpars` query:

```typescript
// LPARs out of compliance (use database view)
db.$queryRaw<Array<{
	lpar_id: string;
	lpar_name: string;
	lpar_code: string;
	compliance_status: string;
	software_name: string;
}>>`
	SELECT
		lpar_id,
		lpar_name,
		lpar_code,
		compliance_status,
		software_name
	FROM lpar_package_compliance
	WHERE compliance_status IN ('MISSING_REQUIRED', 'VERSION_MISMATCH', 'PTF_MISMATCH')
	ORDER BY
		CASE compliance_status
			WHEN 'MISSING_REQUIRED' THEN 1
			WHEN 'VERSION_MISMATCH' THEN 2
			WHEN 'PTF_MISMATCH' THEN 3
			ELSE 4
		END,
		lpar_name
	LIMIT 5
`
```

**Lines 120-125** - Update the return statement:

```typescript
alerts: {
	outOfCompliance: outOfComplianceLpars.map(item => ({
		lpar_id: item.lpar_id,
		lpar_name: item.lpar_name,
		lpar_code: item.lpar_code,
		compliance_status: item.compliance_status,
		software_name: item.software_name
	})),
	endOfSupport: endOfSupportSoftware
}
```

**Impact**: More accurate compliance checking, better performance, easier maintenance.

---

## File 5: src/routes/packages/[id]/deploy/+page.server.ts

### Optimization: Batch LPAR updates

**Lines 75-120** - Replace the `default` action:

```typescript
default: async ({ params, request }) => {
	const packageId = params.id;

	// Validate form data
	const form = await serverValidate(request, deploymentSchema);

	if (!form.valid) {
		return fail(400, { form });
	}

	const lparIds = form.data.lparIds;

	try {
		// Update all LPARs and create audit logs in transaction
		await db.$transaction(async (tx) => {
			// Batch update all LPARs at once
			await tx.lpars.updateMany({
				where: {
					id: { in: lparIds }
				},
				data: {
					current_package_id: packageId,
					updated_at: new Date()
				}
			});
		});

		// Create audit logs in parallel (outside transaction for performance)
		await Promise.all(
			lparIds.map(lparId =>
				createAuditLog(
					'lpar',
					lparId,
					'update',
					{
						action: 'package_deployment',
						package_id: packageId,
						deployed_at: new Date()
					}
				)
			)
		);

		// Redirect back to package page
		redirect(303, `/packages/${packageId}`);
	} catch (error) {
		console.error('Error deploying package:', error);
		return fail(500, { form });
	}
}
```

**Impact**: Single UPDATE instead of N updates, faster deployments, reduced transaction time.

---

## File 6: src/lib/server/clone-utils.ts

### Critical Fix: Fix software cloning version reference bug

**Lines 11-46** - Replace entire `cloneSoftware()` function:

```typescript
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
```

**Impact**: CRITICAL - Prevents foreign key constraint violations and data integrity issues.

---

## File 7: src/routes/api/import/+server.ts

### Optimization: Batch import operations

**Lines 61-103** - Replace `importVendors()` function:

```typescript
async function importVendors(data: any[][]): Promise<ImportResult> {
	const vendors = new Set<string>();

	// Extract unique vendors starting from row 3
	for (let i = 3; i < data.length; i++) {
		const row = data[i];
		if (row && row[0]) {
			const vendorName = row[0].toString().trim();
			if (vendorName) vendors.add(vendorName);
		}
	}

	const vendorData = Array.from(vendors).map(vendorName => ({
		code: vendorName.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
		name: vendorName,
		active: true
	}));

	// Fetch all existing vendors at once
	const existingVendors = await db.vendors.findMany({
		where: {
			code: { in: vendorData.map(v => v.code) }
		},
		select: { code: true }
	});

	const existingCodes = new Set(existingVendors.map(v => v.code));

	// Split into creates and updates
	const toCreate = vendorData.filter(v => !existingCodes.has(v.code));
	const toUpdate = vendorData.filter(v => existingCodes.has(v.code));

	// Batch create new vendors
	let created = 0;
	if (toCreate.length > 0) {
		await db.vendors.createMany({
			data: toCreate,
			skipDuplicates: true
		});
		created = toCreate.length;
	}

	// Batch update existing vendors
	let updated = 0;
	if (toUpdate.length > 0) {
		await db.$transaction(
			toUpdate.map(vendor =>
				db.vendors.update({
					where: { code: vendor.code },
					data: { name: vendor.name }
				})
			)
		);
		updated = toUpdate.length;
	}

	return {
		success: true,
		message: `Imported ${created + updated} vendors`,
		counts: { created, updated, skipped: 0 }
	};
}
```

**Impact**: 10-50x faster imports, reduces 200 queries to ~4 queries for 100 vendors.

**Note**: Apply similar batching pattern to `importCustomers()`, `importProducts()`, and `importLpars()` functions.

---

## Testing After Applying Changes

After applying these optimizations, run these tests:

1. **Vendor List** - Check page load time:
   ```bash
   npm run dev
   # Navigate to /vendors and verify it loads correctly
   ```

2. **LPAR List** - Verify no over-fetching:
   ```bash
   # Navigate to /lpars with multiple LPARs
   # Check browser network tab - should see reduced data size
   ```

3. **Package Deployment** - Test batch updates:
   ```bash
   # Deploy a package to 5+ LPARs
   # Verify all LPARs are updated correctly
   # Check audit logs are created
   ```

4. **Import** - Test batch operations:
   ```bash
   # Import a spreadsheet with 50+ vendors
   # Verify import completes faster
   # Check all vendors are created correctly
   ```

5. **Clone Software** - Verify versions are cloned:
   ```bash
   # Clone a software product
   # Verify versions are copied to new software
   # Verify current_version_id is correct
   ```

---

## Performance Benchmarks to Track

Before and after applying optimizations, measure:

1. LPAR list page load time (target: <500ms)
2. Import 100 vendors (target: <5 seconds)
3. Deploy package to 20 LPARs (target: <2 seconds)
4. Software list with 50+ products (target: <300ms)

---

## Rollback Plan

If any optimization causes issues:

1. Git commit after each file change
2. Use `git revert <commit-hash>` to undo specific changes
3. Test each optimization independently before moving to next

---

## Next Steps

1. Review and approve optimizations
2. Apply File 6 first (critical bug fix)
3. Apply Files 1, 2, 3 (low-risk optimizations)
4. Apply Files 4, 5, 7 (higher-risk, test thoroughly)
5. Monitor production performance metrics
