/**
 * LPAR validation schemas
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

// Schema for individual LPAR software installation (detail entity)
export const lparSoftwareInstallationSchema = z.object({
	id: z.string().uuid().optional(), // Optional for new installations
	software_id: z.string().uuid('Invalid software ID'),
	software_version_id: z.string().uuid('Invalid version ID'),
	installed_date: z.coerce.date().default(() => new Date()),
	_action: z.enum(['keep', 'delete']).optional() // Track item state for deletion
});

export const lparSoftwareSchema = z.object({
	software_id: z.string().uuid('Invalid software ID'),
	software_version_id: z.string().uuid('Invalid version ID'),
	installed_at: z.coerce.date(),
	previous_version_id: z.string().uuid().optional(),
	rolled_back: z.boolean().default(false)
});

export const lparSchema = z.object({
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	code: z
		.string()
		.min(FIELD_LENGTHS.code.min, `Code must be at least ${FIELD_LENGTHS.code.min} characters`)
		.max(FIELD_LENGTHS.code.max)
		.regex(CODE_PATTERN, CODE_ERROR_MESSAGE),
	customer_id: z.string().uuid('Invalid customer'),
	description: z.string().max(FIELD_LENGTHS.description.max),
	current_package_id: z.string().uuid('Invalid package').or(z.literal('')),
	active: z.boolean()
});

export const lparUpdateSchema = lparSchema
	.partial()
	.required({ name: true, code: true, customer_id: true });

// Master-detail schema for LPAR with software installations
export const lparWithSoftwareSchema = lparSchema.extend({
	software_installations: z.array(lparSoftwareInstallationSchema)
});

// Type exports
export type LparSoftwareInstallation = z.infer<typeof lparSoftwareInstallationSchema>;

export const rollbackSchema = z.object({
	lpar_id: z.string().uuid('Invalid LPAR ID'),
	software_id: z.string().uuid('Invalid software ID'),
	target_version_id: z.string().uuid('Invalid version ID'),
	reason: z.string().min(10, 'Reason must be at least 10 characters').max(500)
});
