/**
 * Zod validation schemas for forms and API validation
 */
import { z } from 'zod';

// Version parsing schema
export const softwareVersionSchema = z.object({
	version: z.string().min(1, 'Version is required'),
	ptfLevel: z.string().optional()
});

// Customer schemas
export const customerSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	description: z.string().max(500).optional(),
	active: z.boolean().default(true)
});

export const customerUpdateSchema = customerSchema.partial().required({ name: true, code: true });

// Vendor schemas
export const vendorSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
	contactEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
	active: z.boolean().default(true)
});

export const vendorUpdateSchema = vendorSchema.partial().required({ name: true, code: true });

// Software schemas
export const softwareSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	vendorId: z.string().uuid('Invalid vendor'),
	description: z.string().max(500).optional(),
	currentVersion: softwareVersionSchema,
	versionHistory: z.array(softwareVersionSchema).default([]),
	active: z.boolean().default(true)
});

export const softwareUpdateSchema = softwareSchema.partial().required({ name: true, vendorId: true });

// Package schemas
export const packageItemSchema = z.object({
	softwareId: z.string().uuid('Invalid software ID'),
	version: softwareVersionSchema,
	required: z.boolean().default(true),
	order: z.number().int().min(0)
});

export const packageSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	description: z.string().max(500).optional(),
	version: z.string().min(1, 'Version is required'),
	items: z.array(packageItemSchema).min(1, 'Package must contain at least one software'),
	releaseDate: z.coerce.date(),
	active: z.boolean().default(true)
});

export const packageUpdateSchema = packageSchema.partial().required({ name: true, code: true, version: true });

// LPAR schemas
export const lparSoftwareSchema = z.object({
	softwareId: z.string().uuid('Invalid software ID'),
	version: softwareVersionSchema,
	installedDate: z.coerce.date(),
	previousVersion: softwareVersionSchema.optional(),
	rolledBack: z.boolean().default(false)
});

export const lparSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100),
	code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores'),
	customerId: z.string().uuid('Invalid customer'),
	description: z.string().max(500).optional(),
	currentPackageId: z.string().uuid('Invalid package').optional(),
	softwareInstalled: z.array(lparSoftwareSchema).default([]),
	active: z.boolean().default(true)
});

export const lparUpdateSchema = lparSchema.partial().required({ name: true, code: true, customerId: true });

// Rollback schema
export const rollbackSchema = z.object({
	lparId: z.string().uuid('Invalid LPAR ID'),
	softwareId: z.string().uuid('Invalid software ID'),
	targetVersion: softwareVersionSchema,
	reason: z.string().min(10, 'Reason must be at least 10 characters').max(500)
});

// Query/filter schemas
export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const sortSchema = z.object({
	field: z.string(),
	direction: z.enum(['asc', 'desc']).default('asc')
});

export const filterSchema = z.object({
	search: z.string().optional(),
	active: z.coerce.boolean().optional(),
	customerId: z.string().uuid().optional(),
	vendorId: z.string().uuid().optional(),
	packageId: z.string().uuid().optional()
});
