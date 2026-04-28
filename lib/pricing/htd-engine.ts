/**
 * HTD heat-loss + heater-sizing engine.
 *
 * Direct port of `HTD Tank Heat Loss Program_ver 5_PlasTanks (8-15-24).xlsx`:
 *
 *   1. Surface area  = shell lateral + top + bottom (geometry-aware:
 *                       horizontal vs vertical, dished/conical heads).
 *   2. Base HL rate   = bilinear interpolation of the (ΔT, insulation
 *                       thickness) table from the workbook's `Factor` sheet.
 *   3. Insulation     × correction factor (Fiberglass = 1, Polyurethane = 0.66,
 *      factor          Polyisocyanurate = 0.67, Polystyrene = 0.88, Cellular
 *                       Glass = 1.5, Calcium Silicate = 1.5).
 *   4. Windage factor × 1.03 / 1.07 / 1.12 / 1.17 by wind-speed bucket.
 *   5. Adjusted HL    = base × insulation × windage  (w/sqft).
 *   6. Total watts    = SA × adjusted-rate
 *                       + safety-factor margin
 *                       + supports HL (concrete / saddles / legs / skirt
 *                                       lookup, Tank dia × ΔT)
 *                       + manway HL (insulated → same rate as shell;
 *                                    uninsulated → workbook's manway lookup
 *                                    scaled by actual SA / 9.42 sqft).
 *   7. Panels needed  = ceil(totalWatts / 640).
 *   8. Controllers    = 1 per ≤5 panels, 2 per ≤10, 3 above.
 *   9. Tape rolls     = ceil(panels / 60) — conservative coverage.
 *
 * Pricing matches the xls Calculations!E57:E59:
 *   - SPXC-640-120-24 panel: $448.80
 *   - 2XTC controller:        $654.50
 *   - G01029 aluminum tape:   $53.75 / 150′ roll
 */

/* ── Inputs / outputs ────────────────────────────────────────────── */

export type HtdInsulationType =
  | 'fiberglass' | 'polyurethane' | 'polyisocyanurate'
  | 'polystyrene' | 'cellular_glass' | 'calcium_silicate';

export type HtdInsulationThickness = 1 | 1.5 | 2 | 3 | 4;

export type HtdSupportStyle = 'saddles' | 'legs' | 'concrete_pad' | 'skirt';

export type HtdInputs = {
  /** Step 1 — Design Conditions */
  diameterFt: number;
  heightFt: number;                     // straight-side height (ft)
  orientation: 'vertical' | 'horizontal';
  maintainTempF: number;
  minAmbientTempF: number;
  topHead: 'flat' | 'F_AND_D' | 'conical' | 'open_top_cover';
  bottom: 'flat_ring_supported' | 'dished' | 'conical_drain' | 'sloped';

  /** Step 2 — Plastatherm (HTD) accessories */
  insulationType: HtdInsulationType;
  insulationThicknessIn: HtdInsulationThickness;
  safetyFactor: number;                 // fractional, e.g. 0.2
  windSpeedMph: number;
  manwayCount: number;
  manwayDiameterIn: number;
  manwayInsulated: boolean;
  supportStyle: HtdSupportStyle;
  numSupports: number;
};

export type HtdOutputs = {
  deltaTF: number;
  /** Insulated surface area in ft² (top + bottom + lateral). */
  surfaceAreaSqft: number;
  baseHeatLossRate: number;             // w/ft²
  insulationFactor: number;
  windageFactor: number;
  adjustedHeatLossRate: number;         // w/ft²

  surfaceHeatLossW: number;
  safetyMarginW: number;
  supportHeatLossW: number;
  manwayHeatLossW: number;
  totalHeatLossW: number;

  panels640w: number;
  controllers2xtc: number;
  aluminumTapeRolls: number;

  panelsCostUsd: number;
  controllersCostUsd: number;
  tapeCostUsd: number;
  totalCostUsd: number;
};

/* ── Constants extracted from the HTD workbook ──────────────────── */

export const HTD_PRICING = {
  panel640wUsd:        448.80,
  controller2xtcUsd:   654.50,
  aluminumTape150Usd:   53.75,
} as const;

const PI = Math.PI;

/** Base heat-loss table — `Factor!A6:F24`. Rows are ΔT (°F) anchors, columns
 *  are insulation thickness (in). Values are watts per ft². */
const BASE_HL_TABLE: Array<{ dT: number; rates: Record<HtdInsulationThickness, number> }> = [
  { dT:   0, rates: { 1: 0,    1.5: 0,    2: 0,    3: 0,   4: 0   } },
  { dT:  50, rates: { 1: 3.4,  1.5: 2.3,  2: 1.7,  3: 1.2, 4: 0.9 } },
  { dT:  75, rates: { 1: 5.3,  1.5: 3.6,  2: 2.7,  3: 1.8, 4: 1.4 } },
  { dT: 100, rates: { 1: 7.1,  1.5: 4.8,  2: 3.6,  3: 2.4, 4: 1.8 } },
  { dT: 125, rates: { 1: 9.1,  1.5: 6.2,  2: 4.6,  3: 3.1, 4: 2.3 } },
  { dT: 150, rates: { 1: 11.0, 1.5: 7.5,  2: 5.6,  3: 3.7, 4: 2.8 } },
  { dT: 175, rates: { 1: 13.2, 1.5: 8.9,  2: 6.7,  3: 4.5, 4: 3.4 } },
  { dT: 200, rates: { 1: 15.3, 1.5: 10.3, 2: 7.7,  3: 5.2, 4: 3.9 } },
  { dT: 225, rates: { 1: 17.7, 1.5: 11.9, 2: 9.0,  3: 6.0, 4: 4.5 } },
  { dT: 250, rates: { 1: 20.0, 1.5: 13.5, 2: 10.2, 3: 6.8, 4: 5.1 } },
];

const INSULATION_FACTORS: Record<HtdInsulationType, number> = {
  fiberglass:        1.00,
  polyurethane:      0.66,
  polyisocyanurate:  0.67,
  polystyrene:       0.88,
  cellular_glass:    1.50,
  calcium_silicate:  1.50,
};

/** `Factor!A41:C44` — wind-speed buckets to multiplicative factor. */
const WINDAGE_FACTORS: Array<{ maxMph: number; factor: number }> = [
  { maxMph: 10, factor: 1.03 },
  { maxMph: 20, factor: 1.07 },
  { maxMph: 30, factor: 1.12 },
  { maxMph: Infinity, factor: 1.17 },
];

/** Support heat-loss tables — `Support` sheet rows 7-19, 26-32, 41-47, 54-58.
 *  Columns are (delta T anchor, watts) pairs at ΔT 25 / 50 / 75 / 100 / 125 /
 *  150 / 175 / 200 / 225 / 250. Lookup interpolates between rows on tank
 *  diameter and ΔT. Watts apply per-support-unit.
 *
 *  Support tables are simplified linearizations of the workbook's bilinear
 *  interpolation: we capture the values at the round-number diameters and
 *  ΔT anchors, then interpolate. Workbook accuracy ±5%. */
type SupportRow = { diaFt: number; w: Record<number, number> };
const T_ANCHORS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250];

const CONCRETE_SLAB: SupportRow[] = [
  { diaFt:  5, w: { 25: 68,  50: 137,  75: 207,  100: 278,  125: 364,  150: 451,  175: 508,  200: 566,  225: 638,  250: 711  } },
  { diaFt: 10, w: { 25: 141, 50: 283,  75: 428,  100: 573,  125: 718,  150: 864,  175: 1009, 200: 1154, 225: 1303, 250: 1452 } },
  { diaFt: 20, w: { 25: 282, 50: 566,  75: 864,  100: 1163, 125: 1461, 150: 1760, 175: 2042, 200: 2325, 225: 2624, 250: 2922 } },
  { diaFt: 30, w: { 25: 423, 50: 848,  75: 1308, 100: 1767, 125: 2192, 150: 2616, 175: 3076, 200: 3535, 225: 3959, 250: 4383 } },
  { diaFt: 40, w: { 25: 564, 50: 1131, 75: 1759, 100: 2388, 125: 2953, 150: 3518, 175: 4083, 200: 4649, 225: 5278, 250: 5906 } },
  { diaFt: 50, w: { 25: 705, 50: 1374, 75: 2160, 100: 2945, 125: 3633, 150: 4320, 175: 5106, 200: 5891, 225: 6578, 250: 7265 } },
];

const SADDLES: SupportRow[] = [
  { diaFt:  5, w: { 25: 47,  50:  93, 75: 140, 100: 186, 125: 231, 150: 275, 175: 322, 200: 368, 225: 414, 250: 461 } },
  { diaFt: 10, w: { 25: 73,  50: 145, 75: 218, 100: 290, 125: 360, 150: 430, 175: 503, 200: 576, 225: 649, 250: 721 } },
  { diaFt: 20, w: { 25: 125, 50: 250, 75: 375, 100: 500, 125: 621, 150: 741, 175: 866, 200: 991, 225:1116, 250:1241 } },
];

const SKIRT_UNINSULATED: SupportRow[] = [
  { diaFt:  5, w: { 25: 201, 50: 402,  75:  604, 100:  805, 125:  999, 150: 1193, 175: 1394, 200: 1595, 225: 1797, 250: 1998 } },
  { diaFt: 10, w: { 25: 403, 50: 806,  75: 1209, 100: 1612, 125: 2001, 150: 2389, 175: 2792, 200: 3195, 225: 3597, 250: 4000 } },
  { diaFt: 20, w: { 25: 807, 50:1613, 75: 2419, 100: 3225, 125: 4003, 150: 4780, 175: 5586, 200: 6393, 225: 7199, 250: 8006 } },
];

const LEGS: SupportRow[] = [
  { diaFt:  5, w: { 25: 13, 50: 26, 75:  39, 100:  52, 125:  64, 150:  77, 175:  90, 200: 103, 225: 116, 250: 129 } },
  { diaFt: 10, w: { 25: 42, 50: 85, 75: 127, 100: 169, 125: 260, 150: 351, 175: 343, 200: 336, 225: 378, 250: 420 } },
];

/** Manway watts — `Support!A63:K64`, row 64 only (extra-row averaged = ~11 w/sqft).
 *  Values are for a reference 24″ manway (9.42 ft²); engine scales by actual SA. */
const MANWAY_W_BY_DT: Array<{ dT: number; w: number }> = [
  { dT:   0, w:    0 },
  { dT:  50, w:  564 },
  { dT: 100, w: 1120 },
  { dT: 150, w: 1680 },
  { dT: 200, w: 2237 },
  { dT: 250, w: 2807 },
];

const REFERENCE_MANWAY_SQFT = 9.42;

/* ── Internal helpers ───────────────────────────────────────────── */

function interpolate(x: number, anchors: number[], values: number[]): number {
  if (x <= anchors[0]) return values[0];
  if (x >= anchors[anchors.length - 1]) return values[values.length - 1];
  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i]) {
      const x0 = anchors[i - 1], x1 = anchors[i];
      const y0 = values[i - 1],  y1 = values[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return values[values.length - 1];
}

function lookupBaseHeatLossRate(deltaT: number, thickness: HtdInsulationThickness): number {
  // 1-D interpolate down the column for the chosen thickness.
  const dts    = BASE_HL_TABLE.map((r) => r.dT);
  const values = BASE_HL_TABLE.map((r) => r.rates[thickness]);
  return Math.max(0, interpolate(deltaT, dts, values));
}

function windageFactor(mph: number): number {
  for (const b of WINDAGE_FACTORS) if (mph <= b.maxMph) return b.factor;
  return WINDAGE_FACTORS.at(-1)!.factor;
}

function lookupSupportWatts(rows: SupportRow[], diaFt: number, deltaT: number): number {
  // Bilinear: interpolate column-wise on ΔT first, then row-wise on dia.
  const colValues = rows.map((r) => interpolate(deltaT, T_ANCHORS, T_ANCHORS.map((t) => r.w[t] ?? 0)));
  const diaAnchors = rows.map((r) => r.diaFt);
  return Math.max(0, interpolate(diaFt, diaAnchors, colValues));
}

/** Top/bottom area for vertical tanks — flat / dished / conical / open. */
function headAreaSqft(
  diaFt: number,
  shape: 'flat' | 'F_AND_D' | 'conical' | 'open_top_cover',
  domeOrConeHeightIn = 0,
): number {
  const r = diaFt / 2;
  if (shape === 'open_top_cover') return 0; // bolt-on cover, no FRP head
  if (shape === 'flat') return PI * r * r;
  if (shape === 'F_AND_D') return 1.084 * PI * r * r;       // dished SA ≈ 1.084×flat
  // conical — slant-area lookalike using cone height (default 0 = flat fallback)
  const h = (domeOrConeHeightIn || (diaFt * 12 * 0.25)) / 12;
  return PI * r * Math.sqrt(r * r + h * h);
}

/* ── Public entry point ─────────────────────────────────────────── */

export function computeHtdHeaterSizing(inp: HtdInputs): HtdOutputs {
  const dT = Math.max(0, inp.maintainTempF - inp.minAmbientTempF);

  // ─── Surface area ────────────────────────────────────────────
  let surfaceAreaSqft: number;
  if (inp.orientation === 'horizontal') {
    // Side = lateral cylinder; ends = 2× head area.
    const lateral = PI * inp.diameterFt * inp.heightFt;
    const ends    = 2 * headAreaSqft(inp.diameterFt, inp.topHead);
    surfaceAreaSqft = lateral + ends;
  } else {
    // Vertical: top + bottom + lateral.
    const top    = headAreaSqft(inp.diameterFt, inp.topHead);
    const bottom = headAreaSqft(inp.diameterFt, inp.bottom === 'dished' ? 'F_AND_D' :
                                                inp.bottom === 'conical_drain' ? 'conical' :
                                                'flat');
    const lateral = PI * inp.diameterFt * inp.heightFt;
    surfaceAreaSqft = top + bottom + lateral;
  }

  // ─── Base / adjusted heat-loss rate ──────────────────────────
  const baseHeatLossRate     = lookupBaseHeatLossRate(dT, inp.insulationThicknessIn);
  const insulationFactor     = INSULATION_FACTORS[inp.insulationType];
  const windageF             = windageFactor(inp.windSpeedMph);
  const adjustedHeatLossRate = baseHeatLossRate * insulationFactor * windageF;

  // ─── Heat-loss subtotals ─────────────────────────────────────
  const surfaceHeatLossW = surfaceAreaSqft * adjustedHeatLossRate;
  const safetyMarginW    = surfaceHeatLossW * inp.safetyFactor;

  let supportHeatLossW = 0;
  if (inp.numSupports > 0) {
    const tables: Record<HtdSupportStyle, SupportRow[]> = {
      concrete_pad: CONCRETE_SLAB,
      saddles:      SADDLES,
      skirt:        SKIRT_UNINSULATED,
      legs:         LEGS,
    };
    const watts = lookupSupportWatts(tables[inp.supportStyle], inp.diameterFt, dT);
    supportHeatLossW = watts * inp.numSupports;
  }

  // Manway: insulated → same rate as shell × manway SA × count.
  // Uninsulated → workbook reference watts × (actual SA / 9.42) × count.
  let manwayHeatLossW = 0;
  if (inp.manwayCount > 0 && inp.manwayDiameterIn > 0) {
    const manwayRadiusFt = inp.manwayDiameterIn / 2 / 12;
    // SA ≈ disk + 12″ neck circumference (matches xls's L30 formula).
    const manwaySqft = PI * manwayRadiusFt * manwayRadiusFt
                       + (inp.manwayDiameterIn / 12) * PI;
    if (inp.manwayInsulated) {
      manwayHeatLossW = manwaySqft * adjustedHeatLossRate * inp.manwayCount;
    } else {
      const refWatts = interpolate(dT, MANWAY_W_BY_DT.map((m) => m.dT), MANWAY_W_BY_DT.map((m) => m.w));
      manwayHeatLossW = (manwaySqft / REFERENCE_MANWAY_SQFT) * refWatts * inp.manwayCount;
    }
  }

  const totalHeatLossW = surfaceHeatLossW + safetyMarginW + supportHeatLossW + manwayHeatLossW;

  // ─── Component sizing ────────────────────────────────────────
  const panels640w        = Math.max(1, Math.ceil(totalHeatLossW / 640));
  const controllers2xtc   = panels640w === 0 ? 0 :
                            panels640w <= 5  ? 1 :
                            panels640w <= 10 ? 2 :
                                               3;
  const aluminumTapeRolls = Math.max(1, Math.ceil(panels640w / 60));

  const panelsCostUsd      = panels640w        * HTD_PRICING.panel640wUsd;
  const controllersCostUsd = controllers2xtc   * HTD_PRICING.controller2xtcUsd;
  const tapeCostUsd        = aluminumTapeRolls * HTD_PRICING.aluminumTape150Usd;
  const totalCostUsd       = panelsCostUsd + controllersCostUsd + tapeCostUsd;

  return {
    deltaTF: dT,
    surfaceAreaSqft,
    baseHeatLossRate,
    insulationFactor,
    windageFactor: windageF,
    adjustedHeatLossRate,
    surfaceHeatLossW,
    safetyMarginW,
    supportHeatLossW,
    manwayHeatLossW,
    totalHeatLossW,
    panels640w,
    controllers2xtc,
    aluminumTapeRolls,
    panelsCostUsd,
    controllersCostUsd,
    tapeCostUsd,
    totalCostUsd,
  };
}

