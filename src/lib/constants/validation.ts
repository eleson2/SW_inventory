/**
 * Common validation patterns and constants
 */

// Code validation pattern - uppercase alphanumeric with dashes/underscores
export const CODE_PATTERN = /^[A-Z0-9_-]+$/;
export const CODE_ERROR_MESSAGE =
	'Code must be uppercase alphanumeric with dashes/underscores';

// Field length constraints
export const FIELD_LENGTHS = {
	name: { min: 2, max: 100 },
	code: { min: 2, max: 20 },
	description: { max: 500 },
	version: { min: 1, max: 50 },
	ptfLevel: { max: 50 },
	email: { max: 255 },
	url: { max: 500 }
} as const;

// Pagination defaults
export const PAGINATION = {
	defaultPage: 1,
	defaultPageSize: 20,
	maxPageSize: 100
} as const;

// Entity types for audit logging
export const ENTITY_TYPES = [
	'customer',
	'vendor',
	'software',
	'package',
	'lpar',
	'software_version',
	'package_item',
	'lpar_software'
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

// Audit action types
export const AUDIT_ACTIONS = [
	'create',
	'update',
	'delete',
	'rollback',
	'version_update',
	'clone'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
