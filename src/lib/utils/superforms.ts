import { superValidate, superForm } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { AnyZodObject } from 'zod';
import type { SuperForm, SuperFormClient } from '$lib/types/superforms';

/**
 * Server-side helper to run superValidate and return a properly typed SuperForm<T>
 * Accepts either an initial value (object) or the SvelteKit event/request.
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
 * payload. This centralizes the `as unknown as SuperFormClient` cast and ensures
 * the Zod validators are wired consistently.
 */
export function typedSuperForm<T extends AnyZodObject>(
    dataForm: unknown,
    schema: T,
    options: Record<string, any> = {}
) {
    const typed = dataForm as unknown as SuperFormClient<T>;
    // Ensure validators provided are the Zod adapter for this schema unless caller overrides
    const merged = { validators: zod(schema), ...options };
    return superForm(typed as any, merged);
}

export default {
    serverValidate,
    typedSuperForm
};
