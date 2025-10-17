/**
 * Zod validation schemas for forms and API validation
 * Organized by domain for better maintainability
 */

// Re-export all schemas from domain-specific modules
export * from './customer';
export * from './vendor';
export * from './software';
export * from './package';
export * from './lpar';
export * from './common';
