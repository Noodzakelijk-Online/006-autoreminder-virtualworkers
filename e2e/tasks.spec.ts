import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should display task list', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 });
    
    // Should see at least one task
    const tasks = await page.locator('[data-testid="task-card"]').count();
    expect(tasks).toBeGreaterThan(0);
  });

  test('should complete a task', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 });
    
    // Click first task checkbox
    const firstCheckbox = page.locator('[data-testid="task-checkbox"]').first();
    await firstCheckbox.click();
    
    // Should show success message
    await expect(page.locator('text=Task completed')).toBeVisible({ timeout: 5000 });
  });

  test('should filter tasks by status', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 });
    
    // Click filter dropdown
    await page.click('[data-testid="status-filter"]');
    
    // Select "Completed" filter
    await page.click('text=Completed');
    
    // Should only show completed tasks
    const tasks = await page.locator('[data-testid="task-card"]').all();
    for (const task of tasks) {
      await expect(task.locator('[data-testid="task-status"]')).toHaveText('completed');
    }
  });

  test('should search tasks', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 });
    
    // Type in search box
    await page.fill('[data-testid="task-search"]', 'test task');
    
    // Should filter tasks
    await page.waitForTimeout(500); // Debounce
    const tasks = await page.locator('[data-testid="task-card"]').all();
    
    for (const task of tasks) {
      const text = await task.textContent();
      expect(text?.toLowerCase()).toContain('test task');
    }
  });
});
