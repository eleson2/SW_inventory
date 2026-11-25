import type { PrismaClient } from '@prisma/client';

/**
 * Delete all rows from every table, in foreign-key order.
 * Portable replacement for `TRUNCATE ... CASCADE` (Postgres-only).
 */
export async function clearAllData(db: PrismaClient): Promise<void> {
	await db.$transaction([
		db.audit_log.deleteMany(),
		db.lpar_set_members.deleteMany(),
		db.lpar_sets.deleteMany(),
		db.lpar_software.deleteMany(),
		db.package_items.deleteMany(),
		db.lpars.deleteMany(),
		db.packages.deleteMany(),
		db.vendor_bundle_items.deleteMany(),
		db.vendor_bundles.deleteMany(),
		// software.current_version_id points at software_versions; clear it first
		db.software.updateMany({ data: { current_version_id: null } }),
		db.software_versions.deleteMany(),
		db.software.deleteMany(),
		db.customers.deleteMany(),
		db.vendors.deleteMany()
	]);
}
