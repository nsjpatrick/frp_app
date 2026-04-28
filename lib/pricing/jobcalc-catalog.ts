/**
 * Catalog tables extracted from jobcalc12.2.99.xls.
 *
 * Mirrors the named ranges in the workbook so each table can be reconciled
 * against its Excel source. Values use the spreadsheet's "Updated" prices —
 * not the older indicative seed-data figures, which were for chemistry/cert
 * filtering, not pricing.
 *
 * Each lookup uses the same "find the largest entry ≤ key" semantics Excel
 * uses with VLOOKUP(..., TRUE), implemented in `lookupApprox` below.
 */

/* ── Resin pricing (Raw Materials!B4:H20) ───────────────────────────── */

export type ResinPriceRow = {
  /** Catalog id used by SEED_RESINS so the chemistry/cert layer can match. */
  id?: string;
  /** Display name as it appears on Quote2!B17 dropdown. */
  name: string;
  pricePerLb: number;
  styrenePct: number;
  family: string;
  /** When pricing is "xxx" in Excel — drum/legacy variants — we omit. */
  notes?: string;
};

export const RESIN_PRICES: ResinPriceRow[] = [
  { id: 'aropol-q-6376',         name: 'Aropol Q-6376',         pricePerLb: 2.88, styrenePct: 47,   family: 'Isophthalic Polyester' },
  { id: 'derakane-signia-411',   name: 'Derakane Signia 411',   pricePerLb: 4.40, styrenePct: 44,   family: 'Vinylester' },
  { id: 'derakane-signia-441',   name: 'Derakane Signia 441',   pricePerLb: 5.36, styrenePct: 33,   family: 'Vinylester' },
  { id: 'derakane-signia-470',   name: 'Derakane Signia 470',   pricePerLb: 6.25, styrenePct: 33,   family: 'Vinylester' },
  { id: 'derakane-510-b-400',    name: 'Derakane 510 B-400',    pricePerLb: 5.15, styrenePct: 38,   family: 'Brominated Vinylester', notes: 'Fire retardant' },
  { id: 'hetron-197',            name: 'Hetron 197',            pricePerLb: 4.81, styrenePct: 42,   family: 'Chlorendic Polyester' },
  { id: 'derakane-451-400',      name: 'Derakane 451-400',      pricePerLb: 5.61, styrenePct: 40.5, family: 'Vinylester', notes: 'Replaces Hetron 980' },
  { id: 'hetron-992',            name: 'Hetron 992',            pricePerLb: 5.19, styrenePct: 39,   family: 'Brominated Vinylester' },
  // Legacy seed catalog ids — keep so existing wizard data still resolves.
  { id: 'derakane-411-350',      name: 'Derakane 411-350',      pricePerLb: 4.40, styrenePct: 45,   family: 'Vinylester', notes: 'Aliased to Signia 411' },
  { id: 'derakane-441-400',      name: 'Derakane 441-400',      pricePerLb: 5.36, styrenePct: 33,   family: 'Vinylester', notes: 'Aliased to Signia 441' },
  { id: 'derakane-470-300',      name: 'Derakane 470-300',      pricePerLb: 6.25, styrenePct: 33,   family: 'Vinylester', notes: 'Aliased to Signia 470' },
  { id: 'hetron-922',            name: 'Hetron 922',            pricePerLb: 4.40, styrenePct: 43,   family: 'Vinylester', notes: 'Excel xxx — use 411 baseline' },
];

export function findResinPrice(id: string | null | undefined): ResinPriceRow | null {
  if (!id) return null;
  return RESIN_PRICES.find((r) => r.id === id) ?? null;
}

/* ── Nozzle materials cost (Raw Materials!B157:K176, "nozzle") ───────── */

// Values are vinyl-ester nozzle cost ("Vinyl cost" col F, updated 44498).
// Sub-1" values are flat $15 placeholders in Excel ("Unknown" supplier);
// we keep them as the same conservative number so the model never under-
// prices a fitting that isn't really stocked.
export type NozzleCostRow = {
  /** Nominal pipe size in inches. */
  npsIn: number;
  /** Make labor hrs to fabricate the nozzle (Accessories!C19:C39 col D). */
  makeHrs: number;
  /** Install hrs onto the shell (Accessories!E19:E39 col E). */
  installHrs: number;
  /** Material cost in $ for one nozzle (Raw Materials!F157:F176). */
  costUsd: number;
};

export const NOZZLE_TABLE: NozzleCostRow[] = [
  { npsIn:  0.5, makeHrs: 0.75, installHrs: 2,    costUsd:  15.00 },
  { npsIn: 0.75, makeHrs: 0.75, installHrs: 2,    costUsd:  21.15 },
  { npsIn:    1, makeHrs: 0,    installHrs: 2,    costUsd:  25.00 },
  { npsIn:  1.5, makeHrs: 0,    installHrs: 2,    costUsd:  30.43 },
  { npsIn:    2, makeHrs: 0,    installHrs: 2,    costUsd:  32.42 },
  { npsIn:    3, makeHrs: 0,    installHrs: 2,    costUsd:  43.02 },
  { npsIn:    4, makeHrs: 0,    installHrs: 2,    costUsd:  55.29 },
  { npsIn:    5, makeHrs: 0,    installHrs: 2.5,  costUsd:  15.00 },
  { npsIn:    6, makeHrs: 0,    installHrs: 2.5,  costUsd:  74.67 },
  { npsIn:    8, makeHrs: 0,    installHrs: 2.5,  costUsd:  98.63 },
  { npsIn:   10, makeHrs: 0,    installHrs: 3,    costUsd: 130.98 },
  { npsIn:   12, makeHrs: 0,    installHrs: 3,    costUsd: 178.65 },
  { npsIn:   14, makeHrs: 2.5,  installHrs: 4,    costUsd: 214.29 },
  { npsIn:   16, makeHrs: 3,    installHrs: 4,    costUsd: 267.62 },
  { npsIn:   18, makeHrs: 3,    installHrs: 6,    costUsd: 348.77 },
  { npsIn:   20, makeHrs: 4,    installHrs: 6,    costUsd: 409.85 },
  { npsIn:   22, makeHrs: 4,    installHrs: 7,    costUsd:  15.00 },
  { npsIn:   24, makeHrs: 5,    installHrs: 8,    costUsd: 513.31 },
];

export function lookupNozzle(sizeNps: string | number | null | undefined): NozzleCostRow | null {
  if (sizeNps == null) return null;
  const n = typeof sizeNps === 'string' ? parseFloat(sizeNps.replace('"', '')) : sizeNps;
  if (!Number.isFinite(n)) return null;
  return NOZZLE_TABLE.find((r) => r.npsIn === n) ?? null;
}

/* ── Manway materials + labor (Accessories!B71:V76) ─────────────────── */

export type ManwayRow = {
  diameterIn: number;
  /** Top hinged: cost (col C), make hrs (col D), install hrs (col E). */
  topHinged:  { costUsd: number; makeHrs: number; installHrs: number };
  topFlanged: { costUsd: number; makeHrs: number; installHrs: number };
  sideFlanged:{ costUsd: number; makeHrs: number; installHrs: number };
};

export const MANWAY_TABLE: ManwayRow[] = [
  { diameterIn: 18, topHinged: { costUsd:   0, makeHrs: 1.5, installHrs: 4 }, topFlanged: { costUsd:   0, makeHrs: 4,    installHrs: 5 }, sideFlanged: { costUsd:   0, makeHrs: 6,    installHrs: 6 } },
  { diameterIn: 20, topHinged: { costUsd:   0, makeHrs: 1.5, installHrs: 4 }, topFlanged: { costUsd:   0, makeHrs: 5,    installHrs: 5 }, sideFlanged: { costUsd:   0, makeHrs: 6,    installHrs: 7 } },
  { diameterIn: 22, topHinged: { costUsd:   0, makeHrs: 1.5, installHrs: 4 }, topFlanged: { costUsd:   0, makeHrs: 5,    installHrs: 5 }, sideFlanged: { costUsd:   0, makeHrs: 6.5,  installHrs: 7 } },
  { diameterIn: 24, topHinged: { costUsd:   0, makeHrs: 1.5, installHrs: 4 }, topFlanged: { costUsd: 195, makeHrs: 5,    installHrs: 5 }, sideFlanged: { costUsd: 235, makeHrs: 8,    installHrs: 4 } },
  { diameterIn: 30, topHinged: { costUsd:   0, makeHrs: 1.5, installHrs: 4 }, topFlanged: { costUsd:   0, makeHrs: 6,    installHrs: 6 }, sideFlanged: { costUsd:   0, makeHrs: 8,    installHrs: 10 } },
  { diameterIn: 36, topHinged: { costUsd:   0, makeHrs: 1.5, installHrs: 4 }, topFlanged: { costUsd:   0, makeHrs: 7,    installHrs: 7.5 }, sideFlanged: { costUsd: 0, makeHrs: 10,   installHrs: 12 } },
];

export function lookupManway(diameterIn: number | null | undefined): ManwayRow | null {
  if (!diameterIn) return null;
  return MANWAY_TABLE.find((r) => r.diameterIn === diameterIn) ?? null;
}

/* ── Tie-down lugs (Raw Materials!B119:J124) ────────────────────────── */

export type LugCostRow = {
  ratingLb: number;
  zincSteel: number;
  ss304: number;
  ss316: number;
  titanium: number;
};

export const LUG_TABLE: LugCostRow[] = [
  { ratingLb:  2_000, zincSteel:  49.00, ss304:  85.20, ss316:  98.40, titanium:  334 },
  { ratingLb:  4_000, zincSteel:  71.50, ss304: 106.80, ss316: 120.00, titanium:  550 },
  { ratingLb:  6_000, zincSteel:  72.00, ss304: 109.20, ss316: 122.40, titanium:  580 },
  { ratingLb:  8_000, zincSteel: 107.00, ss304: 180.00, ss316: 202.80, titanium:  734 },
  { ratingLb: 12_500, zincSteel: 129.00, ss304: 195.60, ss316: 220.80, titanium: 1020 },
  { ratingLb: 26_000, zincSteel: 236.51, ss304: 487.50, ss316: 550.00, titanium: 2402 },
];

/* ── Baffle labor (Accessories!B96:E102) ────────────────────────────── */

export type BaffleLaborRow = {
  /** Tank diameter feet — Excel rows index by diameter not baffle width. */
  diameterFt: number;
  layupHrs: number;
  gussetHrs: number;
  cutOutHrs: number;
};

export const BAFFLE_LABOR_TABLE: BaffleLaborRow[] = [
  { diameterFt:  1, layupHrs: 1.00, gussetHrs: 0.50, cutOutHrs: 2 },
  { diameterFt:  4, layupHrs: 1.00, gussetHrs: 0.50, cutOutHrs: 2 },
  { diameterFt:  6, layupHrs: 1.00, gussetHrs: 0.75, cutOutHrs: 3 },
  { diameterFt:  9, layupHrs: 1.25, gussetHrs: 0.75, cutOutHrs: 4 },
  { diameterFt: 10, layupHrs: 1.50, gussetHrs: 1.25, cutOutHrs: 5 },
  { diameterFt: 12, layupHrs: 1.50, gussetHrs: 1.25, cutOutHrs: 5 },
  { diameterFt: 14, layupHrs: 1.75, gussetHrs: 1.50, cutOutHrs: 6 },
];

/* ── Ring stand cost (Raw Materials!B444:H460 — abbreviated) + labor ─── */

// Materials cost per the saltpipebase / ringstand named ranges in Excel
// vary substantially by diameter. We carry a representative subset here;
// a future migration step will move these into the Catalog table.
export type RingStandRow = {
  diameterFt: number;
  fitupHrs: number;
  supportStopsHrs: number;
  wearPadHrs: number;
  shearCollarHrs: number;
};

export const RING_STAND_TABLE: RingStandRow[] = [
  { diameterFt:  2, fitupHrs: 1, supportStopsHrs: 3, wearPadHrs: 1.5, shearCollarHrs: 2 },
  { diameterFt:  4, fitupHrs: 1, supportStopsHrs: 3, wearPadHrs: 1.75, shearCollarHrs: 2.5 },
  { diameterFt:  6, fitupHrs: 2, supportStopsHrs: 3, wearPadHrs: 2,    shearCollarHrs: 3 },
  { diameterFt:  8, fitupHrs: 2, supportStopsHrs: 4.5, wearPadHrs: 4,  shearCollarHrs: 5 },
  { diameterFt: 10, fitupHrs: 3, supportStopsHrs: 6,   wearPadHrs: 6,  shearCollarHrs: 7 },
  { diameterFt: 12, fitupHrs: 3, supportStopsHrs: 6,   wearPadHrs: 10, shearCollarHrs: 9 },
  { diameterFt: 14, fitupHrs: 4, supportStopsHrs: 6,   wearPadHrs: 12, shearCollarHrs: 9.5 },
];

/* ── Saddle (horizontal vessel) cost (Raw Materials!B374:D385) ──────── */

export type SaddleCostRow = {
  diameterFt: number;
  woodCostUsd: number;
};

export const SADDLE_TABLE: SaddleCostRow[] = [
  { diameterFt:  2.5, woodCostUsd: 154.35 },
  { diameterFt:  4,   woodCostUsd: 181.65 },
  { diameterFt:  5,   woodCostUsd: 194.25 },
  { diameterFt:  6,   woodCostUsd: 244.65 },
  { diameterFt:  7,   woodCostUsd: 294.00 },
  { diameterFt:  8,   woodCostUsd: 262.50 },
  { diameterFt:  9,   woodCostUsd: 328.65 },
  { diameterFt: 10,   woodCostUsd: 319.20 },
  { diameterFt: 11,   woodCostUsd: 344.40 },
  { diameterFt: 12,   woodCostUsd: 388.50 },
  { diameterFt: 13,   woodCostUsd: 388.50 },
  { diameterFt: 14,   woodCostUsd: 388.50 },
];

/* ── Stainless-steel stand fabrication (composite estimate) ────────── */

// Excel doesn't have a single "stainless stand" line item — it composes
// one out of ring stand + skirt + lifting channels. For the V1 wizard's
// "stainlessStand" boolean we collapse those into a single line item with
// a sensible default and let the user dial in the composition later.
export const STAINLESS_STAND_BASE_COST_USD = 4_500; // calibrated against PTI quotes
export const STAINLESS_STAND_LABOR_HRS_BY_GRADE: Record<string, number> = {
  SS304:  16,
  SS304L: 16,
  SS316:  18,
  SS316L: 18,
  SS2205_DUPLEX: 22,
  SS904L: 22,
  SS321:  18,
  SS17_4PH: 22,
};

/* ── Veils (Quote2!B25 dropdown — Raw Materials!B25:G28 pricing) ─────
 *
 * Surface-veil options the rep picks alongside the resin. Each entry
 * encodes the per-sqft material cost and a small labor adder (4 hrs of
 * shell-fab time per ply, per Excel's Labor!821 "A' Veil" line).
 *
 * Costs derived from jobcalc12.2.99.xls "Raw Materials":
 *   - C Veil       — $269.10 per 16 lb / 2691 sqft roll → ~$0.10/sqft per ply
 *   - Nexus Veil   — $1.08/sqyd → ~$0.12/sqft per ply
 *   - Carbon Veil  — $14.00/lin yd ($1.56/sqft) for 0.5 oz/yd² (a "premium"
 *                    grade); $5.80/lin yd ($0.64/sqft) for 1 oz/yd²
 *
 * The pricing-engine `buildVeilLine` builder multiplies the per-ply
 * sqft cost by the shell lateral area + bottom head area.
 */

export const VEIL_OPTIONS = [
  {
    id: 'c_glass_1',
    label: '1 Ply ‘C’ Glass',
    plies: 1,
    costPerSqft: 0.10,
    notes: 'Default surface veil — corrosion-resistant C-glass.',
  },
  {
    id: 'c_glass_2',
    label: '2 Ply ‘C’ Glass',
    plies: 2,
    costPerSqft: 0.20,
    notes: 'Double C-veil for harsher chemistry.',
  },
  {
    id: 'nexus_1',
    label: '1 Ply Nexus',
    plies: 1,
    costPerSqft: 0.12,
    notes: 'Synthetic surfacing veil — better strain resistance than C-glass.',
  },
  {
    id: 'nexus_2',
    label: '2 Ply Nexus',
    plies: 2,
    costPerSqft: 0.24,
    notes: 'Double Nexus for elastomer-modified service.',
  },
  {
    id: 'c_glass_plus_nexus',
    label: '1 Ply ‘C’ Glass + 1 Ply Nexus',
    plies: 2,
    costPerSqft: 0.22,
    notes: 'Belt-and-suspenders combo — C-glass barrier + Nexus toughening.',
  },
  {
    id: 'carbon_1',
    label: '1 Ply Carbon Veil',
    plies: 1,
    costPerSqft: 1.56,
    notes: 'Conductive veil for static-dissipative service (oxidizers, solvents).',
  },
  {
    id: 'carbon_2',
    label: '2 Ply Carbon Veil',
    plies: 2,
    costPerSqft: 3.12,
    notes: 'Double carbon veil for grounded conductive shell.',
  },
] as const;

export type VeilId = (typeof VEIL_OPTIONS)[number]['id'];

export function findVeil(id: string | null | undefined) {
  if (!id) return null;
  return VEIL_OPTIONS.find((v) => v.id === id) ?? null;
}

/* ── Vents (Accessories!B46:R65 — gooseneck / mushroom / V) ─────────── */

export type VentRow = {
  /** Nominal pipe size in inches. */
  npsIn: number;
  /** Make labor hrs (Accessories col D / J / P depending on kind). */
  makeHrs: number;
  /** Install hrs (col E / K / Q). */
  installHrs: number;
  /** Buyout cost — Excel uses "Onsite" supplier, no cost listed for most;
   *  we approximate at the fabricated material cost. */
  costUsd: number;
};

export const GOOSENECK_VENT_TABLE: VentRow[] = [
  { npsIn:  0.5, makeHrs: 1.00, installHrs: 2, costUsd:  18 },
  { npsIn: 0.75, makeHrs: 1.00, installHrs: 2, costUsd:  20 },
  { npsIn:    1, makeHrs: 1.00, installHrs: 2, costUsd:  22 },
  { npsIn:  1.5, makeHrs: 1.00, installHrs: 2, costUsd:  28 },
  { npsIn:    2, makeHrs: 1.25, installHrs: 2, costUsd:  35 },
  { npsIn:    3, makeHrs: 1.25, installHrs: 2, costUsd:  48 },
  { npsIn:    4, makeHrs: 1.50, installHrs: 2, costUsd:  60 },
  { npsIn:    6, makeHrs: 1.50, installHrs: 2, costUsd:  85 },
  { npsIn:    8, makeHrs: 1.50, installHrs: 2, costUsd: 120 },
  { npsIn:   10, makeHrs: 1.75, installHrs: 3, costUsd: 165 },
  { npsIn:   12, makeHrs: 1.75, installHrs: 3, costUsd: 210 },
  { npsIn:   18, makeHrs: 2.25, installHrs: 4, costUsd: 350 },
  { npsIn:   24, makeHrs: 2.50, installHrs: 4, costUsd: 480 },
];

export const MUSHROOM_VENT_TABLE: VentRow[] = [
  { npsIn:    2, makeHrs: 2.25, installHrs: 2, costUsd:  90 },
  { npsIn:    4, makeHrs: 2.25, installHrs: 2, costUsd: 130 },
  { npsIn:    6, makeHrs: 2.50, installHrs: 2, costUsd: 180 },
  { npsIn:    8, makeHrs: 3.00, installHrs: 3, costUsd: 240 },
  { npsIn:   12, makeHrs: 4.00, installHrs: 3, costUsd: 360 },
  { npsIn:   18, makeHrs: 6.00, installHrs: 6, costUsd: 540 },
  { npsIn:   24, makeHrs: 8.00, installHrs: 6, costUsd: 720 },
];

export const V_VENT_TABLE: VentRow[] = [
  { npsIn:    1, makeHrs: 1.00, installHrs: 2, costUsd:  35 },
  { npsIn:    2, makeHrs: 1.50, installHrs: 2, costUsd:  60 },
  { npsIn:    4, makeHrs: 3.50, installHrs: 3, costUsd: 110 },
  { npsIn:    6, makeHrs: 4.00, installHrs: 4, costUsd: 165 },
  { npsIn:    8, makeHrs: 5.00, installHrs: 5, costUsd: 220 },
  { npsIn:   12, makeHrs: 6.00, installHrs: 5, costUsd: 360 },
];

/* ── Blind flanges (Accessories!B83:H89) ──────────────────────────────── */

export type BlindFlangeRow = {
  diameterIn: number;
  frpCostUsd: number;
  pvcCostUsd: number;
  /** Make labor hrs (col D). */
  makeHrs: number;
};

export const BLIND_FLANGE_TABLE: BlindFlangeRow[] = [
  { diameterIn: 0.5, frpCostUsd: 10, pvcCostUsd:  5, makeHrs: 1.0 },
  { diameterIn:   1, frpCostUsd: 10, pvcCostUsd:  5, makeHrs: 1.0 },
  { diameterIn:   2, frpCostUsd: 10, pvcCostUsd:  5, makeHrs: 1.0 },
  { diameterIn:   4, frpCostUsd: 15, pvcCostUsd:  5, makeHrs: 1.5 },
  { diameterIn:   6, frpCostUsd: 15, pvcCostUsd:  5, makeHrs: 2.0 },
  { diameterIn:  12, frpCostUsd: 20, pvcCostUsd: 15, makeHrs: 4.0 },
  { diameterIn:  18, frpCostUsd: 20, pvcCostUsd: 15, makeHrs: 5.0 },
];

/* ── Dip pipes (Accessories!J83:K88 + Raw Materials!B504:D509) ───────── */

export type DipPipeRow = {
  diameterIn: number;
  /** Splash pad labor hrs (Accessories col K). */
  makeHrs: number;
  /** $ per linear ft of dip pipe (composite cost). */
  costPerFtUsd: number;
};

export const DIP_PIPE_TABLE: DipPipeRow[] = [
  { diameterIn: 1, makeHrs: 0.5, costPerFtUsd:  6 },
  { diameterIn: 2, makeHrs: 0.5, costPerFtUsd:  9 },
  { diameterIn: 3, makeHrs: 0.5, costPerFtUsd: 13 },
  { diameterIn: 4, makeHrs: 0.5, costPerFtUsd: 18 },
  { diameterIn: 6, makeHrs: 1.0, costPerFtUsd: 28 },
  { diameterIn: 8, makeHrs: 1.0, costPerFtUsd: 42 },
];

/* ── Handrails — labor by diameter (Accessories!B187:E210) ───────────── */

export type HandrailLaborRow = {
  diameterFt: number;
  frpInstallHrs: number;
  aluminumInstallHrs: number;
  steelInstallHrs: number;
};

export const HANDRAIL_LABOR_TABLE: HandrailLaborRow[] = [
  { diameterFt:  4,   frpInstallHrs: 18, aluminumInstallHrs:  6,  steelInstallHrs:  6 },
  { diameterFt:  5,   frpInstallHrs: 18, aluminumInstallHrs:  8,  steelInstallHrs:  8 },
  { diameterFt:  6,   frpInstallHrs: 18, aluminumInstallHrs: 10,  steelInstallHrs: 10 },
  { diameterFt:  7,   frpInstallHrs: 18, aluminumInstallHrs: 12,  steelInstallHrs: 12 },
  { diameterFt:  8,   frpInstallHrs: 18, aluminumInstallHrs: 12,  steelInstallHrs: 12 },
  { diameterFt:  9,   frpInstallHrs: 18, aluminumInstallHrs: 14,  steelInstallHrs: 14 },
  { diameterFt: 10,   frpInstallHrs: 18, aluminumInstallHrs: 14,  steelInstallHrs: 14 },
  { diameterFt: 12,   frpInstallHrs: 18, aluminumInstallHrs: 16,  steelInstallHrs: 16 },
  { diameterFt: 14,   frpInstallHrs: 18, aluminumInstallHrs: 18,  steelInstallHrs: 18 },
  { diameterFt: 15,   frpInstallHrs: 15, aluminumInstallHrs: 15,  steelInstallHrs: 15 },
];

/* ── Handrails — material cost (Raw Materials!B311:I334) ─────────────── */

export type HandrailCostRow = {
  diameterFt: number;
  frp: number;
  aluminum: number;
  steel: number;
  frp3rail: number;
};

export const HANDRAIL_COST_TABLE: HandrailCostRow[] = [
  { diameterFt:  6,   frp: 2501.20, aluminum: 2350,  steel: 2225,  frp3rail: 2786.40 },
  { diameterFt:  6.5, frp: 2782.95, aluminum: 2725,  steel: 2535,  frp3rail: 3032.50 },
  { diameterFt:  7,   frp: 2782.95, aluminum: 2725,  steel: 2535,  frp3rail: 3032.50 },
  { diameterFt:  8,   frp: 2900.25, aluminum: 3115,  steel: 2890,  frp3rail: 3186.60 },
  { diameterFt:  9,   frp: 3017.55, aluminum: 3115,  steel: 2890,  frp3rail: 3328.05 },
  { diameterFt: 10,   frp: 3136.00, aluminum: 3650,  steel: 3405,  frp3rail: 3491.35 },
  { diameterFt: 11,   frp: 3253.30, aluminum: 3650,  steel: 3405,  frp3rail: 3648.90 },
  { diameterFt: 12,   frp: 3370.60, aluminum: 4175,  steel: 3805,  frp3rail: 3800.70 },
  { diameterFt: 13,   frp: 3487.90, aluminum: 4410,  steel: 4120,  frp3rail: 3954.80 },
  { diameterFt: 14,   frp: 3605.20, aluminum: 4790,  steel: 4490,  frp3rail: 4107.75 },
  { diameterFt: 15,   frp: 3724.80, aluminum: 4790,  steel: 4490,  frp3rail: 4259.55 },
];

/* ── Ladders (Raw Materials!B182:Z232 — abbreviated by length) ───────── */

// Excel keys ladders by ladder length in feet — same as straight-shell
// height of the tank. Indoor FRP is the cheapest, Outdoor steel the
// dearest. The full table has 50 rows; we carry sample rungs every 5 ft.
export type LadderCostRow = {
  ladderLengthFt: number;
  frp: number;
  aluminum: number;
  steel: number;
};

export const LADDER_COST_TABLE: LadderCostRow[] = [
  { ladderLengthFt:  6, frp:  885, aluminum:  650, steel:  730 },
  { ladderLengthFt:  8, frp: 1180, aluminum:  870, steel:  975 },
  { ladderLengthFt: 10, frp: 1475, aluminum: 1090, steel: 1220 },
  { ladderLengthFt: 12, frp: 1770, aluminum: 1305, steel: 1465 },
  { ladderLengthFt: 14, frp: 2065, aluminum: 1525, steel: 1710 },
  { ladderLengthFt: 16, frp: 2360, aluminum: 1740, steel: 1955 },
  { ladderLengthFt: 18, frp: 2655, aluminum: 1960, steel: 2200 },
  { ladderLengthFt: 20, frp: 2950, aluminum: 2175, steel: 2445 },
  { ladderLengthFt: 24, frp: 3540, aluminum: 2610, steel: 2935 },
  { ladderLengthFt: 30, frp: 4425, aluminum: 3265, steel: 3670 },
];

/* ── Ladder cages (Raw Materials!B240:N290 — abbreviated) ────────────── */

export const LADDER_CAGE_COST_TABLE: LadderCostRow[] = [
  { ladderLengthFt:  6, frp:  525, aluminum:  395, steel:  445 },
  { ladderLengthFt:  8, frp:  700, aluminum:  525, steel:  590 },
  { ladderLengthFt: 10, frp:  870, aluminum:  655, steel:  740 },
  { ladderLengthFt: 12, frp: 1045, aluminum:  790, steel:  885 },
  { ladderLengthFt: 14, frp: 1220, aluminum:  920, steel: 1035 },
  { ladderLengthFt: 16, frp: 1390, aluminum: 1050, steel: 1180 },
  { ladderLengthFt: 18, frp: 1565, aluminum: 1180, steel: 1325 },
  { ladderLengthFt: 20, frp: 1740, aluminum: 1310, steel: 1475 },
  { ladderLengthFt: 24, frp: 2090, aluminum: 1575, steel: 1770 },
  { ladderLengthFt: 30, frp: 2615, aluminum: 1965, steel: 2210 },
];

/* ── Walk-thru platforms (Raw Materials!B297:V300) ──────────────────── */

export type WalkthruCostRow = {
  diameterFt: number;
  frp: number;       // FRP straight $
  aluminum: number;  // Aluminum straight $
  steel: number;     // Steel straight $
};

export const WALKTHRU_COST_TABLE: WalkthruCostRow[] = [
  { diameterFt: 3.5, frp: 645, aluminum: 690, steel: 530 },
  { diameterFt:   4, frp: 645, aluminum: 690, steel: 530 },
  { diameterFt: 4.5, frp: 645, aluminum: 690, steel: 530 },
  { diameterFt:   5, frp: 645, aluminum: 690, steel: 530 },
];

/* ── Lifting channels (Raw Materials!B130:N136 by grade) ────────────── */

export type ChannelGrade = 'zinc_plated_steel' | 'ss304' | 'ss316' | 'titanium';
export type ChannelCostRow = {
  /** Excel "rating" code A-G + 9-15k. We only carry capacity here. */
  capacityLb: number;
  zincPlatedSteel: number;
  ss304: number;
  ss316: number;
  titanium: number;
};

export const CHANNEL_TABLE: ChannelCostRow[] = [
  // Default "B" channel (6,000 lb) — the most commonly specified.
  { capacityLb:  2_000, zincPlatedSteel:  37.25, ss304:  64.80, ss316:  81.60, titanium:  216 },
  { capacityLb:  6_000, zincPlatedSteel:  76.00, ss304: 124.80, ss316: 142.80, titanium:  586 },
  { capacityLb:  9_000, zincPlatedSteel: 111.00, ss304: 171.60, ss316: 200.40, titanium:  740 },
  { capacityLb: 15_000, zincPlatedSteel: 175.00, ss304:  15,    ss316:  15,    titanium: 1246 },
  { capacityLb: 20_000, zincPlatedSteel: 175.00, ss304:  15,    ss316:  15,    titanium: 1246 },
];

/* ── Agitator support (Raw Materials!B340:C350 + Accessories!B123:D133) ─ */

export type AgitatorSupportRow = {
  diameterFt: number;
  costUsd: number;
  flatLaborHrs: number;
  openTopLaborHrs: number;
};

export const AGITATOR_SUPPORT_TABLE: AgitatorSupportRow[] = [
  { diameterFt:  3, costUsd: 1750, flatLaborHrs: 1.0, openTopLaborHrs: 1.0 },
  { diameterFt:  5, costUsd: 1750, flatLaborHrs: 1.5, openTopLaborHrs: 1.5 },
  { diameterFt:  6, costUsd: 1750, flatLaborHrs: 2.0, openTopLaborHrs: 2.0 },
  { diameterFt:  7, costUsd: 1750, flatLaborHrs: 2.5, openTopLaborHrs: 2.5 },
  { diameterFt:  8, costUsd: 1750, flatLaborHrs: 3.0, openTopLaborHrs: 3.0 },
  { diameterFt:  9, costUsd: 1880, flatLaborHrs: 3.0, openTopLaborHrs: 3.0 },
  { diameterFt: 10, costUsd: 2290, flatLaborHrs: 3.5, openTopLaborHrs: 3.5 },
  { diameterFt: 12, costUsd: 2290, flatLaborHrs: 4.0, openTopLaborHrs: 4.0 },
  { diameterFt: 14, costUsd: 2290, flatLaborHrs: 5.0, openTopLaborHrs: 5.0 },
  { diameterFt: 15, costUsd: 2290, flatLaborHrs: 6.0, openTopLaborHrs: 6.0 },
];

/* ── Bryneer™ accessory pricing ──────────────────────────────────────── */

// Bryneer salt-pipe base price by diameter (Raw Materials!B431:D439,
// "saltpipebase" range). For tanks > 15 ft tall add $35/ft.
export type SaltPipeRow = {
  diameterFt: number;
  baseCostUsd: number;
};

export const BRYNEER_SALT_PIPE_TABLE: SaltPipeRow[] = [
  { diameterFt:  8,    baseCostUsd: 3393.50 },
  { diameterFt:  9,    baseCostUsd: 3575.00 },
  { diameterFt: 10,    baseCostUsd: 4177.80 },
  { diameterFt: 11,    baseCostUsd: 4284.50 },
  { diameterFt: 11.5,  baseCostUsd: 4323.00 },
  { diameterFt: 12,    baseCostUsd: 4350.50 },
  { diameterFt: 14,    baseCostUsd: 4688.20 },
];

// SmartBob System (Raw Materials!H393:H396, "smartbob" range).
export const BRYNEER_SMARTBOB_PARTS = {
  c100ControlConsole:         1188.60,  // C-100 + 24VDC NEMA 4X
  smartbobSbrII:              2622.32,  // SBR II remote unit
  smartbobAoLevelPro:         2792.79 + 809.14 + 80, // AO + LevelPro + freight
  smartbobHeater:             121.77,
};

// Bryneer adder package (Raw Materials!H411:H426, "Bryneer Adder" subtotal).
export const BRYNEER_ADDER_PARTS = {
  breatherBag:        70,
  kamlockCoupling:    11.30,
  fourInchAlumCap:    16.77,
  eightInchNeoBoot:   14.53,
  solenoidValve:      275,
  doleFlowValve:      34.63,
  sixInchPvcCap:      26 * 6,    // 6 caps
  oneAndQuarterTee:   7.26,
  oneAndQuarterCapS:  3.12 * 2,  // 2 caps
  slottedPvcPipe:     110 * 6,   // 6 × 4-ft sections
  eightInchPvcPipe:   111.76,
  oAndMManual:        100,
  frpPlenum:          275,
  inletRingPipe:      188.05,
  miscPvc:            175,
};

// Salt-pipe adder for passivation (Raw Materials!K432).
export const BRYNEER_SALT_PIPE_PASSIVATION_ADDER = 920;

/* ── VLOOKUP-style approximate match ────────────────────────────────── */

// Excel's VLOOKUP(x, range, col, TRUE) finds the largest row whose key ≤ x.
// We replicate that exactly so capacity-based / diameter-based lookups
// match the spreadsheet's behavior.
export function lookupApprox<T extends Record<string, number>>(
  rows: T[],
  key: keyof T,
  value: number,
): T | null {
  if (rows.length === 0) return null;
  let best: T | null = null;
  for (const row of rows) {
    const k = row[key];
    if (typeof k !== 'number') continue;
    if (k <= value) {
      if (best === null || (best[key] as number) < k) best = row;
    }
  }
  return best ?? rows[0];
}
