import { superForm, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { AnyZodObject } from 'zod';
import type { SuperForm } from '$lib/types/superforms';

/**
 * Server-side helper to validate form data with proper typing.
 * Centralizes the type casting logic needed due to Superforms/SvelteKit type incompatibilities.
 *
 * Usage in +page.server.ts load functions:
 * ```typescript
 * export const load: PageServerLoad = async () => {
 *   const form = await serverValidate({ active: true }, vendorSchema);
 *   return { form };
 * };
 * ```
 *
 * Usage in form actions:
 * ```typescript
 * export const actions: Actions = {
 *   default: async (event) => {
 *     const form = await serverValidate(event, vendorSchema);
 *     if (!form.valid) return fail(400, { form });
 *     // Use form.data safely...
 *   }
 * };
 * ```
 */
export async function serverValidate<T extends AnyZodObject>(
    input: unknown,
    schema: T
): Promise<SuperForm<T>> {
    const form = await superValidate(input as any, zod(schema));
    return form as SuperForm<T>;
}

/**
 * Client-side helper to create a typed superForm instance from the server-provided
 * payload. This centralizes the typing and ensures the Zod validators are wired consistently.
 *
 * Usage in Svelte components:
 * ```typescript
 * const { form, errors, enhance } = typedSuperForm(data.form, mySchema, {
 *   dataType: 'json',
 *   resetForm: false
 * });
 * ```
 */
export function typedSuperForm<T extends AnyZodObject>(
    dataForm: unknown,
    schema: T,
    options: Record<string, any> = {}
) {
    const typed = dataForm as SuperForm<T>;
    // Ensure validators provided are the Zod adapter for this schema unless caller overrides
    const merged = { validators: zod(schema), ...options };
    return superForm(typed, merged);
}
