import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('renders hero content and CTA', async ({ page }) => {
    await page.goto('/');

    // Hero heading should be visible
    await expect(page.getByRole('heading', { name: /a place to think/i })).toBeVisible();

    // Tagline words should be present
    await expect(page.getByText('Draw freely')).toBeVisible();
    await expect(page.getByText('Think visually')).toBeVisible();
    await expect(page.getByText('Learn deeply')).toBeVisible();

    // CTA button should be present
    await expect(page.getByRole('button', { name: /get early access/i })).toBeVisible();
  });

  test('opens waitlist dialog from CTA', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /get early access/i }).click();

    // Waitlist dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('navigation has logo and login button', async ({ page }) => {
    await page.goto('/');

    // Logo image
    await expect(page.getByAltText('agathon')).toBeVisible();

    // Login button (desktop)
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });
});
