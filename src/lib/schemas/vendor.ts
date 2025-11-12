/**
 * Vendor validation schemas
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

/**
 * Base vendor fields shared between create and update schemas
 */
const baseVendorFields = {
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	code: z
		.string()
		.min(FIELD_LENGTHS.code.min, `Code must be at least ${FIELD_LENGTHS.code.min} characters`)
		.max(FIELD_LENGTHS.code.max)
		.regex(CODE_PATTERN, CODE_ERROR_MESSAGE),
	website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
	contact_email: z.string().email('Must be a valid email').optional().or(z.literal(''))
};

/**
 * Schema for creating a new vendor
 * Active field defaults to true
 */
export const vendorSchema = z.object({
	...baseVendorFields,
	active: z.boolean().default(true)
});

/**
 * Schema for updating an existing vendor
 * Active field is optional
 */
export const vendorUpdateSchema = z.object({
	...baseVendorFields,
	active: z.boolean().optional()
});
