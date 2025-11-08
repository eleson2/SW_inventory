import { superForm } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { ZodTypeAny } from 'zod';
import type { SuperForm } from '$lib/types/superforms';

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
export function typedSuperForm<T extends ZodTypeAny>(
    dataForm: unknown,
    schema: T,
    options: Record<string, any> = {}
) {
    const typed = dataForm as SuperForm<T>;
    // Ensure validators provided are the Zod adapter for this schema unless caller overrides
    const merged = { validators: zod(schema), ...options };
    return superForm(typed, merged);
}
