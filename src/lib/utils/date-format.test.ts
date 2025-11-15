import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime } from './date-format';

describe('formatDate', () => {
	it('should format a Date object correctly', () => {
		const date = new Date('2024-01-15T10:30:00Z');
		const formatted = formatDate(date);
		expect(formatted).toBe('Jan 15, 2024');
	});

	it('should format a date string correctly', () => {
		const formatted = formatDate('2024-01-15T10:30:00Z');
		expect(formatted).toBe('Jan 15, 2024');
	});

	it('should handle different dates', () => {
		expect(formatDate('2024-12-25')).toContain('Dec');
		expect(formatDate('2024-12-25')).toContain('25');
		expect(formatDate('2024-12-25')).toContain('2024');
	});
});

describe('formatDateTime', () => {
	it('should format a Date object with time', () => {
		const date = new Date('2024-01-15T14:30:00Z');
		const formatted = formatDateTime(date);
		expect(formatted).toContain('Jan 15, 2024');
		expect(formatted).toMatch(/\d{1,2}:\d{2}/); // Should have time
	});

	it('should format a date string with time', () => {
		const formatted = formatDateTime('2024-01-15T14:30:00Z');
		expect(formatted).toContain('2024');
		expect(formatted).toMatch(/\d{1,2}:\d{2}/);
	});

	it('should include AM/PM indicator', () => {
		const morning = formatDateTime('2024-01-15T09:30:00Z');
		const evening = formatDateTime('2024-01-15T19:30:00Z');
		expect(morning.includes('AM') || morning.includes('PM')).toBe(true);
		expect(evening.includes('AM') || evening.includes('PM')).toBe(true);
	});
});

describe('formatRelativeTime', () => {
	beforeEach(() => {
		// Use fake timers
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return "just now" for very recent dates', () => {
		const now = new Date('2024-01-15T10:30:00Z');
		vi.setSystemTime(now);

		const thirtySecondsAgo = new Date(now.getTime() - 30000);
		expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
	});

	it('should return minutes ago for recent dates', () => {
		const now = new Date('2024-01-15T10:30:00Z');
		vi.setSystemTime(now);

		const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
		expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');

		const oneMinuteAgo = new Date(now.getTime() - 60000);
		expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
	});

	it('should return hours ago for dates within 24 hours', () => {
		const now = new Date('2024-01-15T10:30:00Z');
		vi.setSystemTime(now);

		const threeHoursAgo = new Date(now.getTime() - 3 * 3600000);
		expect(formatRelativeTime(threeHoursAgo)).toBe('3 hours ago');

		const oneHourAgo = new Date(now.getTime() - 3600000);
		expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
	});

	it('should return days ago for dates within 30 days', () => {
		const now = new Date('2024-01-15T10:30:00Z');
		vi.setSystemTime(now);

		const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
		expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');

		const oneDayAgo = new Date(now.getTime() - 86400000);
		expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
	});

	it('should return formatted date for dates older than 30 days', () => {
		const now = new Date('2024-02-15T10:30:00Z');
		vi.setSystemTime(now);

		const oldDate = new Date('2023-12-01T10:30:00Z');
		const formatted = formatRelativeTime(oldDate);
		expect(formatted).toContain('Dec');
		expect(formatted).toContain('2023');
	});

	it('should handle date strings', () => {
		const now = new Date('2024-01-15T10:30:00Z');
		vi.setSystemTime(now);

		const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000).toISOString();
		expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
	});
});
