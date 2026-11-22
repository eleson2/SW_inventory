import type { PageServerLoad } from './$types';
import type { Prisma } from '@prisma/client';
import type { PaginatedResult, SortOptions } from '#lib/types/index.ts';
import { db } from '#lib/server/db.ts';
import { createPageLoader } from '#lib/server/page-loader.ts';
import { textContains } from '#lib/server/db-dialect.ts';
import { createStatusFilter, combineFilters } from '#lib/server/filter-builders.ts';

const bundleInclude = {
	vendors: { select: { id: true, name: true, code: true } },
	_count: { select: { items: true, package_items: true } }
} satisfies Prisma.vendor_bundlesInclude;

export type BundleListRow = Prisma.vendor_bundlesGetPayload<{ include: typeof bundleInclude }>;

export const load: PageServerLoad = async ({ url }) => {
	const vendors = await db.vendors.findMany({
		where: { active: true },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	const pageData = await createPageLoader({
		model: db.vendor_bundles,
		dataKey: 'bundles',
		defaultSortField: 'release_date',
		defaultSortDirection: 'desc',
		include: bundleInclude,
		searchBuilder: (searchTerm) => ({
			OR: [
				{ code: textContains(searchTerm) },
				{ name: textContains(searchTerm) },
				{ vendors: { name: textContains(searchTerm) } }
			]
		}),
		filterBuilder: combineFilters(createStatusFilter, (url) => {
			const filters: Record<string, unknown> = {};
			const vendorId = url.searchParams.get('vendor');
			if (vendorId) filters.vendor_id = vendorId;
			const type = url.searchParams.get('type');
			if (type) filters.bundle_type = type;
			return filters;
		})
	})(url);

	// createPageLoader is untyped (dynamic data key); state the shape here
	const { bundles, sort } = pageData as { bundles: PaginatedResult<BundleListRow>; sort: SortOptions };
	return { bundles, sort, vendors };
};
