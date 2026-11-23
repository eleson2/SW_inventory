import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against their own dev server on port 5174 with a freshly seeded
 * SQLite database (prisma/e2e.db) and fixed test credentials, so they never touch
 * the dev database or the dev server on 5173. The Prisma client must be generated
 * for SQLite (npm run db:generate with a file: DATABASE_URL).
 *
 * See https://playwright.dev/docs/test-configuration.
 */
const PORT = 5174;

export const E2E_AUTH = {
	username: 'e2e',
	password: 'e2e-password',
	secret: 'e2e-secret-0123456789abcdef0123456789abcdef'
};

export const STORAGE_STATE = 'tests/e2e/.auth/user.json';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false, // tests share one database
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'html',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},

	projects: [
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
			dependencies: ['setup']
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
			dependencies: ['setup']
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
			dependencies: ['setup']
		},
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'], storageState: STORAGE_STATE },
			dependencies: ['setup']
		}
	],

	webServer: {
		command: `npx tsx tests/e2e/prepare-db.ts && npx vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/login`,
		reuseExistingServer: false,
		timeout: 180000,
		env: {
			DATABASE_URL: 'file:./e2e.db',
			AUTH_USERNAME: E2E_AUTH.username,
			AUTH_PASSWORD: E2E_AUTH.password,
			AUTH_SECRET: E2E_AUTH.secret
		}
	}
});
