import { superValidate, superForm } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { ZodTypeAny } from 'zod';
import type { SuperFormClient } from '$lib/types/superforms';

/**
 * Server-side helper to run superValidate
 * Accepts either an initial value (object) or the SvelteKit event/request.
 * Returns the result directly - TypeScript will infer the correct type from the schema.
 */
export async function serverValidate<T extends ZodTypeAny>(
    input: unknown,
    schema: T
) {
    return await superValidate(input, zod(schema));
}

/**
 * Client-side helper to create a typed superForm instance from the server-provided
 * payload. This centralizes the typing and ensures the Zod validators are wired consistently.
 */
export function typedSuperForm<T extends ZodTypeAny>(
    dataForm: unknown,
    schema: T,
    options: Record<string, any> = {}
) {
    const typed = dataForm as SuperFormClient<T>;
    // Ensure validators provided are the Zod adapter for this schema unless caller overrides
    const merged = { validators: zod(schema), ...options };
    return superForm(typed, merged);
}

export default {
    serverValidate,
    typedSuperForm
};
