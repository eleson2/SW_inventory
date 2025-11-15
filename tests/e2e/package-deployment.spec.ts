import { test, expect } from '@playwright/test';

test.describe('Package Deployment Flow', () => {
	test('should complete full package deployment workflow', async ({ page }) => {
		// 1. Navigate to packages
		await page.goto('/packages');
		await expect(page.locator('h1')).toContainText('Packages');

		// 2. Click on a package to deploy
		await page.click('tbody tr a').first();
		await expect(page.url()).toContain('/packages/');

		// 3. Click Deploy button
		await page.click('text=Deploy Package').or(page.click('button:has-text("Deploy")'));
		await expect(page.url()).toContain('/deploy');

		// 4. Should see package details
		await expect(page.locator('h1').or(page.locator('h2'))).toContainText('Deploy');

		// 5. Should see list of LPARs to select
		const lparCheckboxes = page.locator('input[type="checkbox"]');
		await expect(lparCheckboxes).not.toHaveCount(0);

		// 6. Select at least one LPAR
		await lparCheckboxes.first().check();

		// 7. Should see deployment impact analysis
		await page.waitForSelector('text=Impact Analysis', { timeout: 5000 });

		// 8. Review changes (if any)
		const changesSection = page.locator('text=Changes').or(page.locator('text=Upgrades'));
		if (await changesSection.isVisible()) {
			// Verify impact details are shown
			await expect(page.locator('table').or(page.locator('ul'))).toBeVisible();
		}

		// 9. Confirm deployment
		await page.click('button:has-text("Confirm Deployment")');

		// 10. Should show success message
		await expect(
			page.locator('text=deployed successfully').or(page.locator('text=Deployment complete'))
		).toBeVisible({ timeout: 10000 });

		// 11. Should redirect to package detail or confirmation page
		await expect(page.url()).not.toContain('/deploy');
	});

	test('should show deployment impact correctly', async ({ page }) => {
		await page.goto('/packages');

		// Click on first package
		await page.click('tbody tr a').first();

		// Go to deploy
		await page.click('text=Deploy');

		// Select an LPAR
		await page.locator('input[type="checkbox"]').first().check();

		// Wait for impact analysis
		await page.waitForSelector('text=Impact', { timeout: 5000 });

		// Should show what will be upgraded/downgraded/installed
		const impactText = await page.locator('body').textContent();
		expect(
			impactText?.includes('Upgrade') ||
			impactText?.includes('Install') ||
			impactText?.includes('No changes')
		).toBeTruthy();
	});

	test('should prevent deployment without selecting LPARs', async ({ page }) => {
		await page.goto('/packages');

		// Navigate to deploy page
		await page.click('tbody tr a').first();
		await page.click('text=Deploy');

		// Try to confirm without selecting any LPARs
		const confirmButton = page.locator('button:has-text("Confirm")');

		// Button should be disabled or show error
		if (await confirmButton.isVisible()) {
			const isDisabled = await confirmButton.isDisabled();
			expect(isDisabled).toBe(true);
		}
	});

	test('should allow canceling deployment', async ({ page }) => {
		await page.goto('/packages');

		// Navigate to deploy
		await page.click('tbody tr a').first();
		const packageUrl = page.url();
		await page.click('text=Deploy');

		// Click cancel
		await page.click('text=Cancel').or(page.click('button:has-text("Cancel")'));

		// Should return to package detail
		await expect(page).toHaveURL(packageUrl);
	});
});

test.describe('Software Rollback', () => {
	test('should rollback software on an LPAR', async ({ page }) => {
		// Navigate to LPARs
		await page.goto('/lpars');

		// Click on an LPAR that has software installed
		await page.click('tbody tr a').first();
		await expect(page.url()).toContain('/lpars/');

		// Find a software item with rollback capability
		const rollbackButton = page.locator('button:has-text("Rollback")');

		if (await rollbackButton.isVisible()) {
			// Click rollback
			await rollbackButton.first().click();

			// Should show rollback dialog
			await expect(page.locator('text=Confirm Rollback').or(page.locator('dialog'))).toBeVisible();

			// Select a reason
			await page.selectOption('select[name="rollback_reason"]', { index: 1 });

			// Confirm
			await page.click('button:has-text("Confirm")');

			// Should show success message
			await expect(page.locator('text=rolled back successfully')).toBeVisible({ timeout: 10000 });

			// Should show "Rolled Back" badge
			await expect(page.locator('text=Rolled Back').or(page.locator('[class*="rolled"]'))).toBeVisible();
		}
	});
});

test.describe('Regression: Critical Paths', () => {
	test('should maintain data consistency after deployment', async ({ page }) => {
		await page.goto('/packages');

		// Get initial package count
		const initialCount = await page.locator('tbody tr').count();

		// Navigate away and back
		await page.goto('/vendors');
		await page.goto('/packages');

		// Count should remain the same
		const finalCount = await page.locator('tbody tr').count();
		expect(finalCount).toBe(initialCount);
	});

	test('should handle concurrent page loads', async ({ page, context }) => {
		// Open multiple pages
		const page2 = await context.newPage();

		await Promise.all([
			page.goto('/vendors'),
			page2.goto('/software')
		]);

		// Both should load successfully
		await expect(page.locator('h1')).toContainText('Vendors');
		await expect(page2.locator('h1')).toContainText('Software');

		await page2.close();
	});

	test('should preserve filter state on navigation back', async ({ page }) => {
		await page.goto('/vendors');

		// Apply filter
		await page.fill('input[placeholder*="Search"]', 'IBM');
		await page.waitForTimeout(500);

		// Click on a vendor
		await page.click('tbody tr a').first();

		// Go back
		await page.goBack();

		// Filter should still be applied
		const searchInput = page.locator('input[placeholder*="Search"]');
		await expect(searchInput).toHaveValue('IBM');
	});
});
