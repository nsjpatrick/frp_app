import { test } from '@playwright/test';

test.use({ colorScheme: 'dark' });

test('dark mode — dashboard + quotes', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/dark-dashboard.png', fullPage: false });

  await page.goto('/quotes');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/dark-quotes.png', fullPage: false });

  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/dark-customers.png', fullPage: false });
});
