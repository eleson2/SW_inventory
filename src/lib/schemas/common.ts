/**
 * Common validation schemas for queries, filters, and pagination
 */
import { z } from 'zod';
import { PAGINATION } from '$lib/constants/validation';

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
	pageSize: z.coerce
		.number()
		.int()
		.min(1)
		.max(PAGINATION.maxPageSize)
		.default(PAGINATION.defaultPageSize)
});

export const sortSchema = z.object({
	field: z.string(),
	direction: z.enum(['asc', 'desc']).default('asc')
});

export const filterSchema = z.object({
	search: z.string().optional(),
	active: z.coerce.boolean().optional(),
	customer_id: z.string().uuid().optional(),
	vendor_id: z.string().uuid().optional(),
	package_id: z.string().uuid().optional()
});
