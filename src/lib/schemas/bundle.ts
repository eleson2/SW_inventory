/**
 * Vendor bundle validation schemas (Broadcom CARS, IBM RSU, ...)
 */
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '#lib/constants/validation.ts';

export const BUNDLE_TYPES = ['CARS', 'RSU', 'OTHER'] as const;
export type BundleType = (typeof BUNDLE_TYPES)[number];

/**
 * A bundle item points at an existing software version, or describes a new
 * version/PTF level that the server creates on save (see resolveVersion()).
 */
export const bundleItemSchema = z
	.object({
		id: z.string().uuid().optional(), // Existing item
		software_id: z.string().uuid('Software is required'),
		software_version_id: z.string().uuid().optional().or(z.literal('')),
		new_version: z.string().max(FIELD_LENGTHS.version.max).optional(),
		new_ptf_level: z.string().max(FIELD_LENGTHS.ptfLevel.max).optional(),
		/** The release as the vendor writes it ("6.1" for V6R1M0), stored with a new version */
		new_vendor_version: z.string().max(FIELD_LENGTHS.version.max).optional(),
		notes: z.string().max(FIELD_LENGTHS.description.max).optional(),
		_action: z.enum(['keep', 'delete']).optional()
	})
	.refine((item) => item._action === 'delete' || !!item.software_version_id || !!item.new_version?.trim(), {
		message: 'Select a version or enter a new version',
		path: ['software_version_id']
	});

const bundleFields = {
	vendor_id: z.string().uuid('Vendor is required'),
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	code: z
		.string()
		.min(FIELD_LENGTHS.code.min, `Code must be at least ${FIELD_LENGTHS.code.min} characters`)
		.max(FIELD_LENGTHS.code.max)
		.regex(CODE_PATTERN, CODE_ERROR_MESSAGE),
	bundle_type: z.enum(BUNDLE_TYPES),
	release_date: z.coerce.date(),
	description: z.string().max(FIELD_LENGTHS.description.max).optional(),
	source_url: z.string().url('Must be a valid URL').max(FIELD_LENGTHS.url.max).optional().or(z.literal('')),
	items: z.array(bundleItemSchema).default([])
};

export const bundleSchema = z.object({
	...bundleFields,
	active: z.boolean().default(true)
});

export const bundleUpdateSchema = z.object({
	...bundleFields,
	active: z.boolean().optional()
});

export type BundleItem = z.infer<typeof bundleItemSchema>;
export type BundleInput = z.infer<typeof bundleSchema>;

/**
 * Suggest the next level code: CARS2511 -> CARS2512, RSU2512 -> RSU2601.
 * Codes without a trailing yymm are returned unchanged.
 */
export function nextBundleCode(code: string): string {
	const match = /^(.*?)(\d{2})(\d{2})$/.exec(code);
	if (!match) return code;
	const [, prefix, yy, mm] = match;
	let year = Number(yy);
	let month = Number(mm) + 1;
	if (month < 1 || month > 13) return code;
	if (month === 13) {
		month = 1;
		year = (year + 1) % 100;
	}
	return `${prefix}${String(year).padStart(2, '0')}${String(month).padStart(2, '0')}`;
}

/** Column order of the bundle CSV (also written by scripts/fetch-bundles). */
export const BUNDLE_CSV_COLUMNS = [
	'vendor_code',
	'bundle_code',
	'bundle_name',
	'bundle_type',
	'release_date',
	'product_code',
	'product_name',
	'version',
	'ptf_level',
	'notes',
	'source_url' // optional
] as const;

export type BundleCsvRow = Record<(typeof BUNDLE_CSV_COLUMNS)[number], string>;
