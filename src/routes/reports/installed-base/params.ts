import { COMPARE_CHOICES, MONTH_CHOICES } from '#lib/utils/installed-base.ts';

/** ?months= (6, 12, 24; default 12) and ?compare= (1, 3, 12 months back; default 12, at most months - 1) */
export function readBaseParams(url: URL): { months: number; compare: number } {
	const pick = <T extends number>(key: string, choices: readonly T[], fallback: T): T => {
		const n = Number(url.searchParams.get(key));
		return (choices as readonly number[]).includes(n) ? (n as T) : fallback;
	};
	const months = pick('months', MONTH_CHOICES, 12);
	return { months, compare: Math.min(pick('compare', COMPARE_CHOICES, 12), months - 1) };
}
