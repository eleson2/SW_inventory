/**
 * Generic CRUD route factory utilities
 * Eliminates duplicate code in route handlers
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { z } from 'zod';
import { db, createAuditLog } from './db';

export interface DetailLoaderOptions<T = any> {
	/** The Prisma model delegate (e.g., db.customers, db.vendors) */
	model: any;
	/** Entity name for error messages (e.g., 'Customer', 'Vendor') */
	entityName: string;
	/** Relations to include in the query */
	include?: Record<string, any>;
	/** Transform function to modify the loaded data */
	transform?: (data: T) => T | Promise<T>;
}

/**
 * Generic detail page loader - fetches entity by ID with error handling
 *
 * @example
 * export const load: PageServerLoad = createDetailLoader({
 *   model: db.customers,
 *   entityName: 'Customer',
 *   include: { lpars: true }
 * });
 */
export function createDetailLoader<T = any>(options: DetailLoaderOptions<T>) {
	const { model, entityName, include, transform } = options;

	return async ({ params }: { params: Record<string, string> }) => {
		const entity = await model.findUnique({
			where: { id: params.id },
			include
		});

		if (!entity) {
			throw error(404, `${entityName} not found`);
		}

		const result = transform ? await transform(entity) : entity;

		return {
			[entityName.toLowerCase()]: result
		};
	};
}

export interface CreateActionOptions<TSchema extends z.ZodTypeAny = any> {
	/** Zod validation schema */
	schema: TSchema;
	/** The Prisma model delegate */
	model: any;
	/** Entity type for audit log (e.g., 'customer', 'vendor') */
	entityType: string;
	/** Redirect path after successful create (can use {id} placeholder) */
	redirectPath: string;
	/** Function to extract data from FormData */
	extractFormData: (formData: FormData) => Record<string, any>;
	/** Check for uniqueness constraint violations before creating */
	checkUnique?: (validated: z.infer<TSchema>) => Promise<{
		exists: boolean;
		field: string;
		message: string;
	} | null>;
	/** Transform validated data before database insert */
	transformData?: (validated: z.infer<TSchema>) => Record<string, any> | Promise<Record<string, any>>;
}

/**
 * Generic create action handler with validation, uniqueness checks, and audit logging
 *
 * @example
 * export const actions: Actions = {
 *   default: createCreateAction({
 *     schema: customerSchema,
 *     model: db.customers,
 *     entityType: 'customer',
 *     redirectPath: '/customers',
 *     extractFormData: (fd) => ({
 *       name: fd.get('name'),
 *       code: fd.get('code')?.toString().toUpperCase(),
 *       description: fd.get('description'),
 *       active: fd.get('active') === 'on'
 *     }),
 *     checkUnique: async (validated) => {
 *       const exists = await db.customers.findUnique({
 *         where: { code: validated.code }
 *       });
 *       return exists ? {
 *         exists: true,
 *         field: 'code',
 *         message: 'Customer code already exists'
 *       } : null;
 *     }
 *   })
 * };
 */
export function createCreateAction<TSchema extends z.ZodTypeAny>(
	options: CreateActionOptions<TSchema>
) {
	const {
		schema,
		model,
		entityType,
		redirectPath,
		extractFormData,
		checkUnique,
		transformData
	} = options;

	return async ({ request }: { request: Request }) => {
		const formData = await request.formData();
		const data = extractFormData(formData);

		try {
			// Validate the form data
			const validated = schema.parse(data);

			// Check for uniqueness violations
			if (checkUnique) {
				const uniqueCheck = await checkUnique(validated);
				if (uniqueCheck?.exists) {
					return fail(400, {
						errors: { [uniqueCheck.field]: [uniqueCheck.message] },
						message: uniqueCheck.message
					});
				}
			}

			// Transform data if needed
			const createData = transformData ? await transformData(validated) : validated;

			// Create entity in database
			const entity = await model.create({
				data: createData
			});

			// Create audit log
			await createAuditLog(entityType, entity.id, 'create', { [entityType]: entity });

			// Redirect with ID substitution if needed
			const path = redirectPath.replace('{id}', entity.id);
			throw redirect(303, path);
		} catch (err) {
			if (err instanceof Error && 'issues' in err) {
				// Zod validation error
				const zodError = err as z.ZodError;
				const errors = zodError.flatten().fieldErrors;
				return fail(400, {
					errors,
					message: 'Validation failed. Please check the form.'
				});
			}
			throw err;
		}
	};
}

export interface UpdateActionOptions<TSchema extends z.ZodTypeAny = any> {
	/** Zod validation schema */
	schema: TSchema;
	/** The Prisma model delegate */
	model: any;
	/** Entity type for audit log (e.g., 'customer', 'vendor') */
	entityType: string;
	/** Redirect path after successful update (can use {id} placeholder) */
	redirectPath: string;
	/** Function to extract data from FormData */
	extractFormData: (formData: FormData) => Record<string, any>;
	/** Check for uniqueness constraint violations before updating (excludes current entity) */
	checkUnique?: (validated: z.infer<TSchema>, id: string) => Promise<{
		exists: boolean;
		field: string;
		message: string;
	} | null>;
	/** Transform validated data before database update */
	transformData?: (validated: z.infer<TSchema>) => Record<string, any> | Promise<Record<string, any>>;
}

/**
 * Generic update action handler with validation, uniqueness checks, and audit logging
 *
 * @example
 * export const actions: Actions = {
 *   default: createUpdateAction({
 *     schema: customerUpdateSchema,
 *     model: db.customers,
 *     entityType: 'customer',
 *     redirectPath: '/customers/{id}',
 *     extractFormData: (fd) => ({
 *       name: fd.get('name'),
 *       code: fd.get('code')?.toString().toUpperCase(),
 *       description: fd.get('description'),
 *       active: fd.get('active') === 'on'
 *     }),
 *     checkUnique: async (validated, id) => {
 *       const exists = await db.customers.findFirst({
 *         where: { code: validated.code, id: { not: id } }
 *       });
 *       return exists ? {
 *         exists: true,
 *         field: 'code',
 *         message: 'Customer code already exists'
 *       } : null;
 *     }
 *   })
 * };
 */
export function createUpdateAction<TSchema extends z.ZodTypeAny>(
	options: UpdateActionOptions<TSchema>
) {
	const {
		schema,
		model,
		entityType,
		redirectPath,
		extractFormData,
		checkUnique,
		transformData
	} = options;

	return async ({ request, params }: { request: Request; params: Record<string, string> }) => {
		const formData = await request.formData();
		const data = extractFormData(formData);

		try {
			// Validate the form data
			const validated = schema.parse(data);

			// Check for uniqueness violations
			if (checkUnique) {
				const uniqueCheck = await checkUnique(validated, params.id);
				if (uniqueCheck?.exists) {
					return fail(400, {
						errors: { [uniqueCheck.field]: [uniqueCheck.message] },
						message: uniqueCheck.message
					});
				}
			}

			// Fetch old values for audit
			const oldEntity = await model.findUnique({
				where: { id: params.id }
			});

			// Transform data if needed
			const updateData = transformData ? await transformData(validated) : validated;

			// Update entity in database
			const entity = await model.update({
				where: { id: params.id },
				data: updateData
			});

			// Create audit log with changes
			await createAuditLog(entityType, entity.id, 'update', {
				old: oldEntity,
				new: entity
			});

			// Redirect with ID substitution if needed
			const path = redirectPath.replace('{id}', entity.id);
			throw redirect(303, path);
		} catch (err) {
			if (err instanceof Error && 'issues' in err) {
				// Zod validation error
				const zodError = err as z.ZodError;
				const errors = zodError.flatten().fieldErrors;
				return fail(400, {
					errors,
					message: 'Validation failed. Please check the form.'
				});
			}
			throw err;
		}
	};
}

export interface EditLoaderOptions<T = any> {
	/** The Prisma model delegate */
	model: any;
	/** Entity name for error messages and return key */
	entityName: string;
	/** Additional data to load (e.g., lookup lists for dropdowns) */
	additionalData?: () => Promise<Record<string, any>>;
}

/**
 * Generic edit page loader - fetches entity and optional lookup data
 *
 * @example
 * export const load: PageServerLoad = createEditLoader({
 *   model: db.software,
 *   entityName: 'Software',
 *   additionalData: async () => ({
 *     vendors: await db.vendors.findMany({
 *       where: { active: true },
 *       orderBy: { name: 'asc' }
 *     })
 *   })
 * });
 */
export function createEditLoader<T = any>(options: EditLoaderOptions<T>) {
	const { model, entityName, additionalData } = options;

	return async ({ params }: { params: Record<string, string> }) => {
		const entity = await model.findUnique({
			where: { id: params.id }
		});

		if (!entity) {
			throw error(404, `${entityName} not found`);
		}

		const additional = additionalData ? await additionalData() : {};

		return {
			[entityName.toLowerCase()]: entity,
			...additional
		};
	};
}
