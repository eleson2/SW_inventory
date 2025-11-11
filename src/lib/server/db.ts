/**
 * Database connection utility using Prisma Client
 * Implements singleton pattern for development to prevent too many connections
 */
import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';

// PrismaClient is attached to the `globalThis` object in development to prevent
// exhausting your database connection limit during hot reload in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({
	log: dev ? ['query', 'warn', 'error'] : ['error']
});

if (dev) globalForPrisma.prisma = db;

// Slow query detection middleware
if (dev) {
	db.$use(async (params, next) => {
		const before = Date.now();
		const result = await next(params);
		const after = Date.now();

		const duration = after - before;
		if (duration > 1000) {
			console.warn(`⚠️  Slow query (${duration}ms): ${params.model}.${params.action}`);
		}

		return result;
	});
}

// Helper functions for common queries

/**
 * Get paginated results for any model
 */
export async function getPaginated<T>(
	model: any,
	page: number = 1,
	pageSize: number = 20,
	where: any = {},
	orderBy: any = {},
	include: any = {}
) {
	const skip = (page - 1) * pageSize;

	const [items, total] = await Promise.all([
		model.findMany({
			where,
			skip,
			take: pageSize,
			orderBy,
			include
		}),
		model.count({ where })
	]);

	return {
		items,
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize)
	};
}

/**
 * Soft delete - set active to false instead of deleting
 *
 * NOTE: Currently unused in the codebase. The application uses a different pattern:
 * - Vendors/Customers: Deactivation via edit forms (sets active: false)
 * - Cascade deactivation: When parent is deactivated, children are also deactivated via updateMany
 *
 * This helper is kept for potential future use or for explicit soft-delete operations
 * where we need to track deletion metadata (deleted_at, deleted_by).
 *
 * Usage example:
 * ```typescript
 * await softDelete(db.vendors, vendorId, currentUserId);
 * ```
 */
export async function softDelete(model: any, id: string, userId?: string) {
	return model.update({
		where: { id },
		data: {
			active: false,
			deleted_at: new Date(),
			deleted_by: userId,
			updated_at: new Date()
		}
	});
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
	entityType: string,
	entityId: string,
	action: 'create' | 'update' | 'delete' | 'rollback' | 'version_update',
	changes: Record<string, any>,
	userId?: string
) {
	return db.audit_log.create({
		data: {
			entity_type: entityType,
			entity_id: entityId,
			action,
			changes,
			user_id: userId,
			timestamp: new Date()
		}
	});
}

/**
 * Check if a unique constraint would be violated
 * Returns validation result with error message if constraint exists
 */
export async function checkUniqueConstraint(
	model: any,
	field: string,
	value: string,
	excludeId?: string
): Promise<{ exists: boolean; error: string | null }> {
	const where = excludeId
		? { [field]: value, id: { not: excludeId } }
		: { [field]: value };

	const existing = await model.findFirst({ where });

	return {
		exists: !!existing,
		error: existing ? `A record with this ${field} already exists.` : null
	};
}

/**
 * Master-detail update pattern
 * Handles updating a master record and its related detail records in a transaction
 * Automatically manages creates, updates, and deletes of detail records
 */
export async function masterDetailUpdate<TMaster = any, TDetail = any>({
	masterModel,
	detailModel,
	masterId,
	masterData,
	detailRecords,
	detailForeignKey,
	existingDetailIds = [],
	entityType,
	userId,
	transformDetail
}: {
	masterModel: any; // Prisma model for master entity
	detailModel: any; // Prisma model for detail entity
	masterId: string; // ID of master record to update
	masterData: any; // Data to update on master record
	detailRecords: TDetail[]; // Array of detail records (with id, _action, and data fields)
	detailForeignKey: string; // Foreign key field name on detail table
	existingDetailIds?: string[]; // IDs of existing detail records
	entityType: string; // Entity type for audit log
	userId?: string; // User performing the update
	transformDetail?: (detail: TDetail, masterId: string) => any; // Optional transform function
}): Promise<TMaster> {
	return db.$transaction(async (tx) => {
		// 1. Update master record
		const updated = await tx[masterModel].update({
			where: { id: masterId },
			data: masterData
		});

		// 2. Identify detail records to delete
		const incomingIds = (detailRecords as any[])
			.filter((d) => d.id && d._action !== 'delete')
			.map((d) => d.id);

		const toDelete = existingDetailIds.filter((id) => !incomingIds.includes(id));

		// Also include any records explicitly marked for deletion
		const explicitDeletes = (detailRecords as any[])
			.filter((d) => d.id && d._action === 'delete')
			.map((d) => d.id);

		const allDeletes = [...toDelete, ...explicitDeletes];

		// 3. Delete removed detail records
		if (allDeletes.length > 0) {
			await tx[detailModel].deleteMany({
				where: { id: { in: allDeletes } }
			});
		}

		// 4. Process remaining detail records
		for (const detail of detailRecords as any[]) {
			// Skip records marked for deletion
			if (detail._action === 'delete') continue;

			// Transform detail data if transform function provided
			const detailData = transformDetail
				? transformDetail(detail, masterId)
				: {
						...detail,
						[detailForeignKey]: masterId
				  };

			// Remove internal fields
			delete detailData.id;
			delete detailData._action;

			if (detail.id) {
				// Update existing record
				await tx[detailModel].update({
					where: { id: detail.id },
					data: detailData
				});
			} else {
				// Create new record
				await tx[detailModel].create({
					data: {
						...detailData,
						[detailForeignKey]: masterId
					}
				});
			}
		}

		// 5. Create audit log
		await createAuditLog(entityType, masterId, 'update', updated, userId);

		return updated as TMaster;
	});
}
