import type { RequestHandler } from './$types';
import { cloneSoftware, clonePackage, cloneLpar, cloneCustomer, cloneVendor, getClonePreview } from '#lib/server/clone-utils.ts';
import { z } from 'zod';
import { isHttpError } from '@sveltejs/kit';
import { can } from '#lib/utils/permissions.ts';
import { requirePermission } from '#lib/server/permissions.ts';
import { lparTarget, softwareTarget } from '#lib/server/scopes.ts';
import { addEditor } from '#lib/server/editors.ts';
import { db } from '#lib/server/db.ts';

// Clone request schema
const cloneRequestSchema = z.object({
	entityType: z.enum(['software', 'package', 'lpar', 'customer', 'vendor']),
	sourceId: z.string().uuid(),
	data: z.record(z.string(), z.string())
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { entityType, sourceId, data } = cloneRequestSchema.parse(body);

		let result;

		switch (entityType) {
			case 'software':
				requirePermission(locals, 'edit_software', await softwareTarget(sourceId));
				if (!data.name) {
					return Response.json({ error: 'Name is required' }, { status: 400 });
				}
				result = await cloneSoftware(sourceId, data.name, data.description);
				break;

			case 'package':
				if (!can(locals.user, 'create_package')) {
					return Response.json({ error: 'You are not allowed to create packages' }, { status: 403 });
				}
				if (!data.name || !data.code || !data.version) {
					return Response.json({ error: 'Name, code, and version are required' }, { status: 400 });
				}
				result = await clonePackage(sourceId, data.name, data.code, data.version);
				// The creator is the new package's editor and contact
				await addEditor(db, 'package', result.id, locals.user!.id, true);
				break;

			case 'lpar':
				requirePermission(locals, 'edit_lpar', data.customer_id ? { customer: data.customer_id } : await lparTarget(sourceId));
				if (!data.name || !data.code) {
					return Response.json({ error: 'Name and code are required' }, { status: 400 });
				}
				result = await cloneLpar(sourceId, data.name, data.code, data.customer_id);
				break;

			case 'customer':
				requirePermission(locals, 'manage_customers');
				if (!data.name || !data.code) {
					return Response.json({ error: 'Name and code are required' }, { status: 400 });
				}
				result = await cloneCustomer(sourceId, data.name, data.code);
				break;

			case 'vendor':
				requirePermission(locals, 'manage_vendors');
				if (!data.name || !data.code) {
					return Response.json({ error: 'Name and code are required' }, { status: 400 });
				}
				result = await cloneVendor(sourceId, data.name, data.code);
				break;

			default:
				return Response.json({ error: 'Invalid entity type' }, { status: 400 });
		}

		return Response.json({ success: true, data: result });
	} catch (error) {
		if (isHttpError(error)) throw error;
		console.error('Clone error:', error);
		return Response.json(
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
			return Response.json({ error: 'Entity type and source ID are required' }, { status: 400 });
		}

		const preview = await getClonePreview(entityType, sourceId);

		return Response.json({ success: true, preview });
	} catch (error) {
		console.error('Preview error:', error);
		return Response.json(
			{
				error: error instanceof Error ? error.message : 'Failed to get preview'
			},
			{ status: 500 }
		);
	}
};
