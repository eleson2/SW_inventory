import { describe, it, expect } from 'vitest';
import {
	parseVendorDesignation,
	compareVersions,
	comparePtfLevels,
	isVersionCompatible
} from './version-parser';

describe('parseVendorDesignation', () => {
	it('should parse IBM version format correctly', () => {
		const result = parseVendorDesignation('V5R6M0 PTF12345');
		expect(result).toEqual({
			version: 'V5R6M0',
			ptfLevel: 'PTF12345'
		});
	});

	it('should parse version without PTF level', () => {
		const result = parseVendorDesignation('V5R6M0');
		expect(result).toEqual({
			version: 'V5R6M0',
			ptfLevel: undefined
		});
	});

	it('should parse version with SP level', () => {
		const result = parseVendorDesignation('2.4.0-SP1');
		expect(result).toEqual({
			version: '2.4.0',
			ptfLevel: 'SP1'
		});
	});

	it('should handle edge cases gracefully', () => {
		expect(parseVendorDesignation('')).toEqual({ version: '', ptfLevel: undefined });
		expect(parseVendorDesignation('   ')).toEqual({ version: '', ptfLevel: undefined });
		expect(parseVendorDesignation('Invalid')).toEqual({ version: 'Invalid', ptfLevel: undefined });
	});
});

describe('compareVersions', () => {
	it('should correctly compare IBM versions', () => {
		expect(compareVersions('V5R6M0', 'V5R5M0')).toBe(1); // newer
		expect(compareVersions('V5R5M0', 'V5R6M0')).toBe(-1); // older
		expect(compareVersions('V5R6M0', 'V5R6M0')).toBe(0); // equal
	});

	it('should correctly compare semantic versions', () => {
		expect(compareVersions('2.4.0', '2.3.0')).toBe(1);
		expect(compareVersions('2.3.0', '2.4.0')).toBe(-1);
		expect(compareVersions('2.4.0', '2.4.0')).toBe(0);
	});

	it('should handle major version differences', () => {
		expect(compareVersions('V6R1M0', 'V5R9M0')).toBe(1);
		expect(compareVersions('3.0.0', '2.99.0')).toBe(1);
	});
});

describe('comparePtfLevels', () => {
	it('should compare PTF levels numerically', () => {
		expect(comparePtfLevels('PTF12345', 'PTF12344')).toBe(1);
		expect(comparePtfLevels('PTF12344', 'PTF12345')).toBe(-1);
		expect(comparePtfLevels('PTF12345', 'PTF12345')).toBe(0);
	});

	it('should compare SO levels', () => {
		expect(comparePtfLevels('SO12345', 'SO12344')).toBe(1);
		expect(comparePtfLevels('SO12344', 'SO12345')).toBe(-1);
	});

	it('should handle null PTF levels', () => {
		expect(comparePtfLevels(null, 'PTF12345')).toBe(-1);
		expect(comparePtfLevels('PTF12345', null)).toBe(1);
		expect(comparePtfLevels(null, null)).toBe(0);
	});
});

describe('isVersionCompatible', () => {
	it('should check if installed version meets requirements', () => {
		const installed1 = { version: 'V5R6M0', ptfLevel: undefined };
		const required1 = { version: 'V5R5M0', ptfLevel: undefined };
		expect(isVersionCompatible(installed1, required1)).toBe(true); // installed >= required

		const installed2 = { version: 'V5R5M0', ptfLevel: undefined };
		const required2 = { version: 'V5R6M0', ptfLevel: undefined };
		expect(isVersionCompatible(installed2, required2)).toBe(false); // installed < required

		const installed3 = { version: 'V5R6M0', ptfLevel: undefined };
		const required3 = { version: 'V5R6M0', ptfLevel: undefined };
		expect(isVersionCompatible(installed3, required3)).toBe(true); // equal
	});

	it('should work with semantic versions', () => {
		const installed1 = { version: '2.4.0', ptfLevel: undefined };
		const required1 = { version: '2.3.0', ptfLevel: undefined };
		expect(isVersionCompatible(installed1, required1)).toBe(true);

		const installed2 = { version: '2.3.0', ptfLevel: undefined };
		const required2 = { version: '2.4.0', ptfLevel: undefined };
		expect(isVersionCompatible(installed2, required2)).toBe(false);
	});

	it('should handle strict mode', () => {
		const installed = { version: 'V5R6M0', ptfLevel: 'PTF12345' };
		const required = { version: 'V5R6M0', ptfLevel: 'PTF12345' };
		expect(isVersionCompatible(installed, required, true)).toBe(true); // exact match

		const installed2 = { version: 'V5R6M0', ptfLevel: 'PTF12346' };
		const required2 = { version: 'V5R6M0', ptfLevel: 'PTF12345' };
		expect(isVersionCompatible(installed2, required2, true)).toBe(false); // not exact
	});
});
