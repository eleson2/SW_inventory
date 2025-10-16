/**
 * Server-side utilities barrel export
 * Centralized exports for all server-side functionality
 */

// Database utilities
export { db, getPaginated, softDelete, createAuditLog } from './db';

// Route factories
export {
	createDetailLoader,
	createEditLoader,
	createCreateAction,
	createUpdateAction
} from './route-factory';
export type {
	DetailLoaderOptions,
	EditLoaderOptions,
	CreateActionOptions,
	UpdateActionOptions
} from './route-factory';

// Page loader utilities
export { createPageLoader } from './page-loader';
export type { PageLoaderOptions } from './page-loader';

// Clone utilities
export {
	cloneSoftware,
	clonePackage,
	cloneLpar,
	cloneCustomer,
	cloneVendor,
	getClonePreview
} from './clone-utils';
