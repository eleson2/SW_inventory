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
	log: ['error']
});

if (dev) globalForPrisma.prisma = db;

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
 */
export async function softDelete(model: any, id: string) {
	return model.update({
		where: { id },
		data: { active: false, updatedAt: new Date() }
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
