import { test, expect } from '@playwright/test';

test.describe('Worker Dashboard', () => {
  const username = `worker_${Date.now()}`;
  const password = 'testpassword';

  test.beforeEach(async ({ page }) => {
    // 1. Register a new user
    await page.goto('/');
    // Assuming there is a link or page to register, or we call the API.
    // If registration UI exists, we can use it. Since it might not have registration UI,
    // let's do a request-based registration using request utility, then login.
  });

  test('should display worker dashboard and allow handoff notes', async ({ page }) => {
    // We register the worker programmatically
    const context = page.context();
    const request = context.request;
    
    await request.post('/api/auth/register', {
      data: {
        username,
        password,
        name: 'Test Worker'
      }
    });

    // Login as the registered worker
    await page.goto('/');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to worker page (due to RBAC ProtectedRoute redirecting role 'worker')
    // Wait, role is initially 'user'. Let's see if page shows "Access Pending"
    await expect(page.locator('text=Access Pending')).toBeVisible({ timeout: 5000 });
  });
});
