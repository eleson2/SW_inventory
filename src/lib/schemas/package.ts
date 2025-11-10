/**
 * Package validation schemas
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

// Schema for individual package items (detail entity)
export const packageItemSchema = z.object({
	id: z.string().uuid().optional(), // Optional for new items
	software_id: z.string().uuid('Invalid software ID'),
	software_version_id: z.string().uuid('Invalid version ID'),
	_action: z.enum(['keep', 'delete']).optional() // Track item state for deletion
});

// Base package schema (master entity)
export const packageSchema = z.object({
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	code: z
		.string()
		.min(FIELD_LENGTHS.code.min, `Code must be at least ${FIELD_LENGTHS.code.min} characters`)
		.max(FIELD_LENGTHS.code.max)
		.regex(CODE_PATTERN, CODE_ERROR_MESSAGE),
	description: z.string().max(FIELD_LENGTHS.description.max).optional(),
	version: z.string().min(1, 'Version is required'),
	release_date: z.coerce.date(),
	active: z.boolean().default(true)
});

// Master-detail schema for package with items
export const packageWithItemsSchema = packageSchema.extend({
	items: z.array(packageItemSchema).default([])
});

// Update schema with optional items array
export const packageUpdateSchema = packageSchema
	.partial()
	.required({ name: true, code: true, version: true })
	.extend({
		items: z.array(packageItemSchema).optional()
	});

// Type exports for convenience
export type PackageItem = z.infer<typeof packageItemSchema>;
export type PackageWithItems = z.infer<typeof packageWithItemsSchema>;
