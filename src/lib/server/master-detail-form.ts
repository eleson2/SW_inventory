/**
 * Server-side counterpart of `useMasterDetailForm` (src/lib/utils/useMasterDetailForm.svelte.ts).
 *
 * Master-detail edit pages post plain FormData: the master fields as regular inputs and
 * every array field (installations, items, versions) as a JSON string. Superforms cannot
 * parse that directly ("Object type found. Set the dataType option to json"), so this
 * builds a plain object from the FormData first and validates it with the schema.
 */
import type { ZodObject, ZodType } from 'zod';
import { serverValidate } from '#lib/utils/superforms.ts';
import type { SuperForm } from '#lib/types/superforms.ts';

/** Underlying Zod type name, looking through optional/default/nullable/nonoptional wrappers */
function baseTypeName(field: ZodType): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let def = (field as any)._zod.def;
	while (def.innerType) def = def.innerType._zod.def;
	return def.type;
}

export async function validateMasterDetailForm<T extends ZodObject>(
	request: Request,
	schema: T
): Promise<SuperForm<T>> {
	const formData = await request.formData();
	const data: Record<string, unknown> = {};

	for (const [key, field] of Object.entries(schema.shape)) {
		const raw = formData.get(key);
		const type = baseTypeName(field as ZodType);

		if (type === 'array') {
			if (typeof raw !== 'string' || raw === '') continue; // let the schema default apply
			try {
				data[key] = JSON.parse(raw);
			} catch {
				data[key] = null; // invalid JSON fails validation instead of throwing
			}
		} else if (type === 'boolean') {
			// Checkboxes: present ("on") when checked, absent when unchecked
			data[key] = raw === 'on' || raw === 'true';
		} else if (typeof raw === 'string' && raw.trim() !== '') {
			data[key] = raw;
		}
		// Empty strings are left out so optional fields (e.g. UUID selects) stay undefined
	}

	return serverValidate(data, schema);
}
