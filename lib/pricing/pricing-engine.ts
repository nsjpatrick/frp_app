/**
 * V1 pricing engine — driven by jobcalc12.2.99.xls.
 *
 * The previous engine was a calibrated mock. This one is structurally
 * faithful to the Excel workbook PTI estimators use today:
 *
 *   inputs → line items → per-line markup → category efficiency
 *          → burdened labor + material catalog → cost
 *          → ÷ sales modifier → unit sale price
 *
 * Public surface kept stable so the wizard's `LiveSummary` keeps working
 * without a refactor:
 *
 *   computePricing(inputs) → { unitPrice, unitLines, quantity,
 *                              extendedPrice, freight, totalDelivered }
 *
 * New optional fields (`breakdown`, `categoryTotals`, `costStructure`)
 * carry the full Excel-style detail for power users / future drill-down.
 */

import {
  CERT_PREMIUM,
  DEFAULT_FREIGHT_USD,
} from './jobcalc-constants';
import {
  buildAllLines,
  type JobCalcInputs,
} from './jobcalc-line-items';
import {
  type JobCalcRollup,
  type JobCalcLineItem,
  resolveResinPricePerLb,
  rollup,
} from './jobcalc-engine';

/* ── Public types (backwards-compatible with V0 engine) ────────────── */

export type PricingInputs = JobCalcInputs;

export type PricingLine = {
  key: string;
  label: string;
  amount: number;
};

export type PricingBreakdown = {
  /** Per-vessel sale price (rep-facing). */
  unitPrice: number;
  /** Rep-friendly bucketed line items that roll up to `unitPrice`. */
  unitLines: PricingLine[];
  quantity: number;
  /** unitPrice × quantity. */
  extendedPrice: number;
  freight: number;
  /** extendedPrice + freight — what the rep quotes. */
  totalDelivered: number;

  /** ─── New: full Excel-faithful breakdown for power users ───────── */
  detail: {
    /** Burdened labor amount before sales markup ($). */
    laborAmountUsd: number;
    /** Material amount before sales markup ($). */
    materialAmountUsd: number;
    /** laborAmountUsd + materialAmountUsd — Excel "Grand Tank Total". */
    grandTankCostUsd: number;
    /** Margin uplift = unitPrice − grandTankCostUsd. */
    salesUpliftUsd: number;
    /** Adjusted hours by labor category, post-efficiency multipliers. */
    laborHoursAdjusted: JobCalcRollup['adjustedLaborHrs'];
    /** Total adjusted labor hours (sum of categories). */
    totalAdjustedLaborHrs: number;
    /** Resin $/lb actually used in this calc. */
    resinPricePerLb: number;
    /** Full itemized list — one row per Excel line item that contributed. */
    lineItems: Array<{
      key: string;
      label: string;
      group?: JobCalcLineItem['group'];
      laborHrs: number;
      laborUsd: number;
      materialUsd: number;
      totalUsd: number;
    }>;
  };
};

/* ── Main entry point ──────────────────────────────────────────────── */

export function computePricing(inputs: PricingInputs): PricingBreakdown {
  const quantity = Math.max(1, Math.floor(Number(inputs.geometry?.quantity) || 1));

  // 1. Build the line items the wizard's current state implies.
  const lines = buildAllLines(inputs);

  // 2. Resolve resin price ($/lb) — drives the resin column in the rollup.
  const resinPricePerLb = resolveResinPricePerLb(inputs.wallBuildup?.resinId);

  // 3. Excel-style rollup → cost.
  const r = rollup(lines, resinPricePerLb);

  // 4. Apply certification premiums on top of cost (multiplicative on the
  //    cost subtotal). RTP-1 + NSF aren't first-class in the Excel rollup
  //    chain — Excel embeds them in per-line labor — but the wizard treats
  //    them as switches, so we lift them up to the cost level here.
  let certifiedCostUsd = r.grandTankCostUsd;
  const certLines: PricingLine[] = [];

  const cls = inputs.certs?.asmeRtp1Class as keyof typeof CERT_PREMIUM.asmeRtp1Class | undefined;
  if (cls && CERT_PREMIUM.asmeRtp1Class[cls]) {
    const pct = CERT_PREMIUM.asmeRtp1Class[cls];
    const premium = certifiedCostUsd * pct;
    certifiedCostUsd += premium;
    certLines.push({
      key: 'asme_rtp1',
      label: `ASME RTP-1 Class ${cls} QA premium (+${Math.round(pct * 100)}%)`,
      amount: round2(premium / 0.38), // priced through, like every other line
    });
  }
  if (inputs.certs?.nsfAnsi61Required) {
    const premium = certifiedCostUsd * CERT_PREMIUM.nsfAnsi61;
    certifiedCostUsd += premium;
    certLines.push({
      key: 'nsf61',
      label: `NSF/ANSI 61 compliance (+${Math.round(CERT_PREMIUM.nsfAnsi61 * 100)}%)`,
      amount: round2(premium / 0.38),
    });
  }
  if (inputs.certs?.nsfAnsi2Required) {
    const premium = certifiedCostUsd * CERT_PREMIUM.nsfAnsi2;
    certifiedCostUsd += premium;
    certLines.push({
      key: 'nsf2',
      label: `NSF/ANSI 2 compliance (+${Math.round(CERT_PREMIUM.nsfAnsi2 * 100)}%)`,
      amount: round2(premium / 0.38),
    });
  }

  // 5. Sale price = certifiedCost ÷ 0.38 (Master Cost2!L32).
  const unitPriceRaw = certifiedCostUsd / 0.38;
  const unitPrice = round2(unitPriceRaw);

  // 6. Rep-facing buckets — group line items into the same categories the
  //    sales rep cares about (shell fab, fittings, structure, etc.).
  const grouped = groupLines(r);
  const unitLines: PricingLine[] = [];
  if (grouped.shell      > 0) unitLines.push({ key: 'shell',      label: 'Shell fabrication & layup', amount: round2(grouped.shell      / 0.38) });
  if (grouped.fittings   > 0) unitLines.push({ key: 'fittings',   label: 'Nozzles, manway & fittings',amount: round2(grouped.fittings   / 0.38) });
  if (grouped.structure  > 0) unitLines.push({ key: 'structure',  label: 'Stand / saddles / lugs',    amount: round2(grouped.structure  / 0.38) });
  if (grouped.finishing  > 0) unitLines.push({ key: 'finishing',  label: 'Finishing & seam work',     amount: round2(grouped.finishing  / 0.38) });
  if (grouped.tests      > 0) unitLines.push({ key: 'tests',      label: 'Hydrotest, post-cure, QA',  amount: round2(grouped.tests      / 0.38) });
  if (grouped.options    > 0) unitLines.push({ key: 'options',    label: 'Options & extras',          amount: round2(grouped.options    / 0.38) });
  for (const cl of certLines) unitLines.push(cl);

  const extendedPrice = round2(unitPrice * quantity);
  const totalDelivered = round2(extendedPrice + DEFAULT_FREIGHT_USD);

  return {
    unitPrice,
    unitLines,
    quantity,
    extendedPrice,
    freight: DEFAULT_FREIGHT_USD,
    totalDelivered,
    detail: {
      laborAmountUsd:        round2(r.laborAmountUsd),
      materialAmountUsd:     round2(r.materialAmountUsd),
      grandTankCostUsd:      round2(certifiedCostUsd),
      salesUpliftUsd:        round2(unitPrice - certifiedCostUsd),
      laborHoursAdjusted:    r.adjustedLaborHrs,
      totalAdjustedLaborHrs: round2(r.totalAdjustedLaborHrs),
      resinPricePerLb,
      lineItems: r.lineCosts.map(({ line, cost }) => ({
        key: line.key,
        label: line.label,
        group: line.group,
        laborHrs:    round2(cost.laborHrs),
        laborUsd:    round2(cost.laborUsd),
        materialUsd: round2(cost.materialUsd),
        totalUsd:    round2(cost.totalUsd),
      })),
    },
  };
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function groupLines(r: JobCalcRollup) {
  const out = { shell: 0, fittings: 0, structure: 0, finishing: 0, tests: 0, options: 0 };
  for (const { line, cost } of r.lineCosts) {
    const g = line.group ?? 'options';
    out[g as keyof typeof out] += cost.totalUsd;
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
