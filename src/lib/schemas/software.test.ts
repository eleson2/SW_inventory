import { describe, it, expect } from 'vitest';
import { softwareSchema, softwareVersionDetailSchema } from './software';

describe('softwareSchema', () => {
	it('should validate a valid software product', () => {
		const validSoftware = {
			name: 'CICS Transaction Server',
			vendor_id: '550e8400-e29b-41d4-a716-446655440000'
		};

		const result = softwareSchema.safeParse(validSoftware);
		expect(result.success).toBe(true);
	});

	it('should require name field', () => {
		const invalidSoftware = {
			vendor_id: '550e8400-e29b-41d4-a716-446655440000'
		};

		const result = softwareSchema.safeParse(invalidSoftware);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('name');
		}
	});

	it('should require vendor_id field', () => {
		const invalidSoftware = {
			name: 'CICS Transaction Server'
		};

		const result = softwareSchema.safeParse(invalidSoftware);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('vendor_id');
		}
	});

	it('should validate UUID format for vendor_id', () => {
		const invalidSoftware = {
			name: 'CICS',
			vendor_id: 'not-a-uuid'
		};

		const result = softwareSchema.safeParse(invalidSoftware);
		expect(result.success).toBe(false);
	});

	it('should allow optional description', () => {
		const software = {
			name: 'CICS',
			vendor_id: '550e8400-e29b-41d4-a716-446655440000',
			description: 'Transaction processing system'
		};

		const result = softwareSchema.safeParse(software);
		expect(result.success).toBe(true);
	});
});

describe('softwareVersionDetailSchema', () => {
	it('should validate a valid software version', () => {
		const validVersion = {
			version: 'V5R6M0',
			release_date: '2024-01-15'
		};

		const result = softwareVersionDetailSchema.safeParse(validVersion);
		expect(result.success).toBe(true);
	});

	it('should require version field', () => {
		const invalidVersion = {
			release_date: '2024-01-15'
		};

		const result = softwareVersionDetailSchema.safeParse(invalidVersion);
		expect(result.success).toBe(false);
	});

	it('should require release_date field', () => {
		const invalidVersion = {
			version: 'V5R6M0'
		};

		const result = softwareVersionDetailSchema.safeParse(invalidVersion);
		expect(result.success).toBe(false);
	});

	it('should allow optional PTF level', () => {
		const version = {
			version: 'V5R6M0',
			ptf_level: 'PTF12345',
			release_date: '2024-01-15'
		};

		const result = softwareVersionDetailSchema.safeParse(version);
		expect(result.success).toBe(true);
	});

	it('should allow optional end_of_support date', () => {
		const version = {
			version: 'V5R6M0',
			release_date: '2024-01-15',
			end_of_support: '2027-01-15'
		};

		const result = softwareVersionDetailSchema.safeParse(version);
		expect(result.success).toBe(true);
	});

	it('should allow optional release notes', () => {
		const version = {
			version: 'V5R6M0',
			release_date: '2024-01-15',
			release_notes: 'Major performance improvements and bug fixes'
		};

		const result = softwareVersionDetailSchema.safeParse(version);
		expect(result.success).toBe(true);
	});

	it('should default is_current to false', () => {
		const version = {
			version: 'V5R6M0',
			release_date: '2024-01-15'
		};

		const result = softwareVersionDetailSchema.safeParse(version);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.is_current).toBe(false);
		}
	});

	it('should transform string dates to Date objects', () => {
		const version = {
			version: 'V5R6M0',
			release_date: '2024-01-15',
			end_of_support: '2027-01-15'
		};

		const result = softwareVersionDetailSchema.safeParse(version);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.release_date).toBeInstanceOf(Date);
		}
	});
});
