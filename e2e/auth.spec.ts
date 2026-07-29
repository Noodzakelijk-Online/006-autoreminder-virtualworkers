import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login form when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should see login form
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill in login form
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    
    // Should see dashboard content (not login form)
    await expect(page.locator('input[type="text"]')).not.toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill in login form with invalid credentials
    await page.fill('input[type="text"]', 'invalid');
    await page.fill('input[type="password"]', 'invalid');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('/');
    
    // Click logout button
    await page.click('button:has-text("Logout")');
    
    // Should see login form again
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
