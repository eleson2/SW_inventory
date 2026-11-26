/**
 * LPAR environment (part of D1). Optional on the LPAR; "not set" in reports when empty.
 */
export const ENVIRONMENTS = ['PROD', 'TEST', 'DEV', 'DR'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ENVIRONMENT_LABEL: Record<Environment, string> = {
	PROD: 'Production',
	TEST: 'Test',
	DEV: 'Development',
	DR: 'Disaster recovery'
};

/** Environments that count as "test/dev only" in V2 */
export const NON_PROD: readonly Environment[] = ['TEST', 'DEV'];

/** URL value (`?env=none`) for LPARs without an environment */
export const NO_ENVIRONMENT = 'none';

export const isEnvironment = (v: unknown): v is Environment => (ENVIRONMENTS as readonly unknown[]).includes(v);
