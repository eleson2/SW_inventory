/**
 * Customer validation schemas
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

export const customerSchema = z.object({
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
	active: z.boolean().default(true)
});

export const customerUpdateSchema = z.object({
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
	active: z.boolean().optional()
});
