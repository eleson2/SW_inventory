import { superForm, superValidate } from 'sveltekit-superforms';
import { zod as zod4 } from 'sveltekit-superforms/adapters/zod4';
import type { ZodObject } from 'zod';
import type { SuperForm } from '#lib/types/superforms.ts';

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
export async function serverValidate<T extends ZodObject>(
    input: unknown,
    schema: T
): Promise<SuperForm<T>> {
    const form = await superValidate(nullsToUndefined(input) as any, zod4(schema));
    return form as SuperForm<T>;
}

/**
 * Database rows use null for empty optional columns, while the Zod schemas use
 * .optional() (undefined). Without this, every empty optional field fails
 * validation ("Invalid input") as soon as an edit form loads, and arrives on the
 * client as undefined. Only plain data objects are converted; request events,
 * Requests and FormData are passed through untouched.
 */
function nullsToUndefined(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(nullsToUndefined);
    if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
        return value;
    }
    if ('request' in value && (value as { request: unknown }).request instanceof Request) {
        return value; // SvelteKit RequestEvent
    }
    return Object.fromEntries(
        Object.entries(value).map(([key, v]) => [key, v === null ? undefined : nullsToUndefined(v)])
    );
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
export function typedSuperForm<T extends ZodObject>(
    dataForm: unknown,
    schema: T,
    options: Record<string, any> = {}
) {
    const typed = dataForm as SuperForm<T>;
    // Ensure validators provided are the Zod adapter for this schema unless caller overrides
    const merged = { validators: zod4(schema), ...options };
    return superForm(typed, merged);
}
