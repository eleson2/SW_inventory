/** Report period from ?from=&to= (YYYY-MM-DD, both inclusive); default the last 12 months. */
export function readPeriod(url: URL) {
	const read = (key: string) => {
		const raw = url.searchParams.get(key);
		const d = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : null;
		return d && !Number.isNaN(d.getTime()) ? d : null;
	};
	const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
	const to = read('to') ?? today;
	const from = read('from') ?? new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), to.getUTCDate() + 1));
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	return {
		from: iso(from),
		to: iso(to),
		/** Query bounds: from <= t < day after `to` */
		start: from,
		end: new Date(to.getTime() + 86_400_000)
	};
}
