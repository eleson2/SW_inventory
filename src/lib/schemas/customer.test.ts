import { describe, it, expect } from 'vitest';
import { customerSchema } from './customer';

describe('customerSchema', () => {
	it('should validate a valid customer', () => {
		const validCustomer = {
			name: 'Acme Corporation',
			code: 'ACME',
			description: 'Leading manufacturer of everything'
		};

		const result = customerSchema.safeParse(validCustomer);
		expect(result.success).toBe(true);
	});

	it('should require name field', () => {
		const invalidCustomer = {
			code: 'ACME'
		};

		const result = customerSchema.safeParse(invalidCustomer);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('name');
		}
	});

	it('should require code field', () => {
		const invalidCustomer = {
			name: 'Acme Corporation'
		};

		const result = customerSchema.safeParse(invalidCustomer);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('code');
		}
	});

	it('should enforce code format (uppercase with underscores/dashes)', () => {
		const invalidCustomer = {
			name: 'Acme Corp',
			code: 'acme-corp' // lowercase
		};

		const result = customerSchema.safeParse(invalidCustomer);
		expect(result.success).toBe(false);
	});

	it('should accept valid code formats', () => {
		const validCodes = ['ACME', 'GLOBEX_CORP', 'INITECH-LLC', 'WAYNE_ENTERPRISES'];

		validCodes.forEach(code => {
			const customer = { name: 'Test Corp', code };
			const result = customerSchema.safeParse(customer);
			expect(result.success).toBe(true);
		});
	});

	it('should allow optional description', () => {
		const customer = {
			name: 'Acme Corp',
			code: 'ACME',
			description: 'Technology company'
		};

		const result = customerSchema.safeParse(customer);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.description).toBe('Technology company');
		}
	});

	it('should allow description to be undefined', () => {
		const customer = {
			name: 'Acme Corp',
			code: 'ACME'
		};

		const result = customerSchema.safeParse(customer);
		expect(result.success).toBe(true);
	});

	it('should reject codes with leading/trailing whitespace', () => {
		const customer = {
			name: 'Acme Corp',
			code: '  ACME  ', // whitespace not allowed
			description: 'Tech company'
		};

		const result = customerSchema.safeParse(customer);
		expect(result.success).toBe(false); // Should fail due to whitespace in code
	});

	it('should have active field default to true', () => {
		const customer = {
			name: 'Acme Corp',
			code: 'ACME'
		};

		const result = customerSchema.safeParse(customer);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.active).toBe(true);
		}
	});
});
