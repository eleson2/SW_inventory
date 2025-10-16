/**
 * Software validation schemas
 */
import { z } from 'zod';
import { FIELD_LENGTHS } from '$lib/constants/validation';

export const softwareVersionSchema = z.object({
	version: z.string().min(1, 'Version is required'),
	ptf_level: z.string().optional()
});

// Schema for individual software version (detail entity in master-detail pattern)
export const softwareVersionDetailSchema = z.object({
	id: z.string().uuid().optional(), // Optional for new versions
	version: z.string().min(1, 'Version is required').max(50),
	ptf_level: z.string().max(50).optional().or(z.literal('')),
	release_date: z.string().or(z.date()).transform((val) => {
		if (typeof val === 'string') {
			return new Date(val);
		}
		return val;
	}),
	end_of_support: z.string().or(z.date()).transform((val) => {
		if (typeof val === 'string') {
			return val ? new Date(val) : null;
		}
		return val;
	}).optional().nullable(),
	release_notes: z.string().max(1000).optional().or(z.literal('')),
	is_current: z.boolean().default(false),
	_action: z.enum(['create', 'update', 'delete']).optional() // Track intended action
});

export const softwareSchema = z.object({
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	vendor_id: z.string().uuid('Invalid vendor'),
	description: z.string().max(FIELD_LENGTHS.description.max).optional(),
	current_version_id: z.string().uuid('Invalid version').optional(),
	active: z.boolean().default(true)
});

export const softwareUpdateSchema = softwareSchema
	.partial()
	.required({ name: true, vendor_id: true });

// Master-detail schema for software with inline version management
export const softwareWithVersionsSchema = z.object({
	name: z
		.string()
		.min(FIELD_LENGTHS.name.min, `Name must be at least ${FIELD_LENGTHS.name.min} characters`)
		.max(FIELD_LENGTHS.name.max),
	vendor_id: z.string().uuid('Invalid vendor'),
	description: z.string().max(FIELD_LENGTHS.description.max).optional().or(z.literal('')),
	active: z.boolean().default(true),
	versions: z.array(softwareVersionDetailSchema).optional().default([]),
	current_version_id: z.string().uuid().optional().nullable()
}).refine(
	(data) => {
		// If there are versions, at least one must be marked as current or current_version_id must be set
		if (data.versions && data.versions.length > 0) {
			const hasCurrentFlag = data.versions.some(v => v.is_current);
			return hasCurrentFlag || !!data.current_version_id;
		}
		return true;
	},
	{
		message: 'At least one version must be marked as current',
		path: ['versions']
	}
);
