<script lang="ts">
	/**
	 * Small single-series line chart for month-end values: zero-based y axis, first/last month on
	 * the x axis, months on rebuilt history shaded, native tooltip per point.
	 */
	let {
		values,
		labels,
		rebuilt = [],
		format = (v: number) => String(v),
		title
	}: {
		values: (number | null)[];
		labels: string[];
		rebuilt?: boolean[];
		format?: (v: number) => string;
		title: string;
	} = $props();

	const W = 260;
	const H = 90;
	const L = 34;
	const R = 6;
	const T = 8;
	const B = 18;
	const max = $derived(Math.max(1, ...values.map((v) => v ?? 0)));
	const step = $derived(values.length > 1 ? (W - L - R) / (values.length - 1) : 0);
	const x = (i: number) => L + i * step;
	const y = (v: number) => T + (H - T - B) * (1 - v / max);
	const path = $derived(
		values
			.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
			.filter(Boolean)
			.join(' ')
	);
	const shadeEnd = $derived(rebuilt.lastIndexOf(true));
</script>

<svg viewBox="0 0 {W} {H}" class="w-full max-w-[320px]" role="img" aria-label={title}>
	{#if shadeEnd >= 0}
		<rect
			x={L}
			y={T}
			width={Math.min(x(shadeEnd) + step / 2, W - R) - L}
			height={H - T - B}
			class="fill-gray-100"
		><title>Rebuilt history: approximate</title></rect>
	{/if}
	<line x1={L} x2={W - R} y1={y(0)} y2={y(0)} class="stroke-gray-300" />
	<line x1={L} x2={W - R} y1={y(max)} y2={y(max)} class="stroke-gray-200" stroke-dasharray="2 3" />
	<text x={L - 4} y={y(max) + 3} text-anchor="end" class="fill-gray-500 text-[9px]">{format(max)}</text>
	<text x={L - 4} y={y(0) + 3} text-anchor="end" class="fill-gray-500 text-[9px]">0</text>
	<text x={L} y={H - 4} class="fill-gray-500 text-[9px]">{labels[0]}</text>
	<text x={W - R} y={H - 4} text-anchor="end" class="fill-gray-500 text-[9px]">{labels.at(-1)}</text>
	<polyline points={path} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" class="text-primary" />
	{#each values as v, i (i)}
		{#if v !== null}
			<circle cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 3 : 2} class="fill-primary" />
			<rect x={x(i) - step / 2} y={T} width={Math.max(step, 8)} height={H - T - B} fill="transparent">
				<title>{labels[i]}: {format(v)}{rebuilt[i] ? ' (rebuilt history)' : ''}</title>
			</rect>
		{/if}
	{/each}
</svg>
