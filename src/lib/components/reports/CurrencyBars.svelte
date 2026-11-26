<script lang="ts">
	/** Stacked 100% bars per month: current, behind, outside package, out of support (C5 colours). */
	import { CURRENCIES, type Currency } from '#lib/utils/inventory-reports.ts';

	let {
		months,
		labels,
		rebuilt = []
	}: {
		months: { currency: Record<Currency, number>; installs: number; currentShare: number | null }[];
		labels: string[];
		rebuilt?: boolean[];
	} = $props();

	const CURRENCY_STYLE: Record<Currency, { label: string; fill: string }> = {
		current: { label: 'Current with package', fill: 'fill-green-600' },
		behind: { label: 'Behind package', fill: 'fill-amber-500' },
		outside: { label: 'Outside package', fill: 'fill-gray-400' },
		out_of_support: { label: 'Out of support', fill: 'fill-red-600' }
	};

	const W = 640;
	const H = 170;
	const L = 30;
	const T = 16;
	const B = 18;
	const slot = $derived((W - L) / Math.max(1, months.length));
	const bar = $derived(Math.min(36, slot - 4));
	const h = H - T - B;
	const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
	function segments(m: (typeof months)[number]) {
		let top = T + h;
		return CURRENCIES.filter((c) => m.currency[c] > 0).map((c) => {
			const height = (m.currency[c] / m.installs) * h;
			top -= height;
			return { c, y: top, height: Math.max(0, height - 2) };
		});
	}
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Currency per month">
	{#each [0, 0.5, 1] as g (g)}
		<line x1={L} x2={W} y1={T + h * (1 - g)} y2={T + h * (1 - g)} class="stroke-gray-200" />
		<text x={L - 4} y={T + h * (1 - g) + 3} text-anchor="end" class="fill-gray-500 text-[9px]">{g * 100}%</text>
	{/each}
	{#each months as m, i (i)}
		{@const cx = L + slot * i + slot / 2}
		<g>
			<title
				>{labels[i]}{rebuilt[i] ? ' (rebuilt history)' : ''}: {m.installs} installs, {pct(m.currentShare)} current{CURRENCIES.filter(
					(c) => m.currency[c]
				)
					.map((c) => `\n${CURRENCY_STYLE[c].label}: ${m.currency[c]}`)
					.join('')}</title
			>
			{#if rebuilt[i]}<rect x={L + slot * i} y={T} width={slot} height={h} class="fill-gray-50" />{/if}
			{#if m.installs}
				{#each segments(m) as s (s.c)}
					<rect x={cx - bar / 2} y={s.y} width={bar} height={s.height} rx="2" class={CURRENCY_STYLE[s.c].fill} />
				{/each}
				<text x={cx} y={T - 4} text-anchor="middle" class="fill-gray-700 text-[9px]">{pct(m.currentShare)}</text>
			{/if}
			{#if months.length <= 12 || (months.length - 1 - i) % 2 === 0}
				<text x={cx} y={H - 4} text-anchor="middle" class="fill-gray-500 text-[9px]">{labels[i].slice(2)}</text>
			{/if}
		</g>
	{/each}
</svg>
<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
	{#each CURRENCIES as c (c)}
		<span class="flex items-center gap-1.5">
			<svg width="10" height="10"><rect width="10" height="10" rx="2" class={CURRENCY_STYLE[c].fill} /></svg>
			{CURRENCY_STYLE[c].label}
		</span>
	{/each}
</div>
