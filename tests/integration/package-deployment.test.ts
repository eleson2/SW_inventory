import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
	testDb,
	setupTestDatabase,
	cleanupTestDatabase,
	seedTestData,
	disconnectTestDatabase
} from '../../prisma/test-helpers';

describe('Package Deployment Integration', () => {
	let testData: Awaited<ReturnType<typeof seedTestData>>;

	beforeAll(async () => {
		// Database is already set up, just ensure we can connect
	});

	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
		testData = await seedTestData();
	});

	it('should create a package with items', async () => {
		const pkg = await testDb.packages.create({
			data: {
				name: 'Q1 2025 Release',
				code: 'Q1-2025',
				version: '1.0.0',
				release_date: new Date('2025-01-01'),
				package_items: {
					create: [
						{
							software_id: testData.software.cics.id,
							software_version_id: testData.versions.cicsVersion.id,
							order_index: 1
						}
					]
				}
			},
			include: {
				package_items: {
					include: {
						software: true,
						software_version: true
					}
				}
			}
		});

		expect(pkg.package_items).toHaveLength(1);
		expect(pkg.package_items[0].software.name).toBe('CICS Transaction Server');
		expect(pkg.package_items[0].software_version.version).toBe('V5R6M0');
	});

	it('should deploy package to LPAR', async () => {
		// Create package
		const pkg = await testDb.packages.create({
			data: {
				name: 'Q1 2025 Release',
				code: 'Q1-2025',
				version: '1.0.0',
				release_date: new Date('2025-01-01'),
				package_items: {
					create: [
						{
							software_id: testData.software.cics.id,
							software_version_id: testData.versions.cicsVersion.id,
							order_index: 1
						}
					]
				}
			}
		});

		// Create LPAR
		const lpar = await testDb.lpars.create({
			data: {
				name: 'PROD-LPAR-1',
				code: 'PROD-LPAR-1',
				customer_id: testData.customers.acme.id,
				current_package_id: pkg.id
			}
		});

		// Deploy software to LPAR
		await testDb.lpar_software.create({
			data: {
				lpar_id: lpar.id,
				software_id: testData.software.cics.id,
				current_version: 'V5R6M0',
				current_ptf_level: 'PTF12345',
				installed_date: new Date()
			}
		});

		// Verify deployment
		const installedSoftware = await testDb.lpar_software.findFirst({
			where: {
				lpar_id: lpar.id,
				software_id: testData.software.cics.id
			},
			include: {
				software: true
			}
		});

		expect(installedSoftware).toBeDefined();
		expect(installedSoftware?.current_version).toBe('V5R6M0');
		expect(installedSoftware?.current_ptf_level).toBe('PTF12345');
	});

	it('should handle software rollback', async () => {
		// Create LPAR with software
		const lpar = await testDb.lpars.create({
			data: {
				name: 'PROD-LPAR-1',
				code: 'PROD-LPAR-1',
				customer_id: testData.customers.acme.id
			}
		});

		// Install initial version
		const installation = await testDb.lpar_software.create({
			data: {
				lpar_id: lpar.id,
				software_id: testData.software.cics.id,
				current_version: 'V5R6M0',
				current_ptf_level: 'PTF12345',
				previous_version: 'V5R5M0',
				previous_ptf_level: 'PTF12344',
				installed_date: new Date()
			}
		});

		// Perform rollback
		const rolledBack = await testDb.lpar_software.update({
			where: { id: installation.id },
			data: {
				current_version: installation.previous_version!,
				current_ptf_level: installation.previous_ptf_level,
				previous_version: installation.current_version,
				previous_ptf_level: installation.current_ptf_level,
				rolled_back: true,
				rolled_back_at: new Date(),
				rollback_reason: 'Performance issues detected'
			}
		});

		expect(rolledBack.rolled_back).toBe(true);
		expect(rolledBack.current_version).toBe('V5R5M0');
		expect(rolledBack.previous_version).toBe('V5R6M0');
		expect(rolledBack.rollback_reason).toBe('Performance issues detected');
	});

	it('should track deployment history in audit log', async () => {
		const lpar = await testDb.lpars.create({
			data: {
				name: 'PROD-LPAR-1',
				code: 'PROD-LPAR-1',
				customer_id: testData.customers.acme.id
			}
		});

		// Create audit log entry
		await testDb.audit_log.create({
			data: {
				entity_type: 'lpar',
				entity_id: lpar.id,
				action: 'update',
				changes: {
					deployed_package: 'Q1-2025',
					software_deployed: ['CICS V5R6M0']
				}
			}
		});

		const auditLogs = await testDb.audit_log.findMany({
			where: {
				entity_type: 'lpar',
				entity_id: lpar.id
			}
		});

		expect(auditLogs).toHaveLength(1);
		expect(auditLogs[0].action).toBe('update');
		expect(auditLogs[0].changes).toHaveProperty('deployed_package');
	});

	it('should prevent duplicate software installation on same LPAR', async () => {
		const lpar = await testDb.lpars.create({
			data: {
				name: 'PROD-LPAR-1',
				code: 'PROD-LPAR-1',
				customer_id: testData.customers.acme.id
			}
		});

		await testDb.lpar_software.create({
			data: {
				lpar_id: lpar.id,
				software_id: testData.software.cics.id,
				current_version: 'V5R6M0',
				current_ptf_level: 'PTF12345'
			}
		});

		// Try to install same software again
		await expect(
			testDb.lpar_software.create({
				data: {
					lpar_id: lpar.id,
					software_id: testData.software.cics.id,
					current_version: 'V5R7M0',
					current_ptf_level: 'PTF12346'
				}
			})
		).rejects.toThrow(); // Should fail due to unique constraint
	});
});
