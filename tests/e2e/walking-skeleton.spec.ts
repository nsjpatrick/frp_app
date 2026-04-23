import { test, expect } from '@playwright/test';

/**
 * End-to-end happy path: sign in, kick off a quote on a seeded project, walk
 * the 4-step wizard (Service → Geometry → Review → Customer&Project), and
 * verify the engineering JSON endpoint still serves the full payload.
 *
 * Uses seeded data (mock-cust-00 / mock-proj-00-0) rather than exercising the
 * New Customer / New Project modals — those modals have their own portal +
 * animation behavior that deserves dedicated component tests.
 */
test('sales rep walks a seeded project through the wizard to the send step', async ({ page }) => {
  // Demo-mode auth — no login step required.
  await page.goto('/projects/mock-proj-00-0');
  await expect(page.locator('h1').first()).toBeVisible();
  await page.click('button:has-text("New Quote")');
  // First step is now Service (Customer & Project moved to the end of the flow).
  await expect(page).toHaveURL(/\/step-1$/);

  // Step 1 — Service + certifications + resin (now co-located on Chemistry).
  await page.fill('input[name=chemical]', 'H2SO4');
  await page.selectOption('select[name=chemicalFamily]', 'dilute_acid');
  await page.fill('input[name=concentrationPct]', '50');
  await page.fill('input[name=operatingTempF]', '120');
  await page.fill('input[name=designTempF]', '140');
  await page.fill('input[name=specificGravity]', '1.4');
  await page.fill('input[name=operatingPressurePsig]', '0');
  await page.fill('input[name=vacuumPsig]', '0');
  // ASME RTP-1 Class dropdown only appears after picking the RTP-1 tank type.
  await page.selectOption('select[name=tankType]', 'asme_rtp1_vessel');
  await page.selectOption('select[name=asmeRtp1Class]', 'II');
  await page.click('button:has-text("Next")');
  await expect(page).toHaveURL(/\/step-2$/);

  // Step 2 — Geometry (accept defaults) → goes straight to Review.
  await page.click('button:has-text("Next")');
  await expect(page).toHaveURL(/\/review$/);

  // Step 3 — Review page core assertions.
  await expect(page.locator('h2:has-text("Review & Generate")')).toBeVisible();
  await expect(page.locator('text=Preliminary — Engineering Review Required')).toBeVisible();
  await expect(page.locator('text=Structural Analysis (Preliminary)')).toBeVisible();
  await expect(page.locator('text=Governing case')).toBeVisible();
  await expect(page.getByRole('link', { name: /Next: Confirm Recipient/ })).toBeVisible();

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

  // Step 4 — Customer & Project confirmation. Fields prefilled from the
  // seeded customer/project; Send Quote button present.
  await page.getByRole('link', { name: /Next: Confirm Recipient/ }).click();
  await expect(page).toHaveURL(/\/send$/);
  await expect(page.locator('h2:has-text("Customer & Project")')).toBeVisible();
  await expect(page.locator('input[name=contactEmail]')).toHaveValue(/@/);
  await expect(page.getByRole('button', { name: /Send Quote/ })).toBeVisible();
});
