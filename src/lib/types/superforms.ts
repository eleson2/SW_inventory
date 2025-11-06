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
 *   `SuperForm<typeof schema>` (NOT SuperFormClient) and pass that into `superForm(...)`. Example:
 *     let { data }: { data: PageData } = $props();
 *     const typedForm = data.form as SuperForm<typeof mySchema>;
 *     const { form, errors, enhance } = superForm(typedForm, { validators: zod(mySchema) });
 *
 * Note: SuperForm<T> is the INPUT type (SuperValidated), while the library's superForm()
 * returns an object with form, errors, enhance, etc. as properties (not a type we export).
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
 * @deprecated DO NOT USE - This type is incorrect and misleading.
 *
 * Use `SuperForm<typeof schema>` for the INPUT to superForm(), not this type.
 * This type was an attempt to type the OUTPUT (return value) of superForm(),
 * but it's incomplete and should not be used. TypeScript will infer the correct
 * return type automatically when you destructure the result.
 *
 * Correct usage:
 *   const typedForm = data.form as SuperForm<typeof schema>;
 *   const { form, errors, enhance } = superForm(typedForm, { ... });
 */
export type SuperFormClient<T extends ZodSchema> = {
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
	posted: {
		subscribe: (fn: (value: boolean) => void) => void;
	};
	enhance: (form: HTMLFormElement) => { destroy(): void };
	validate?: (field: string) => Promise<string[] | undefined>;
};
