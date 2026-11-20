import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock SvelteKit modules
vi.mock('$app/env', () => ({
	browser: false,
	dev: true,
	building: false,
	version: 'test'
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidate: vi.fn(),
	invalidateAll: vi.fn(),
	refreshAll: vi.fn(),
	preloadData: vi.fn(),
	preloadCode: vi.fn(),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn()
}));

// Kit 3: $app/stores was removed; $app/state exposes plain reactive objects
vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost/'),
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {},
		form: undefined,
		state: {}
	},
	navigating: { current: null },
	updated: { current: false, check: vi.fn() }
}));
