import { describe, it, expect } from 'vitest';
import { vendorSchema } from './vendor';

describe('vendorSchema', () => {
	it('should validate a valid vendor', () => {
		const validVendor = {
			name: 'IBM',
			code: 'IBM',
			website: 'https://www.ibm.com',
			contact_email: 'contact@ibm.com'
		};

		const result = vendorSchema.safeParse(validVendor);
		expect(result.success).toBe(true);
	});

	it('should require name field', () => {
		const invalidVendor = {
			code: 'IBM'
		};

		const result = vendorSchema.safeParse(invalidVendor);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('name');
		}
	});

	it('should require code field', () => {
		const invalidVendor = {
			name: 'IBM'
		};

		const result = vendorSchema.safeParse(invalidVendor);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('code');
		}
	});

	it('should enforce code format (uppercase with underscores)', () => {
		const invalidVendor = {
			name: 'IBM',
			code: 'ibm-corp' // lowercase and dashes
		};

		const result = vendorSchema.safeParse(invalidVendor);
		expect(result.success).toBe(false);
	});

	it('should accept valid code formats', () => {
		const validCodes = ['IBM', 'BROADCOM', 'RED_HAT', 'ORACLE-DB'];

		validCodes.forEach(code => {
			const vendor = { name: 'Test', code };
			const result = vendorSchema.safeParse(vendor);
			expect(result.success).toBe(true);
		});
	});

	it('should validate email format if provided', () => {
		const invalidVendor = {
			name: 'IBM',
			code: 'IBM',
			contact_email: 'not-an-email'
		};

		const result = vendorSchema.safeParse(invalidVendor);
		expect(result.success).toBe(false);
	});

	it('should allow optional fields to be omitted', () => {
		const minimalVendor = {
			name: 'IBM',
			code: 'IBM'
		};

		const result = vendorSchema.safeParse(minimalVendor);
		expect(result.success).toBe(true);
	});
});
