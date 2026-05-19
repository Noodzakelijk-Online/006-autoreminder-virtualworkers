import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Navigate to settings
    await page.goto('/settings');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should update working hours', async ({ page }) => {
    // Find working hours section
    await page.click('text=Working Hours');
    
    // Change start time
    await page.fill('[data-testid="work-start-hour"]', '8');
    
    // Change end time
    await page.fill('[data-testid="work-end-hour"]', '17');
    
    // Save changes
    await page.click('button:has-text("Save")');
    
    // Should show success message
    await expect(page.locator('text=Settings saved')).toBeVisible({ timeout: 5000 });
  });

  test('should update notification preferences', async ({ page }) => {
    // Find notification section
    await page.click('text=Notifications');
    
    // Toggle email notifications
    await page.click('[data-testid="email-notifications-toggle"]');
    
    // Save changes
    await page.click('button:has-text("Save")');
    
    // Should show success message
    await expect(page.locator('text=Settings saved')).toBeVisible({ timeout: 5000 });
  });

  test('should manage holidays', async ({ page }) => {
    // Find holidays section
    await page.click('text=Holidays');
    
    // Add new holiday
    await page.click('button:has-text("Add Holiday")');
    
    // Fill in holiday details
    await page.fill('[data-testid="holiday-name"]', 'Test Holiday');
    await page.fill('[data-testid="holiday-date"]', '2026-12-25');
    
    // Save holiday
    await page.click('button:has-text("Save Holiday")');
    
    // Should show in list
    await expect(page.locator('text=Test Holiday')).toBeVisible();
  });
});
