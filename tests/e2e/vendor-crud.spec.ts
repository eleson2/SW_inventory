import { test, expect } from '@playwright/test';

test.describe('Vendor Management', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('should navigate to vendors page', async ({ page }) => {
		await page.click('a[href="/vendors"]');
		await expect(page).toHaveURL('/vendors');
		await expect(page.locator('h1')).toContainText('Vendors');
	});

	test('should create a new vendor', async ({ page }) => {
		// Navigate to vendors
		await page.goto('/vendors');

		// Click "Add New" button
		await page.click('text=Add New');
		await expect(page).toHaveURL('/vendors/new');

		// Fill out the form
		await page.fill('input[name="name"]', 'Test Vendor E2E');
		await page.fill('input[name="code"]', 'TEST_E2E');
		await page.fill('input[name="website"]', 'https://test.example.com');
		await page.fill('input[name="contact_email"]', 'test@example.com');

		// Submit the form
		await page.click('button[type="submit"]');

		// Should redirect to vendors list
		await expect(page).toHaveURL('/vendors');

		// Should see success message
		await expect(page.locator('text=Vendor created successfully')).toBeVisible();

		// Should see the new vendor in the table
		await expect(page.locator('text=Test Vendor E2E')).toBeVisible();
	});

	test('should edit an existing vendor', async ({ page }) => {
		// Navigate to vendors
		await page.goto('/vendors');

		// Click edit button on first vendor (assumes there's at least one)
		await page.click('a[href*="/vendors/"][href$="/edit"]').first();
		await expect(page.url()).toContain('/edit');

		// Update the website
		await page.fill('input[name="website"]', 'https://updated.example.com');

		// Submit
		await page.click('button[type="submit"]');

		// Should redirect back to vendor detail
		await expect(page.url()).not.toContain('/edit');

		// Should see success message
		await expect(page.locator('text=updated successfully')).toBeVisible();
	});

	test('should search and filter vendors', async ({ page }) => {
		await page.goto('/vendors');

		// Type in search box
		await page.fill('input[placeholder*="Search"]', 'IBM');

		// Wait for results to filter
		await page.waitForTimeout(500);

		// Should only show matching vendors
		const rows = page.locator('tbody tr');
		await expect(rows).not.toHaveCount(0);

		// Each visible row should contain 'IBM'
		const firstRowText = await rows.first().textContent();
		expect(firstRowText?.toLowerCase()).toContain('ibm');
	});

	test('should validate required fields', async ({ page }) => {
		await page.goto('/vendors/new');

		// Try to submit without filling required fields
		await page.click('button[type="submit"]');

		// Should show validation errors
		await expect(page.locator('text=Name is required').or(page.locator('text=required'))).toBeVisible();
	});

	test('should navigate using keyboard shortcuts', async ({ page }) => {
		await page.goto('/');

		// Press 'v' for vendors
		await page.keyboard.press('v');

		// Should navigate to vendors
		await expect(page).toHaveURL('/vendors');
	});

	test('should deactivate a vendor', async ({ page }) => {
		await page.goto('/vendors');

		// Click on a vendor to view details
		await page.click('tbody tr a').first();

		// Click edit
		await page.click('text=Edit');

		// Uncheck active checkbox
		await page.uncheck('input[name="active"]');

		// Submit
		await page.click('button[type="submit"]');

		// Should see inactive badge or status
		await expect(page.locator('text=Inactive').or(page.locator('[class*="inactive"]'))).toBeVisible();
	});
});
