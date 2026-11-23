import { test as setup, expect } from '@playwright/test';
import { E2E_AUTH, STORAGE_STATE } from '../../playwright.config.ts';

// Log in once; the other projects reuse the session cookie via storageState
setup('log in', async ({ page }) => {
	await page.goto('/login');
	await page.fill('input[name="username"]', E2E_AUTH.username);
	await page.fill('input[name="password"]', E2E_AUTH.password);
	await page.click('button[type="submit"]');
	await expect(page).not.toHaveURL(/\/login/);
	await page.context().storageState({ path: STORAGE_STATE });
});
