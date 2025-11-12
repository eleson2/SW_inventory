/**
 * Customer validation schemas
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

/**
 * Base customer fields shared between create and update schemas
 */
const baseCustomerFields = {
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	code: z
		.string()
		.min(FIELD_LENGTHS.code.min, `Code must be at least ${FIELD_LENGTHS.code.min} characters`)
		.max(FIELD_LENGTHS.code.max)
		.regex(CODE_PATTERN, CODE_ERROR_MESSAGE),
	description: z.string().max(FIELD_LENGTHS.description.max).optional()
};

/**
 * Schema for creating a new customer
 * Active field defaults to true
 */
export const customerSchema = z.object({
	...baseCustomerFields,
	active: z.boolean().default(true)
});

/**
 * Schema for updating an existing customer
 * Active field is optional
 */
export const customerUpdateSchema = z.object({
	...baseCustomerFields,
	active: z.boolean().optional()
});
