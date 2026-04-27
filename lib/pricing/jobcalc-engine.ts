/**
 * Core jobcalc pricing engine — Labor sheet rows 650-878 in TypeScript.
 *
 * Each `JobCalcLineItem` corresponds to one row in the Excel "Itemized Cost
 * List" (Labor!650:849) and carries the same 11 columns:
 *   Shell Fab hrs · Finishing hrs · Fittings hrs · Indirect hrs ·
 *   + buyouts $ · Resin lbs · Chopped lbs · Veil lbs · Winding lbs ·
 *   Woven Roving lbs · Uni lbs
 *
 * Rollup follows Labor!F870-F878 → Master Cost2!L29:
 *   labor amount   = adjusted hrs × $71.5/hr
 *   material cost  = SUM(buyouts + lbs × $/lb per category)
 *   actual cost    = labor + material
 *   sale price     = actual cost ÷ 0.38
 */

import {
  BURDENED_LABOR_RATE_PER_HR,
  LABOR_EFFICIENCY,
  LINE_MARKUP,
  type LineMarkupTier,
  MATERIAL_RATES_PER_LB,
  SALES_MODIFIER,
} from './jobcalc-constants';
import { findResinPrice } from './jobcalc-catalog';

/* ── Line-item shape ────────────────────────────────────────────────── */

export type JobCalcLineItem = {
  /** Stable key for grouping (e.g., 'shell_fab', 'nozzle:6_in'). */
  key: string;
  /** Display label shown to the rep — matches Excel column A wording. */
  label: string;
  /** Optional rep-facing group: 'fab' | 'fittings' | 'finishing' | 'options' */
  group?: 'shell' | 'fittings' | 'finishing' | 'structure' | 'tests' | 'options';
  /** Markup tier — picks per-line labor + material multipliers. */
  markup: LineMarkupTier;

  shellFabHrs:  number;
  finishingHrs: number;
  fittingsHrs:  number;
  indirectHrs:  number;

  buyoutsUsd:    number;
  resinLb:       number;
  choppedLb:     number;
  veilLb:        number;
  windingLb:     number;
  wovenRovingLb: number;
  uniLb:         number;
};

export function emptyLine(
  key: string,
  label: string,
  markup: LineMarkupTier = 'flat',
  group?: JobCalcLineItem['group'],
): JobCalcLineItem {
  return {
    key, label, markup, group,
    shellFabHrs: 0, finishingHrs: 0, fittingsHrs: 0, indirectHrs: 0,
    buyoutsUsd:  0, resinLb: 0, choppedLb: 0, veilLb: 0,
    windingLb:   0, wovenRovingLb: 0, uniLb: 0,
  };
}

/* ── Cost computation per line item ────────────────────────────────── */

export type LineCost = {
  /** Labor dollars at the burdened rate, after per-line + per-category mults. */
  laborUsd: number;
  /** Material dollars (buyouts + lbs × $/lb), after per-line material mult. */
  materialUsd: number;
  /** laborUsd + materialUsd. */
  totalUsd: number;
  /** Total adjusted labor hours that went into laborUsd (for transparency). */
  laborHrs: number;
};

/**
 * Compute one line item's cost using the Excel-style modifier chain:
 *   1. apply per-line labor markup (W column)
 *   2. apply per-category efficiency multipliers (Labor!D865:G865)
 *   3. sum × $71.5/hr → labor amount
 *   4. apply per-line material markup (X column) to each material amount
 *   5. resin $/lb is from the resin catalog; rest are fixed catalog rates
 */
export function lineCost(line: JobCalcLineItem, resinPricePerLb: number): LineCost {
  const m = LINE_MARKUP[line.markup];

  const adjShellFab  = line.shellFabHrs  * m.labor * LABOR_EFFICIENCY.shellFab;
  const adjFinishing = line.finishingHrs * m.labor * LABOR_EFFICIENCY.finishing;
  const adjFittings  = line.fittingsHrs  * m.labor * LABOR_EFFICIENCY.fittings;
  const adjIndirect  = line.indirectHrs  * m.labor * LABOR_EFFICIENCY.indirect;

  const laborHrs = adjShellFab + adjFinishing + adjFittings + adjIndirect;
  const laborUsd = laborHrs * BURDENED_LABOR_RATE_PER_HR;

  const materialUsd =
    (line.buyoutsUsd
      + line.resinLb       * resinPricePerLb
      + line.choppedLb     * MATERIAL_RATES_PER_LB.chopped
      + line.veilLb        * MATERIAL_RATES_PER_LB.veilC
      + line.windingLb     * MATERIAL_RATES_PER_LB.winding
      + line.wovenRovingLb * MATERIAL_RATES_PER_LB.wovenRoving
      + line.uniLb         * MATERIAL_RATES_PER_LB.uniDirectional) * m.material;

  return {
    laborHrs,
    laborUsd,
    materialUsd,
    totalUsd: laborUsd + materialUsd,
  };
}

/* ── Full rollup (Labor!F870-F878 + Master Cost2!L27-L32) ──────────── */

export type CategoryTotals = {
  shellFabHrs:  number;
  finishingHrs: number;
  fittingsHrs:  number;
  indirectHrs:  number;
  buyoutsUsd:   number;
  resinLb:      number;
  choppedLb:    number;
  veilLb:       number;
  windingLb:    number;
  wovenRovingLb:number;
  uniLb:        number;
};

export type JobCalcRollup = {
  /** Per-line costs in the same order as the input. */
  lineCosts: Array<{ line: JobCalcLineItem; cost: LineCost }>;
  /** Sums of unmodified hours/lbs across all line items. */
  rawTotals: CategoryTotals;
  /** After per-line markup × per-category efficiency mult. */
  adjustedLaborHrs: { shellFab: number; finishing: number; fittings: number; indirect: number };
  /** Adjusted hrs total (sum of all four categories). */
  totalAdjustedLaborHrs: number;
  /** Burdened labor dollars. */
  laborAmountUsd: number;
  /** Total material dollars (after per-line material markup). */
  materialAmountUsd: number;
  /** laborAmountUsd + materialAmountUsd — what Excel calls "Grand Tank Total". */
  grandTankCostUsd: number;
  /** Sale price per vessel = grandTankCost ÷ SALES_MODIFIER. */
  unitSalePriceUsd: number;
};

export function rollup(lines: JobCalcLineItem[], resinPricePerLb: number): JobCalcRollup {
  const lineCosts = lines.map((line) => ({ line, cost: lineCost(line, resinPricePerLb) }));

  const rawTotals: CategoryTotals = {
    shellFabHrs:   0, finishingHrs: 0, fittingsHrs: 0, indirectHrs: 0,
    buyoutsUsd:    0, resinLb: 0, choppedLb: 0, veilLb: 0,
    windingLb:     0, wovenRovingLb: 0, uniLb: 0,
  };
  for (const l of lines) {
    rawTotals.shellFabHrs   += l.shellFabHrs;
    rawTotals.finishingHrs  += l.finishingHrs;
    rawTotals.fittingsHrs   += l.fittingsHrs;
    rawTotals.indirectHrs   += l.indirectHrs;
    rawTotals.buyoutsUsd    += l.buyoutsUsd;
    rawTotals.resinLb       += l.resinLb;
    rawTotals.choppedLb     += l.choppedLb;
    rawTotals.veilLb        += l.veilLb;
    rawTotals.windingLb     += l.windingLb;
    rawTotals.wovenRovingLb += l.wovenRovingLb;
    rawTotals.uniLb         += l.uniLb;
  }

  // Adjusted hours per category — sum each line's contribution after that
  // line's own markup, then apply the category efficiency multiplier.
  let shellFabHrsAdj  = 0;
  let finishingHrsAdj = 0;
  let fittingsHrsAdj  = 0;
  let indirectHrsAdj  = 0;
  for (const l of lines) {
    const m = LINE_MARKUP[l.markup].labor;
    shellFabHrsAdj  += l.shellFabHrs  * m;
    finishingHrsAdj += l.finishingHrs * m;
    fittingsHrsAdj  += l.fittingsHrs  * m;
    indirectHrsAdj  += l.indirectHrs  * m;
  }
  shellFabHrsAdj  *= LABOR_EFFICIENCY.shellFab;
  finishingHrsAdj *= LABOR_EFFICIENCY.finishing;
  fittingsHrsAdj  *= LABOR_EFFICIENCY.fittings;
  indirectHrsAdj  *= LABOR_EFFICIENCY.indirect;

  const totalAdjustedLaborHrs = shellFabHrsAdj + finishingHrsAdj + fittingsHrsAdj + indirectHrsAdj;
  const laborAmountUsd        = totalAdjustedLaborHrs * BURDENED_LABOR_RATE_PER_HR;
  const materialAmountUsd     = lineCosts.reduce((s, l) => s + l.cost.materialUsd, 0);
  const grandTankCostUsd      = laborAmountUsd + materialAmountUsd;
  const unitSalePriceUsd      = grandTankCostUsd / SALES_MODIFIER;

  return {
    lineCosts,
    rawTotals,
    adjustedLaborHrs: {
      shellFab:  shellFabHrsAdj,
      finishing: finishingHrsAdj,
      fittings:  fittingsHrsAdj,
      indirect:  indirectHrsAdj,
    },
    totalAdjustedLaborHrs,
    laborAmountUsd,
    materialAmountUsd,
    grandTankCostUsd,
    unitSalePriceUsd,
  };
}

/* ── Resin price lookup with sensible fallback ─────────────────────── */

export function resolveResinPricePerLb(resinId: string | null | undefined): number {
  const row = findResinPrice(resinId);
  // Default to Derakane Signia 411 ($4.40/lb) — the workhorse resin in
  // Excel's Quote2!B17 dropdown — when no resin is selected yet.
  return row?.pricePerLb ?? 4.40;
}
