/**
 * Type utilities for Superforms + Zod integration
 *
 * These types provide proper TypeScript inference for Superforms validation
 * and help eliminate @ts_ignore and @ts-nocheck suppressions.
 *
 * Developer note:
 * - Server-side: cast the result of `superValidate(...)` to `SuperForm<typeof schema>`
 *   to preserve strong typing. Example:
 *     const form = await superValidate(event, zod(mySchema)) as SuperForm<typeof mySchema>;
 *
 * - Client-side: the server returns a Superforms payload in `data.form`. Cast it to
 *   `SuperFormClient<typeof schema>` and pass that into `superForm(...)` to avoid
 *   `@ts-nocheck` and `@ts-expect-error` usage. Example:
 *     export let data: PageData;
 *     const typedForm = data.form as unknown as SuperFormClient<typeof mySchema>;
 *     const { form, errors, enhance } = superForm(typedForm, { validators: zod(mySchema) });
 */

import type { SuperValidated, Infer } from 'sveltekit-superforms';
import type { AnyZodObject } from 'zod';
import type {
	vendorSchema,
	vendorUpdateSchema,
	customerSchema,
	customerUpdateSchema,
	lparSchema,
	softwareSchema,
	packageSchema
} from '$schemas';
import type {
	softwareWithVersionsSchema,
	packageWithItemsSchema
} from '$lib/schemas';

/**
 * Properly typed SuperValidated form data
 * Usage: SuperForm<typeof vendorSchema>
 */
export type SuperForm<T extends AnyZodObject> = SuperValidated<Infer<T>>;

/**
 * Validated form data type from a Zod schema
 * Usage: ValidatedFormData<typeof vendorSchema>
 */
export type ValidatedFormData<T extends AnyZodObject> = Infer<T>;

/**
 * Type-safe form data accessor
 * Usage: const data = formData(form, vendorSchema);
 */
export function formData<T extends AnyZodObject>(
	form: SuperValidated<Infer<T>>,
	_schema: T
): Infer<T> {
	return form.data;
}

// Specific form data types for convenience
export type VendorFormData = Infer<typeof vendorSchema>;
export type VendorUpdateFormData = Infer<typeof vendorUpdateSchema>;
export type CustomerFormData = Infer<typeof customerSchema>;
export type CustomerUpdateFormData = Infer<typeof customerUpdateSchema>;
export type LparFormData = Infer<typeof lparSchema>;
export type SoftwareFormData = Infer<typeof softwareSchema>;
export type PackageFormData = Infer<typeof packageSchema>;
export type SoftwareWithVersionsFormData = Infer<typeof softwareWithVersionsSchema>;
export type PackageWithItemsFormData = Infer<typeof packageWithItemsSchema>;

/**
 * Client-side Superforms instance type
 * Usage: SuperFormClient<typeof vendorSchema>
 */
export type SuperFormClient<T extends AnyZodObject> = {
	form: {
		subscribe: (fn: (value: Infer<T>) => void) => void;
	};
	errors: {
		subscribe: (fn: (value: Record<string, any>) => void) => void;
	};
	constraints: {
		subscribe: (fn: (value: Record<string, any>) => void) => void;
	};
	message: {
		subscribe: (fn: (value: string | undefined) => void) => void;
	};
	submitting: {
		subscribe: (fn: (value: boolean) => void) => void;
	};
	delayed: {
		subscribe: (fn: (value: boolean) => void) => void;
	};
	submitted: {
		subscribe: (fn: (value: boolean) => void) => void;
	};
	enhance: (form: HTMLFormElement) => { destroy(): void };
	validateField?: (field: string) => Promise<void>;
};
