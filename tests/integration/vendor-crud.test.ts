import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
	testDb,
	setupTestDatabase,
	cleanupTestDatabase,
	disconnectTestDatabase
} from '../../prisma/test-helpers';

describe('Vendor CRUD Operations', () => {
	beforeAll(async () => {
		// Database is already set up, just ensure we can connect
	});

	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
	});

	it('should create a new vendor', async () => {
		const vendor = await testDb.vendors.create({
			data: {
				name: 'Microsoft',
				code: 'MSFT',
				website: 'https://www.microsoft.com',
				contact_email: 'contact@microsoft.com'
			}
		});

		expect(vendor).toBeDefined();
		expect(vendor.id).toBeDefined();
		expect(vendor.name).toBe('Microsoft');
		expect(vendor.code).toBe('MSFT');
		expect(vendor.active).toBe(true);
	});

	it('should enforce unique code constraint', async () => {
		await testDb.vendors.create({
			data: { name: 'IBM', code: 'IBM' }
		});

		await expect(
			testDb.vendors.create({
				data: { name: 'IBM Corp', code: 'IBM' }
			})
		).rejects.toThrow();
	});

	it('should retrieve a vendor by ID', async () => {
		const created = await testDb.vendors.create({
			data: { name: 'Oracle', code: 'ORACLE' }
		});

		const retrieved = await testDb.vendors.findUnique({
			where: { id: created.id }
		});

		expect(retrieved).toBeDefined();
		expect(retrieved?.name).toBe('Oracle');
	});

	it('should update a vendor', async () => {
		const vendor = await testDb.vendors.create({
			data: { name: 'SAP', code: 'SAP' }
		});

		const updated = await testDb.vendors.update({
			where: { id: vendor.id },
			data: { website: 'https://www.sap.com' }
		});

		expect(updated.website).toBe('https://www.sap.com');
		expect(updated.updated_at.getTime()).toBeGreaterThan(updated.created_at.getTime());
	});

	it('should soft delete a vendor', async () => {
		const vendor = await testDb.vendors.create({
			data: { name: 'Adobe', code: 'ADOBE' }
		});

		const deleted = await testDb.vendors.update({
			where: { id: vendor.id },
			data: {
				active: false,
				deleted_at: new Date()
			}
		});

		expect(deleted.active).toBe(false);
		expect(deleted.deleted_at).toBeDefined();
	});

	it('should list active vendors only', async () => {
		await testDb.vendors.create({
			data: { name: 'Active Vendor', code: 'ACTIVE' }
		});

		await testDb.vendors.create({
			data: {
				name: 'Inactive Vendor',
				code: 'INACTIVE',
				active: false,
				deleted_at: new Date()
			}
		});

		const activeVendors = await testDb.vendors.findMany({
			where: { active: true }
		});

		expect(activeVendors).toHaveLength(1);
		expect(activeVendors[0].name).toBe('Active Vendor');
	});

	it('should cascade to software when vendor is deactivated', async () => {
		const vendor = await testDb.vendors.create({
			data: { name: 'Test Vendor', code: 'TEST' }
		});

		const software = await testDb.software.create({
			data: {
				name: 'Test Software',
				vendor_id: vendor.id
			}
		});

		// Deactivate vendor and cascade to software
		await testDb.vendors.update({
			where: { id: vendor.id },
			data: { active: false }
		});

		await testDb.software.updateMany({
			where: { vendor_id: vendor.id },
			data: { active: false }
		});

		const deactivatedSoftware = await testDb.software.findUnique({
			where: { id: software.id }
		});

		expect(deactivatedSoftware?.active).toBe(false);
	});
});
