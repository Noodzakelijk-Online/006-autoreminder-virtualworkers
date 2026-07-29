import { test, expect } from '@playwright/test';

test.describe('Login & Role Redirect Flow', () => {
  const adminUsername = `admin_${Date.now()}`;
  const workerUsername = `worker_${Date.now()}`;
  const password = 'testpassword';

  test('should register and redirect admin role', async ({ page }) => {
    // Register admin user
    const context = page.context();
    const request = context.request;
    
    await request.post('/api/auth/register', {
      data: {
        username: adminUsername,
        password,
        name: 'Test Admin'
      }
    });

    // Login as Admin
    await page.goto('/');
    await page.fill('input[type="text"]', adminUsername);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Admin default role is "user" initially, so should see Access Pending
    await expect(page.locator('text=Access Pending')).toBeVisible({ timeout: 10000 });
  });
});
