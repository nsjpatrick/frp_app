import { test, expect } from '@playwright/test';

test('sales rep creates customer → project → quote → fills wizard → downloads JSON', async ({ page }) => {
  // Log in as seeded admin (test-mode bypass).
  // Use page.request so the session cookie is shared with the page's browser context.
  const loginRes = await page.request.post('/api/test/login', { data: { email: 'admin@frp-tank-quoter.local' } });
  expect(loginRes.status()).toBe(200);

  // Create customer
  await page.goto('/customers');
  await page.fill('input[name=name]', 'Acme Chem Co.');
  await page.fill('input[name=contactName]', 'Jane Doe');
  await page.fill('input[name=contactEmail]', 'jane@acme.test');
  await page.click('button:has-text("Create")');
  await expect(page.locator('h1')).toContainText('Acme Chem Co.');

  // Create project
  await page.fill('input[name=name]', 'Main sulfuric storage');
  await page.fill('input[name=siteAddress]', '123 Industrial Pkwy, Fairfield OH');
  await page.fill('input[name=endUse]', '50% sulfuric storage');
  await page.click('button:has-text("Create project")');
  await expect(page.locator('h1')).toContainText('Main sulfuric storage');

  // Create quote
  await page.click('button:has-text("New quote")');
  await expect(page).toHaveURL(/\/step-1$/);

  // Step 1 → Step 2
  await page.click('a:has-text("Next")');
  await expect(page).toHaveURL(/\/step-2$/);

  // Step 2 fill
  await page.fill('input[name=chemical]', 'H2SO4');
  await page.selectOption('select[name=chemicalFamily]', 'dilute_acid');
  await page.fill('input[name=concentrationPct]', '50');
  await page.fill('input[name=operatingTempF]', '120');
  await page.fill('input[name=designTempF]', '140');
  await page.fill('input[name=specificGravity]', '1.4');
  await page.fill('input[name=operatingPressurePsig]', '0');
  await page.fill('input[name=vacuumPsig]', '0');
  await page.selectOption('select[name=asmeRtp1Class]', 'II');
  await page.click('button:has-text("Save and continue")');
  await expect(page).toHaveURL(/\/step-3$/);

  // Step 3 geometry (accept defaults)
  await page.click('button:has-text("Save and continue")');
  await expect(page).toHaveURL(/\/step-4$/);

  // Step 4 resin — pick the first eligible resin
  await page.locator('input[name=resinId]').first().check();
  await page.click('button:has-text("Continue to review")');
  await expect(page).toHaveURL(/\/review$/);

  // Review page assertions
  await expect(page.locator('h2')).toContainText('Review & Generate');
  await expect(page.locator('pre')).toContainText('"schema_version": "1.0.0"');
  await expect(page.locator('pre')).toContainText('"chemical": "H2SO4"');

  // JSON endpoint
  const jsonUrl = page.url().replace('/review', '/engineering.json');
  const res = await page.request.get(jsonUrl);
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.schema_version).toBe('1.0.0');
  expect(json.service.chemical).toBe('H2SO4');
  expect(json.certifications.asme_rtp1.class).toBe('II');
  expect(json.wall_buildup.corrosion_barrier.resin).toBeTruthy();
});
