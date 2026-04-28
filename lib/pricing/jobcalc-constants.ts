/**
 * Constants extracted from jobcalc12.2.99.xls.
 *
 * The Excel workbook is the canonical pricing model used by PTI estimators
 * today. These constants are taken directly from the live Labor sheet and
 * Master Cost rollup; the per-line efficiency markups are taken from the
 * "Modifiers" row (Labor!D865:N865).
 *
 * Source cells are noted next to each value so the engine remains
 * traceable back to the spreadsheet when the workbook is updated.
 */

/* ── Burdened labor rate (Labor!F871:F873) ──────────────────────────── */

export const DIRECT_LABOR_RATE_PER_HR     = 18.5; // F871
export const MFG_OVERHEAD_RATE_PER_HR     = 28.5; // F872
export const ADMIN_OVERHEAD_RATE_PER_HR   = 24.5; // F873

export const BURDENED_LABOR_RATE_PER_HR =
  DIRECT_LABOR_RATE_PER_HR +
  MFG_OVERHEAD_RATE_PER_HR +
  ADMIN_OVERHEAD_RATE_PER_HR;        // F870 multiplier — $71.5/hr fully loaded

/* ── Sales modifier (Master Cost2!L29) ──────────────────────────────── */

// Sale price = adjusted total cost ÷ SALES_MODIFIER. 0.38 ≈ 62% gross margin
// (price ≈ cost × 2.632). Rep can override on a per-quote basis later.
export const SALES_MODIFIER = 0.38;

/* ── Per-labor-category efficiency multipliers (Labor!D865:G865) ────── */

// Applied to the *summed* labor hours by category before they hit the
// burdened rate. Captures decades of "Finishing always runs faster than
// estimated; Shell Fab always runs slower." Indirect rolls into overhead so
// it gets zeroed out of the labor amount even though hours are tracked.
export const LABOR_EFFICIENCY = {
  shellFab:  1.15, // D865
  finishing: 0.75, // E865
  fittings:  1.00, // F865
  indirect:  0.00, // G865 — overhead absorbs these hours
} as const;

/* ── Per-line markups (Labor!W650:X849, "Efficiency Markup only") ──── */

// Each line item carries its own labor + material markup. The Excel
// codifies category-level conventions: shell-fab type work runs hot, so it
// gets 1.15; finishing/fittings runs cool at 0.78; insulation gets a 0.9
// labor discount; saddles/handrails get a 1.05 material premium.
//
// We expose them here as named tiers; line-item builders pick the tier that
// matches their category. This avoids hard-coding 200 individual markup
// pairs while staying faithful to the Excel logic.
export const LINE_MARKUP = {
  shellFab:    { labor: 1.15, material: 1.00 }, // mod shells, knuckles, top/bottom construction
  insulation:  { labor: 0.90, material: 1.00 }, // insulation rings + cover
  woodCore:    { labor: 1.15, material: 1.00 }, // plywood / balsa core layups
  finishing:   { labor: 0.78, material: 1.00 }, // prep, exterior coat, seams, baffles
  fittings:    { labor: 1.00, material: 1.00 }, // nozzles, manways, dip pipes, gaskets
  fittingsHot: { labor: 1.00, material: 1.05 }, // ring stand, lugs, channels, handrails
  flat:        { labor: 1.00, material: 1.00 }, // misc, post-cure, hydrotest, PE calcs
} as const;

export type LineMarkupTier = keyof typeof LINE_MARKUP;

/* ── Material per-pound rates (Labor!I648:N648) ─────────────────────── */

// + buyouts (col H) is in dollars and not multiplied — it represents already-
// priced bought items (Excel: cost-plus from Raw Materials).
//
// Resin (col I) is looked up by name from the resin catalog — its $/lb
// changes per quote. Use looked-up value, not a constant.
export const MATERIAL_RATES_PER_LB = {
  chopped:      1.57, // J648 → 'Raw Materials'!C24 (Chop Glass / gun roving)
  veilC:       18.00, // K648 baseline (C-veil 269.10 ÷ 16 lb roll ≈ 17.84 -> rounded)
  winding:      1.10, // L648 → 'Raw Materials'!C29 (Winding Glass)
  wovenRoving:  2.09, // M648 → 'Raw Materials'!C30 (Woven Roving 24 oz/yd²)
  uniDirectional: 1.74, // N648 → 'Raw Materials'!C31 (Unidirectional 50" roll)
} as const;

/* ── Glass weights per ply (Raw Materials col N + Excel labor logic) ── */

// Used by the shell-fab calculation to convert wall-thickness inches into
// material lbs. Numbers come from Excel cells A612:C612 ("chop weight per
// sqft = thickness × 2.4; resin weight per sqft = thickness × 6.23").
export const SHELL_FAB_RATIOS = {
  // chop strand mat (CSM) corrosion-barrier layup:
  chopLbsPerSqftPerInch:     2.4,  // Labor!B612
  resinLbsPerSqftPerInchCB:  6.23, // Labor!C612 (corrosion barrier resin)
  resinLbsPerSqftPerInchBot: 6.80, // Labor!C629 (bottom skin resin slightly higher)
  uniPlyThicknessIn:         0.023, // 'Raw Materials'!N30
  wovenPlyThicknessIn:       0.023, // 'Raw Materials'!N29
  windingPlyThicknessIn:     0.033, // 'Raw Materials'!N28
} as const;

/* ── Freight (Quote2!B82) ───────────────────────────────────────────── */

// Excel pulls B82 (manual entry) or computes from a zip-code lookup.
// Default we'll show is a $1,600 placeholder — same as the V0 engine —
// until the freight calculator is brought across.
export const DEFAULT_FREIGHT_USD = 1_600;

/* ── Hydrotest, post-cure, P.E. calcs (Labor!C596:K596) ─────────────── */

// Hydrotest is the gallon-times-rate water cost + crane rental.
// Numbers from Labor sheet:
//   Water: gal × 0.003 ($/gal)        Labor!B596
//   18-25 ton crane: $100/hr × 8     Labor!D596
//   45-ton crane:    $130/hr × 8     Labor!E596 (only for tanks > 27' tall)
//   Permit:          $250 (≥15')     Labor!F596
//   Multi-tank discount: -50% of crane cost when qty > 1
export const HYDROTEST = {
  waterCostPerGallon: 0.003,
  craneCost18to25ton: 100 * 8,
  craneCost45ton:     130 * 8,
  cranePermitCost:    250,
  multiTankDiscount:  0.5,
  // Indirect labor hours for blocking off fittings during hydrotest
  // (Labor!C598). Tank ≤ 15' gets 4 hrs, taller gets 8 hrs.
  indirectLaborHrsShort: 4,
  indirectLaborHrsTall:  8,
};

// Post-cure cost is looked up by capacity from Accessories!B107:D117 ("test"
// named range). Replicated here so we don't have to lookup-by-row.
// Capacity threshold → labor hours (everything is $30 base + this many hrs).
// Excel: VLOOKUP(capacity, test, 3, TRUE).
export const POST_CURE_LABOR_HRS_BY_CAPACITY: Array<{ minGal: number; hrs: number }> = [
  { minGal:     0, hrs: 30 },
  { minGal:   210, hrs: 30 },
  { minGal:  1010, hrs: 30 },
  { minGal:  3010, hrs: 30 },
  { minGal:  5010, hrs: 30 },
  { minGal: 10010, hrs: 30 },
  { minGal: 20010, hrs: 30 },
  { minGal: 25010, hrs: 30 },
  { minGal: 30010, hrs: 30 },
  { minGal: 35010, hrs: 30 },
];
// Excel hard-codes 30 across the board for current revision; it kept the
// table form so PTI can re-tune by capacity without changing the formula.

/* ── Stainless-steel stand (composite estimate, see jobcalc-catalog) ── */

// Re-exported from `jobcalc-catalog.ts` so existing imports from this file
// keep working — the values themselves live with the catalog tables.
export { STAINLESS_STAND_BASE_COST_USD, STAINLESS_STAND_LABOR_HRS_BY_GRADE } from './jobcalc-catalog';

/* ── Cert / inspector premiums (not in Excel; kept from V0 engine) ──── */

// Excel doesn't model ASME RTP-1 / NSF as multipliers — it embeds them in
// labor hours per ply (rtp1Laminate range, nozzle_rtp1_labor, etc.). We
// keep the V0 multiplier model for now since the wizard's cert section
// drives them at a high level; future Plan 6 will move to embedded labor.
export const CERT_PREMIUM = {
  asmeRtp1Class: { I: 0.05, II: 0.10, III: 0.20 } as Record<string, number>,
  nsfAnsi61: 0.03,
  nsfAnsi2:  0.02,
  thirdPartyInspectorFee: 3_500,
} as const;

/* ── Geometric utilities for shell weight ───────────────────────────── */

export const GAL_PER_CUBIC_INCH = 1 / 231; // 231 in³ = 1 gal
export const LB_PER_CUFT_RESIN  = 70;       // ~typical density vinyl ester
export const LB_PER_GAL_WATER   = 8.34;
