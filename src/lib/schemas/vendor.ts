/**
 * Vendor validation schemas
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

export const vendorSchema = z.object({
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
	contact_email: z.string().email('Must be a valid email').optional().or(z.literal('')),
	active: z.boolean().default(true)
});

export const vendorUpdateSchema = z.object({
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
	contact_email: z.string().email('Must be a valid email').optional().or(z.literal('')),
	active: z.boolean().optional()
});
