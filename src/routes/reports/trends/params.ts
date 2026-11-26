import { MONTH_CHOICES } from '#lib/utils/installed-base.ts';
import { TREND_GROUPS, type TrendGroupBy } from '#lib/utils/trends.ts';

/** ?months=6|12|24 (default 12), ?group=total|vendor|customer (default total) */
export function readTrendParams(url: URL) {
	const m = Number(url.searchParams.get('months'));
	const g = url.searchParams.get('group') as TrendGroupBy;
	return {
		months: (MONTH_CHOICES as readonly number[]).includes(m) ? m : 12,
		groupBy: TREND_GROUPS.includes(g) ? g : ('total' as TrendGroupBy)
	};
}
