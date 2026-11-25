import { describe, it, expect } from 'vitest';
import { categoryChanges, categoryNameError, cleanCategoryName } from './software-category.ts';

describe('software categories (D3)', () => {
	it('validates names regardless of case and spacing', () => {
		expect(cleanCategoryName('  Output   management ')).toBe('Output management');
		expect(categoryNameError(' ', [])).toBe('Name is required.');
		expect(categoryNameError('database ', ['Database'])).toMatch(/already exists/);
		expect(categoryNameError('x'.repeat(61), [])).toMatch(/at most 60/);
		expect(categoryNameError('Scheduling', ['Database'])).toBeNull();
	});

	it('returns only real changes from the classify form', () => {
		const current = new Map<string, string | null>([
			['cics', null],
			['db2', 'db'],
			['endevor', 'chg'],
			['zos', null]
		]);
		const submitted = new Map([
			['cics', 'tm'], // newly classified
			['db2', 'db'], // unchanged
			['endevor', ''], // back to unclassified
			['gone', 'db'], // software no longer exists
			['zos', 'nope'] // unknown category
		]);
		expect(categoryChanges(current, submitted, new Set(['db', 'chg', 'tm']))).toEqual([
			{ softwareId: 'cics', from: null, to: 'tm' },
			{ softwareId: 'endevor', from: 'chg', to: null }
		]);
	});
});
