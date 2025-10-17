/**
 * Core domain types for the Software Inventory System
 * Uses Prisma-generated types as source of truth
 */
import type {
	customers,
	vendors,
	software,
	software_versions,
	packages,
	package_items,
	lpars,
	lpar_software,
	audit_log
} from '@prisma/client';

// Export Prisma types directly
export type Customer = customers;
export type Vendor = vendors;
export type Software = software & { vendors?: Vendor };
export type SoftwareVersionRecord = software_versions;
export type PackageItem = package_items & {
	software?: Software;
	software_version?: SoftwareVersionRecord;
};
export type Package = packages & {
	package_items?: PackageItem[];
	items?: PackageItem[] // Alias for consistency
};
export type Lpar = lpars & {
	customers?: Customer;
	packages?: Package;
	lpar_software?: LparSoftware[];
};
export type LparSoftware = lpar_software & {
	software?: Software;
};
export type AuditLog = audit_log;

// Helper type for version information
export interface SoftwareVersion {
	version: string;
	ptfLevel?: string;
}

// Form types for creating/updating entities
export type CustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
export type VendorInput = Omit<Vendor, 'id' | 'created_at' | 'updated_at'>;
export type SoftwareInput = Omit<Software, 'id' | 'created_at' | 'updated_at' | 'vendors'>;
export type PackageInput = Omit<Package, 'id' | 'created_at' | 'updated_at'>;
export type LparInput = Omit<Lpar, 'id' | 'created_at' | 'updated_at'>;

// List view types
export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface SortOptions {
	field: string;
	direction: 'asc' | 'desc';
}

export interface FilterOptions {
	search?: string;
	active?: boolean;
	customer_id?: string;
	vendor_id?: string;
	package_id?: string;
}
