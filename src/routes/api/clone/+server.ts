import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cloneSoftware, clonePackage, cloneLpar, cloneCustomer, cloneVendor, getClonePreview } from '$lib/server/clone-utils';
import { z } from 'zod';

// Clone request schema
const cloneRequestSchema = z.object({
	entityType: z.enum(['software', 'package', 'lpar', 'customer', 'vendor']),
	sourceId: z.string().uuid(),
	data: z.record(z.string())
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { entityType, sourceId, data } = cloneRequestSchema.parse(body);

		let result;

		switch (entityType) {
			case 'software':
				if (!data.name) {
					return json({ error: 'Name is required' }, { status: 400 });
				}
				result = await cloneSoftware(sourceId, data.name);
				break;

			case 'package':
				if (!data.name || !data.code || !data.version) {
					return json({ error: 'Name, code, and version are required' }, { status: 400 });
				}
				result = await clonePackage(sourceId, data.name, data.code, data.version);
				break;

			case 'lpar':
				if (!data.name || !data.code) {
					return json({ error: 'Name and code are required' }, { status: 400 });
				}
				result = await cloneLpar(sourceId, data.name, data.code, data.customerId);
				break;

			case 'customer':
				if (!data.name || !data.code) {
					return json({ error: 'Name and code are required' }, { status: 400 });
				}
				result = await cloneCustomer(sourceId, data.name, data.code);
				break;

			case 'vendor':
				if (!data.name || !data.code) {
					return json({ error: 'Name and code are required' }, { status: 400 });
				}
				result = await cloneVendor(sourceId, data.name, data.code);
				break;

			default:
				return json({ error: 'Invalid entity type' }, { status: 400 });
		}

		return json({ success: true, data: result });
	} catch (error) {
		console.error('Clone error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to clone entity'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const entityType = url.searchParams.get('entityType') as 'software' | 'package' | 'lpar' | 'customer' | 'vendor';
		const sourceId = url.searchParams.get('sourceId');

		if (!entityType || !sourceId) {
			return json({ error: 'Entity type and source ID are required' }, { status: 400 });
		}

		const preview = await getClonePreview(entityType, sourceId);

		return json({ success: true, preview });
	} catch (error) {
		console.error('Preview error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to get preview'
			},
			{ status: 500 }
		);
	}
};
