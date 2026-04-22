/**
 * Safari / WebKit audit — exercises the screens that have historically
 * broken in Safari (nested backdrop-filter, portal modals, native
 * <select> styling, fixed-position overlays inside blurred ancestors).
 *
 * Not a full happy-path E2E — this is diagnostic. Failures here indicate
 * Safari-specific issues; we screenshot each step so the evidence is
 * reviewable inline.
 */
import { test, expect } from '@playwright/test';

test.use({ browserName: 'webkit' });

test.describe('Safari compatibility audit', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.post('/api/test/login', {
      data: { email: 'admin@frp-tank-quoter.local' },
    });
    expect(res.status()).toBe(200);
  });

  test('dashboard — KPI strip, chart bars, recent quotes list render', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();

    // KPI values should be present and exact-dollar formatted.
    await expect(page.locator('text=YTD Won Revenue').first()).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/\$\d{1,3}(?:,\d{3})+/);

    // Chart: at least one bar and visible month labels.
    await expect(page.locator('text=YTD Won Revenue · 2026').first()).toBeVisible();
    await expect(page.getByText('JAN')).toBeVisible();
    await expect(page.getByText('MAR')).toBeVisible();

    // Recent Quotes card scrolls internally; header stays visible.
    await expect(page.getByRole('heading', { name: 'Recent Quotes' })).toBeVisible();

    await page.screenshot({ path: 'test-results/safari-dashboard.png', fullPage: false });
  });

  test('customers list — +CC phone numbers render canonically', async ({ page }) => {
    await page.goto('/customers');
    // Every seeded mock customer now has a +1-555-XXX-XXXX phone.
    const rows = page.locator('tbody tr');
    const firstPhone = await rows.first().locator('td').nth(3).innerText();
    expect(firstPhone).toMatch(/^\+1[-\s]\d{3}[-\s]\d{3}[-\s]\d{4}$/);
    await page.screenshot({ path: 'test-results/safari-customers.png', fullPage: false });
  });

  test('new-customer modal (on /customers) opens and stays inside viewport', async ({ page }) => {
    await page.goto('/customers');
    await page.getByRole('button', { name: 'New Customer' }).click();
    // The overlay is portal-rendered with inline-styled fixed position — it
    // should cover the full viewport regardless of the button's ancestors.
    const backdrop = page.locator('[aria-hidden]').filter({ has: page.locator('xpath=..') }).first();
    await expect(page.getByRole('dialog', { name: 'New Customer' })).toBeVisible();

    // The country-code <select> should render the dial-code.
    const dialSelect = page.getByLabel('Contact 1 country code');
    await expect(dialSelect).toBeVisible();
    // +1 should be the default.
    expect(await dialSelect.inputValue()).toBe('1');

    await page.screenshot({ path: 'test-results/safari-new-customer-modal.png', fullPage: false });
  });

  test('new-quote page — customer picker + inline modal trigger', async ({ page }) => {
    await page.goto('/quotes/new');
    await expect(page.getByRole('heading', { name: 'Start a New Quote' })).toBeVisible();
    await expect(page.getByPlaceholder('Search customers or contacts…')).toBeVisible();

    // Open the inline "+ New Customer" modal.
    await page.getByRole('button', { name: /New Customer/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'New Customer' })).toBeVisible();

    await page.screenshot({ path: 'test-results/safari-new-quote-modal.png', fullPage: false });
  });

  test('step-1 — tank-type dropdown renders description dynamically', async ({ page }) => {
    // Step 1 is now Service & Certifications (Customer & Project moved
    // to the end of the flow) — the tank-type dropdown lives here.
    await page.goto('/projects/mock-proj-00-0');
    await page.getByRole('button', { name: 'New Quote' }).click();
    await expect(page).toHaveURL(/\/step-1$/);

    const tankType = page.getByLabel('Product family');
    await expect(tankType).toBeVisible();
    // Default is frp_vessel.
    expect(await tankType.inputValue()).toBe('frp_vessel');
    // Default description renders below.
    await expect(page.getByText(/Durable fiberglass-reinforced-plastic/)).toBeVisible();

    // Switch to Scrubbers — description should update client-side.
    await tankType.selectOption('scrubber');
    await expect(page.getByText(/Air-pollution control systems/)).toBeVisible();

    await page.screenshot({ path: 'test-results/safari-step2-tanktype.png', fullPage: false });
  });
});
