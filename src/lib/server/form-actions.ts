/**
 * Generic form action factory for common CRUD operations
 * Reduces duplication across entity create/update forms
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { fail, redirect } from '@sveltejs/kit';
import { serverValidate } from '$lib/utils/superforms';
import { checkUniqueConstraint, createAuditLog } from '$lib/server/db';

/**
 * Configuration for generic create form action
 */
export interface CreateFormActionConfig<T extends z.ZodType> {
	/** Zod schema for validation */
	schema: T;
	/** Prisma model delegate (e.g., db.vendors, db.customers) */
	model: any;
	/** Entity type name for audit logging (e.g., 'vendor', 'customer') */
	entityType: string;
	/** Function to generate redirect path after successful creation */
	redirectPath: (id: string) => string;
	/** Optional: Transform validated data before database insert */
	transform?: (data: z.infer<T>) => any;
	/** Optional: Additional validation checks */
	additionalValidation?: (data: z.infer<T>) => Promise<{ valid: true } | { valid: false; errors: Record<string, string[]> }>;
	/** Optional: Check for unique code constraint (defaults to true) */
	checkUniqueCode?: boolean;
}

/**
 * Creates a generic form action for entity creation
 * Handles validation, unique code checking, database insertion, audit logging, and redirection
 *
 * @example
 * export const actions: Actions = {
 *   default: createFormAction({
 *     schema: vendorSchema,
 *     model: db.vendors,
 *     entityType: 'vendor',
 *     redirectPath: (id) => `/vendors/${id}`
 *   })
 * };
 *
 * @example With data transformation
 * export const actions: Actions = {
 *   default: createFormAction({
 *     schema: vendorSchema,
 *     model: db.vendors,
 *     entityType: 'vendor',
 *     redirectPath: (id) => `/vendors/${id}`,
 *     transform: (data) => ({
 *       ...data,
 *       website: data.website || null,
 *       contact_email: data.contact_email || null
 *     })
 *   })
 * };
 */
export function createFormAction<T extends z.ZodType>(
	config: CreateFormActionConfig<T>
) {
	return async (event: RequestEvent) => {
		// Validate form data with schema
		const form = await serverValidate(event, config.schema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code constraint (if enabled)
		if (config.checkUniqueCode !== false && 'code' in form.data) {
			const uniqueCheck = await checkUniqueConstraint(
				config.model,
				'code',
				(form.data as any).code
			);

			if (uniqueCheck.exists) {
				return fail(400, {
					form: {
						...form,
						errors: {
							...form.errors,
							code: { _errors: [uniqueCheck.error!] }
						}
					}
				});
			}
		}

		// Run additional validation if provided
		if (config.additionalValidation) {
			const additionalCheck = await config.additionalValidation(form.data);
			if (!additionalCheck.valid) {
				return fail(400, {
					form: {
						...form,
						errors: {
							...form.errors,
							...additionalCheck.errors
						}
					}
				});
			}
		}

		try {
			// Transform data if transform function provided
			const data = config.transform ? config.transform(form.data) : form.data;

			// Create entity in database
			const record = await config.model.create({ data });

			// Create audit log entry
			await createAuditLog(config.entityType, record.id, 'create', record);

			// Redirect to specified path
			redirect(303, config.redirectPath(record.id));
		} catch (error) {
			console.error(`Error creating ${config.entityType}:`, error);
			return fail(500, { form });
		}
	};
}

/**
 * Configuration for generic update form action
 */
export interface UpdateFormActionConfig<T extends z.ZodType> {
	/** Zod schema for validation */
	schema: T;
	/** Prisma model delegate (e.g., db.vendors, db.customers) */
	model: any;
	/** Entity type name for audit logging (e.g., 'vendor', 'customer') */
	entityType: string;
	/** Entity ID to update */
	id: string;
	/** Function to generate redirect path after successful update */
	redirectPath: (id: string) => string;
	/** Optional: Transform validated data before database update */
	transform?: (data: z.infer<T>) => any;
	/** Optional: Additional validation checks */
	additionalValidation?: (data: z.infer<T>) => Promise<{ valid: true } | { valid: false; errors: Record<string, string[]> }>;
	/** Optional: Check for unique code constraint (defaults to true) */
	checkUniqueCode?: boolean;
}

/**
 * Creates a generic form action for entity updates
 * Handles validation, unique code checking (excluding self), database update, audit logging, and redirection
 *
 * @example
 * export const actions: Actions = {
 *   default: createUpdateFormAction({
 *     schema: vendorUpdateSchema,
 *     model: db.vendors,
 *     entityType: 'vendor',
 *     id: params.id,
 *     redirectPath: () => '/vendors'
 *   })
 * };
 */
export function createUpdateFormAction<T extends z.ZodType>(
	config: UpdateFormActionConfig<T>
) {
	return async (event: RequestEvent) => {
		// Validate form data with schema
		const form = await serverValidate(event, config.schema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code constraint (excluding self)
		if (config.checkUniqueCode !== false && 'code' in form.data) {
			const existingWithCode = await config.model.findFirst({
				where: {
					code: (form.data as any).code,
					id: { not: config.id }
				}
			});

			if (existingWithCode) {
				return fail(400, {
					form: {
						...form,
						errors: {
							...form.errors,
							code: { _errors: ['This code is already in use by another record'] }
						}
					}
				});
			}
		}

		// Run additional validation if provided
		if (config.additionalValidation) {
			const additionalCheck = await config.additionalValidation(form.data);
			if (!additionalCheck.valid) {
				return fail(400, {
					form: {
						...form,
						errors: {
							...form.errors,
							...additionalCheck.errors
						}
					}
				});
			}
		}

		try {
			// Get old record for audit log
			const oldRecord = await config.model.findUnique({
				where: { id: config.id }
			});

			// Transform data if transform function provided
			const data = config.transform ? config.transform(form.data) : form.data;

			// Update entity in database
			const record = await config.model.update({
				where: { id: config.id },
				data
			});

			// Create audit log entry
			await createAuditLog(config.entityType, record.id, 'update', record, oldRecord);

			// Redirect to specified path
			redirect(303, config.redirectPath(record.id));
		} catch (error) {
			console.error(`Error updating ${config.entityType}:`, error);
			return fail(500, { form });
		}
	};
}
