/**
 * Database connection utility using Prisma Client
 * Implements singleton pattern for development to prevent too many connections
 */
import { PrismaClient } from '@prisma/client';
import { configureDatabase } from './db-dialect.ts';
import { currentUserId } from './request-context.ts';

// PrismaClient is attached to the `globalThis` object in development to prevent
// exhausting your database connection limit during hot reload in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const isNewClient = !globalForPrisma.prisma;
export const db = globalForPrisma.prisma || new PrismaClient({
	log: ['error']
});

// Cache across hot reloads in development. process.env instead of $app/env keeps this
// module usable from CLI scripts (scripts/bundle-import.ts).
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
if (isNewClient) {
	configureDatabase(db).catch((error) => console.error('Database setup failed:', error));
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
	/** Defaults to the logged-in user of the current request */
	userId?: string,
	/** Pass the transaction client when called inside db.$transaction: SQLite has one writer,
	 * so a write on the main connection would wait for the transaction until it times out. */
	client: Pick<typeof db, 'audit_log'> = db
) {
	return client.audit_log.create({
		data: {
			entity_type: entityType,
			entity_id: entityId,
			action,
			changes,
			user_id: userId ?? currentUserId(),
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

