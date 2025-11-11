import { db, getPaginated } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 50;

	// Filter parameters
	const entityType = url.searchParams.get('entity_type') || undefined;
	const action = url.searchParams.get('action') || undefined;
	const searchQuery = url.searchParams.get('q') || undefined;

	// Build where clause
	const where: any = {};

	if (entityType) {
		where.entity_type = entityType;
	}

	if (action) {
		where.action = action;
	}

	// Fetch audit log entries using pagination helper
	const paginatedData = await getPaginated(
		db.audit_log,
		page,
		limit,
		where,
		{ timestamp: 'desc' }
	);

	// Get unique entity types and actions for filters
	const [entityTypes, actions] = await Promise.all([
		db.$queryRaw<Array<{ entity_type: string }>>`
			SELECT DISTINCT entity_type
			FROM audit_log
			ORDER BY entity_type
		`,
		db.$queryRaw<Array<{ action: string }>>`
			SELECT DISTINCT action
			FROM audit_log
			ORDER BY action
		`
	]);

	return {
		logs: paginatedData.items,
		pagination: {
			total: paginatedData.total,
			page: paginatedData.page,
			limit: paginatedData.pageSize,
			totalPages: paginatedData.totalPages
		},
		filters: {
			entityTypes: entityTypes.map(e => e.entity_type),
			actions: actions.map(a => a.action),
			currentEntityType: entityType,
			currentAction: action,
			currentSearch: searchQuery
		}
	};
};
