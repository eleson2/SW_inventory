/**
 * Shared helpers for the vendor bundle fetchers: HTTP, PDF text extraction, CSV output.
 */
import { BUNDLE_CSV_COLUMNS, type BundleCsvRow } from '#lib/schemas/bundle.ts';

export type { BundleCsvRow };

/** Generic client name; no personal or project details are sent to vendor sites. */
const USER_AGENT = 'sw-inventory-bundle-fetcher';

export class NotFoundError extends Error {}

/** GET a URL; 404/403 become NotFoundError so callers can skip unpublished documents. */
export async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (response.status === 404 || response.status === 403) {
		throw new NotFoundError(`${response.status} ${url}`);
	}
	if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
	return new Uint8Array(await response.arrayBuffer());
}

export async function fetchText(url: string): Promise<string> {
	return new TextDecoder().decode(await fetchBytes(url));
}

/** Text of each PDF page, lines separated by \n. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
	const { extractText, getDocumentProxy } = await import('unpdf');
	const pdf = await getDocumentProxy(bytes, { verbosity: 0 }); // silence font warnings
	const { text } = await extractText(pdf, { mergePages: false });
	return text;
}

function csvField(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: BundleCsvRow[]): string {
	const lines = [BUNDLE_CSV_COLUMNS.join(',')];
	for (const row of rows) {
		lines.push(BUNDLE_CSV_COLUMNS.map((column) => csvField(row[column] ?? '')).join(','));
	}
	return lines.join('\r\n') + '\r\n';
}

/** Accept "2511", "CARS2511" or "RSU2511"; returns yymm. */
export function levelYymm(level: string): string {
	const match = /(\d{4})$/.exec(level.trim());
	if (!match) throw new Error(`Level must end in yymm, e.g. CARS2511 or RSU2511 (got "${level}")`);
	const month = Number(match[1].slice(2));
	if (month < 1 || month > 12) throw new Error(`Invalid month in level "${level}"`);
	return match[1];
}

/** yymm -> ISO date of the first day of that month */
export function firstOfMonth(yymm: string): string {
	return `20${yymm.slice(0, 2)}-${yymm.slice(2)}-01`;
}

const MONTHS = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];

/** First "Month dd, yyyy" / "Month ddth, yyyy" date in a text, as ISO date. */
export function findWrittenDate(text: string): string | null {
	const match = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})/i.exec(text);
	if (!match) return null;
	const month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
	return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}
