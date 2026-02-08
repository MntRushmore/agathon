import { test, expect } from '@playwright/test';

test.describe('Dashboard (unauthenticated)', () => {
  test('redirects unauthenticated users to landing page', async ({ page }) => {
    await page.goto('/');

    // Unauthenticated users should see the landing page hero
    await expect(page.getByText(/a place to think/i)).toBeVisible();
  });
});

test.describe('Dashboard structure', () => {
  test('landing page has proper semantic structure', async ({ page }) => {
    await page.goto('/');

    // Should have at least one heading
    const headings = page.getByRole('heading');
    await expect(headings.first()).toBeVisible();

    // Should have navigation
    const nav = page.locator('nav');
    await expect(nav.first()).toBeVisible();
  });

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors (e.g., third-party scripts)
    const criticalErrors = errors.filter(
      (e) => !e.includes('third-party') && !e.includes('favicon')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
