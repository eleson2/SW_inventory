/**
 * Core domain types for the Software Inventory System
 */

export interface Customer {
	id: string;
	name: string;
	code: string;
	description?: string;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface Vendor {
	id: string;
	name: string;
	code: string;
	website?: string;
	contactEmail?: string;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface SoftwareVersion {
	version: string;
	ptfLevel?: string;
}

export interface Software {
	id: string;
	name: string;
	vendorId: string;
	vendor?: Vendor;
	description?: string;
	currentVersion: SoftwareVersion;
	versionHistory: SoftwareVersion[];
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface PackageItem {
	softwareId: string;
	software?: Software;
	version: SoftwareVersion;
	required: boolean;
	order: number;
}

export interface Package {
	id: string;
	name: string;
	code: string;
	description?: string;
	version: string;
	items: PackageItem[];
	releaseDate: Date;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface LparSoftware {
	softwareId: string;
	software?: Software;
	version: SoftwareVersion;
	installedDate: Date;
	previousVersion?: SoftwareVersion;
	rolledBack: boolean;
}

export interface Lpar {
	id: string;
	name: string;
	code: string;
	customerId: string;
	customer?: Customer;
	description?: string;
	currentPackageId?: string;
	currentPackage?: Package;
	softwareInstalled: LparSoftware[];
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface AuditLog {
	id: string;
	entityType: 'customer' | 'vendor' | 'software' | 'package' | 'lpar';
	entityId: string;
	action: 'create' | 'update' | 'delete' | 'rollback';
	changes: Record<string, any>;
	userId?: string;
	timestamp: Date;
}

// Form types for creating/updating entities
export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
export type VendorInput = Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>;
export type SoftwareInput = Omit<Software, 'id' | 'createdAt' | 'updatedAt' | 'vendor'>;
export type PackageInput = Omit<Package, 'id' | 'createdAt' | 'updatedAt'>;
export type LparInput = Omit<Lpar, 'id' | 'createdAt' | 'updatedAt' | 'customer' | 'currentPackage'>;

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
	customerId?: string;
	vendorId?: string;
	packageId?: string;
}
