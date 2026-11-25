/**
 * Software categories (D3): what a product does. One category per product; the list is
 * maintained on /software/categories. Products without one are "Unclassified" in reports.
 */

/** Offered when the list is empty; common mainframe software functions */
export const SUGGESTED_CATEGORIES = [
	'Operating system',
	'Database',
	'Transaction monitor',
	'Security',
	'Scheduling',
	'Output management',
	'Change management',
	'Monitoring and performance',
	'Storage management',
	'Networking',
	'Automation',
	'Languages and compilers',
	'Utilities'
] as const;

export const CATEGORY_NAME_MAX = 60;

/** URL value (`?category=none`) for software without a category */
export const UNCLASSIFIED = 'none';

/** Trimmed name with single spaces */
export const cleanCategoryName = (name: string) => name.trim().replace(/\s+/g, ' ');

/** Same name regardless of case and spacing ("database" = "Database ") */
export const sameCategoryName = (a: string, b: string) =>
	cleanCategoryName(a).toLowerCase() === cleanCategoryName(b).toLowerCase();

/** Validation message for a category name, or null when it is fine */
export function categoryNameError(name: string, others: string[]): string | null {
	const clean = cleanCategoryName(name);
	if (!clean) return 'Name is required.';
	if (clean.length > CATEGORY_NAME_MAX) return `Name must be at most ${CATEGORY_NAME_MAX} characters.`;
	if (others.some((o) => sameCategoryName(o, clean))) return `A category named "${clean}" already exists.`;
	return null;
}

export interface CategoryChange {
	softwareId: string;
	from: string | null;
	to: string | null;
}

/**
 * Changes from the bulk classify form: `submitted` maps software id -> category id ('' =
 * unclassified). Unknown software and unknown categories are ignored.
 */
export function categoryChanges(
	current: Map<string, string | null>,
	submitted: Map<string, string>,
	categoryIds: Set<string>
): CategoryChange[] {
	const changes: CategoryChange[] = [];
	for (const [softwareId, value] of submitted) {
		if (!current.has(softwareId)) continue;
		const to = value === '' ? null : value;
		if (to !== null && !categoryIds.has(to)) continue;
		const from = current.get(softwareId) ?? null;
		if (from !== to) changes.push({ softwareId, from, to });
	}
	return changes;
}
