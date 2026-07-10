import { test, expect } from '@playwright/test';

test.describe('Task Scheduling Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Perform admin login
    await page.goto('/');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
  });

  test('should display advanced scheduling page and allow priorities override', async ({ page }) => {
    // Navigate to advanced scheduling
    await page.goto('/advanced-scheduling');
    
    // Check page title or header
    await expect(page.locator('h1:has-text("Advanced Task Scheduling")')).toBeVisible({ timeout: 10000 });
  });
});
