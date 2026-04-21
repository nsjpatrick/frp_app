import { test, expect } from '@playwright/test';

/**
 * End-to-end happy path: sign in, navigate to a seeded project, create a
 * fresh quote, walk through the 4-step wizard, land on the Review & Generate
 * page, and fetch the engineering JSON.
 *
 * Uses seeded data (mock-cust-00 / mock-proj-00-0) instead of exercising the
 * New Customer and New Project modals — those modals have their own portal
 * + animation behavior that deserves dedicated component tests rather than
 * mixing into the wizard smoke test.
 */
test('sales rep walks a seeded project through the wizard to the review page', async ({ page }) => {
  // Log in as seeded admin via the dev-only session bypass.
  const loginRes = await page.request.post('/api/test/login', {
    data: { email: 'admin@frp-tank-quoter.local' },
  });
  expect(loginRes.status()).toBe(200);

  // Kick off a new quote directly from a seeded project.
  await page.goto('/projects/mock-proj-00-0');
  await expect(page.locator('h1').first()).toBeVisible();
  await page.click('button:has-text("New Quote")');
  await expect(page).toHaveURL(/\/step-1$/);

  // Step 1 — customer/project recap. Just click Next.
  await page.click('a:has-text("Next")');
  await expect(page).toHaveURL(/\/step-2$/);

  // Step 2 — service + certifications.
  await page.fill('input[name=chemical]', 'H2SO4');
  await page.selectOption('select[name=chemicalFamily]', 'dilute_acid');
  await page.fill('input[name=concentrationPct]', '50');
  await page.fill('input[name=operatingTempF]', '120');
  await page.fill('input[name=designTempF]', '140');
  await page.fill('input[name=specificGravity]', '1.4');
  await page.fill('input[name=operatingPressurePsig]', '0');
  await page.fill('input[name=vacuumPsig]', '0');
  await page.selectOption('select[name=asmeRtp1Class]', 'II');
  await page.click('button:has-text("Next")');
  await expect(page).toHaveURL(/\/step-3$/);

  // Step 3 — geometry (accept defaults).
  await page.click('button:has-text("Next")');
  await expect(page).toHaveURL(/\/step-4$/);

  // Step 4 — pick the first eligible resin.
  await page.locator('input[name=resinId]').first().check();
  await page.click('button:has-text("Next")');
  await expect(page).toHaveURL(/\/review$/);

  // Review page core assertions.
  await expect(page.locator('h2:has-text("Review & Generate")')).toBeVisible();
  await expect(page.locator('text=Preliminary — Engineering Review Required')).toBeVisible();
  await expect(page.locator('text=Structural Analysis (Preliminary)')).toBeVisible();
  await expect(page.locator('text=Governing case')).toBeVisible();
  await expect(page.locator('text=Send Quote')).toBeVisible();

  // Engineering JSON endpoint still serves the full payload.
  const jsonUrl = page.url().replace('/review', '/engineering.json');
  const res = await page.request.get(jsonUrl);
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.schema_version).toBe('1.0.0');
  expect(json.service.chemical).toBe('H2SO4');
  expect(json.certifications.asme_rtp1.class).toBe('II');
  expect(json.wall_buildup.corrosion_barrier.resin).toBeTruthy();
  expect(json.structural_analysis).not.toBeNull();
  expect(json.structural_analysis.wallThickness.shellThicknessIn).toBeGreaterThan(0);
  expect(['0.6D+W', '0.9D+1.0E']).toContain(json.structural_analysis.loadCombination.governingCase);
});
