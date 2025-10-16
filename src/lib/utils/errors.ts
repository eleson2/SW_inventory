/**
 * Error handling utilities
 */

export class AppError extends Error {
	constructor(
		message: string,
		public code: string = 'UNKNOWN_ERROR',
		public statusCode: number = 500,
		public details?: unknown
	) {
		super(message);
		this.name = 'AppError';
	}
}

export class ValidationError extends AppError {
	constructor(message: string, details?: unknown) {
		super(message, 'VALIDATION_ERROR', 400, details);
		this.name = 'ValidationError';
	}
}

export class NotFoundError extends AppError {
	constructor(entity: string, id?: string) {
		const message = id ? `${entity} with ID '${id}' not found` : `${entity} not found`;
		super(message, 'NOT_FOUND', 404);
		this.name = 'NotFoundError';
	}
}

export class DuplicateError extends AppError {
	constructor(entity: string, field: string, value: string) {
		super(
			`${entity} with ${field} '${value}' already exists`,
			'DUPLICATE_ERROR',
			409,
			{ field, value }
		);
		this.name = 'DuplicateError';
	}
}

export class DatabaseError extends AppError {
	constructor(message: string, details?: unknown) {
		super(message, 'DATABASE_ERROR', 500, details);
		this.name = 'DatabaseError';
	}
}

/**
 * Check if error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown) {
	if (isAppError(error)) {
		return {
			error: error.message,
			code: error.code,
			details: error.details
		};
	}

	// Generic error fallback
	return {
		error: error instanceof Error ? error.message : 'An unexpected error occurred',
		code: 'INTERNAL_ERROR'
	};
}

/**
 * Safe error logger - logs errors without exposing sensitive data
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
	if (isAppError(error)) {
		console.error(`[${error.code}] ${error.message}`, {
			statusCode: error.statusCode,
			details: error.details,
			...context
		});
	} else if (error instanceof Error) {
		console.error(`[UNEXPECTED_ERROR] ${error.message}`, {
			stack: error.stack,
			...context
		});
	} else {
		console.error('[UNKNOWN_ERROR]', { error, ...context });
	}
}
