/**
 * CSV for report exports: RFC 4180 quoting, CRLF line ends, and cells that a spreadsheet
 * would run as a formula (=, +, -, @) prefixed with ' so they stay text; plain numbers (-4) stay numbers.
 */
export function toCsv<K extends string>(columns: readonly K[], records: Record<K, string>[]): string {
	const cell = (value: string) => {
		const v = /^[=+\-@]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
		return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
	};
	return [columns.join(','), ...records.map((r) => columns.map((c) => cell(r[c] ?? '')).join(','))].join('\r\n') + '\r\n';
}

/** A CSV download named `<name>-<YYYY-MM-DD>.csv`, with a BOM so Excel reads it as UTF-8. */
export function csvDownload(name: string, csv: string): Response {
	const date = new Date().toISOString().slice(0, 10);
	return new Response('﻿' + csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${name}-${date}.csv"`
		}
	});
}
