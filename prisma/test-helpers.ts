/**
 * Test helpers for integration tests
 * Provides utilities for setting up and tearing down test database
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sw_inventory_test?schema=public';

export const testDb = new PrismaClient({
	datasources: {
		db: {
			url: TEST_DATABASE_URL
		}
	}
});

/**
 * Setup test database - run migrations
 */
export async function setupTestDatabase() {
	// Set environment variable for Prisma
	process.env.DATABASE_URL = TEST_DATABASE_URL;

	try {
		// Push schema to test database
		execSync('npx prisma db push --force-reset --skip-generate', {
			env: {
				...process.env,
				DATABASE_URL: TEST_DATABASE_URL,
				PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes'
			},
			stdio: 'ignore'
		});

		console.log('✅ Test database setup complete');
	} catch (error) {
		console.error('❌ Failed to setup test database:', error);
		throw error;
	}
}

/**
 * Cleanup test database - truncate all tables
 */
export async function cleanupTestDatabase() {
	const tables = [
		'audit_log',
		'lpar_software',
		'package_items',
		'lpars',
		'packages',
		'software_versions',
		'software',
		'customers',
		'vendors'
	];

	// Truncate in reverse order to respect foreign keys
	for (const table of tables) {
		await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE`);
	}
}

/**
 * Seed test data
 */
export async function seedTestData() {
	// Create vendors
	const ibm = await testDb.vendors.create({
		data: {
			name: 'IBM',
			code: 'IBM',
			website: 'https://www.ibm.com',
			contact_email: 'contact@ibm.com'
		}
	});

	const broadcom = await testDb.vendors.create({
		data: {
			name: 'Broadcom',
			code: 'BROADCOM',
			website: 'https://www.broadcom.com',
			contact_email: 'contact@broadcom.com'
		}
	});

	// Create customers
	const acme = await testDb.customers.create({
		data: {
			name: 'Acme Corporation',
			code: 'ACME',
			description: 'Test customer'
		}
	});

	// Create software
	const cics = await testDb.software.create({
		data: {
			name: 'CICS Transaction Server',
			vendor_id: ibm.id
		}
	});

	// Create software version
	const cicsVersion = await testDb.software_versions.create({
		data: {
			software_id: cics.id,
			version: 'V5R6M0',
			ptf_level: 'PTF12345',
			release_date: new Date('2024-01-15'),
			is_current: true
		}
	});

	// Update software with current version
	await testDb.software.update({
		where: { id: cics.id },
		data: { current_version_id: cicsVersion.id }
	});

	return {
		vendors: { ibm, broadcom },
		customers: { acme },
		software: { cics },
		versions: { cicsVersion }
	};
}

/**
 * Disconnect from test database
 */
export async function disconnectTestDatabase() {
	await testDb.$disconnect();
}
