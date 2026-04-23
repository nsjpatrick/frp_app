import { SEED_RESINS } from '@/lib/catalog/seed-data';

/**
 * V0 pricing engine.
 *
 * Pure function: takes the configurator state and returns a full pricing
 * breakdown. The goal is twofold — give the rep a number that moves
 * sensibly when they edit quantity / size / certs, and provide a single
 * seam the real pricing engine will plug into later (swap the body,
 * keep the shape).
 *
 * Model (rough, calibrated against a handful of recent PTI quotes):
 *   unit = base + size + resin + accessories + cert + orientation + postCure
 *   extended = unit × quantity
 *   totalDelivered = extended + freight
 *
 * Size scaling is linear on cylindrical capacity (gal), with a floor so
 * small vessels don't drop below tooling+minimum-charge territory.
 */

export type PricingInputs = {
  geometry: {
    orientation?: 'vertical' | 'horizontal' | string | null;
    idIn?: number | null;
    ssHeightIn?: number | null;
    nozzles?: Array<{ quantity?: number | null }>;
    baffles?: boolean;
    baffleCount?: number | null;
    stainlessStand?: boolean;
    stainlessGrade?: string | null;
    quantity?: number | null;
  };
  service: {
    postCure?: boolean;
  };
  certs: {
    asmeRtp1Class?: 'I' | 'II' | 'III' | null | string;
    nsfAnsi61Required?: boolean;
    nsfAnsi2Required?: boolean;
    thirdPartyInspector?: 'NONE' | 'TUV' | 'LLOYDS' | 'INTERTEK' | null | string;
  };
  wallBuildup: {
    resinId?: string | null;
  };
};

export type PricingLine = {
  /** Machine-readable key so display code can inspect / filter. */
  key: string;
  label: string;
  amount: number;
};

export type PricingBreakdown = {
  /** Per-vessel price. */
  unitPrice: number;
  /** Per-vessel lines that roll up to `unitPrice`. */
  unitLines: PricingLine[];
  /** Number of vessels on this quote. */
  quantity: number;
  /** unitPrice × quantity */
  extendedPrice: number;
  /** Fixed freight line, F.O.B. Fairfield. */
  freight: number;
  /** extendedPrice + freight. This is what the rep quotes. */
  totalDelivered: number;
};

const BASE_FLOOR         = 24_000;   // Tooling + minimum-charge floor.
const PRICE_PER_GALLON   = 2.00;     // Size scaling on cylindrical volume.
const GAL_CYL_CONSTANT   = Math.PI;  // For volume = π·r²·h (in³), ÷ 231 gal.

const NOZZLE_UNIT_COST   = 800;
const BAFFLE_UNIT_COST   = 2_500;
const SS_STAND_COST      = 4_500;

const FREIGHT            = 1_600;

const RESIN_WEIGHT_PRICE_LB_SCALE = 220; // Calibrated so Derakane 411 ($2.85/lb) lands near the legacy mock.

const CERT_MULTIPLIER: Record<string, number> = {
  I:   1.05,
  II:  1.10,
  III: 1.20,
};

function approxGallons(idIn: number | null | undefined, ssHeightIn: number | null | undefined): number {
  if (!idIn || !ssHeightIn) return 0;
  const volInCubed = GAL_CYL_CONSTANT * (idIn / 2) ** 2 * ssHeightIn;
  return volInCubed / 231;
}

export function computePricing(inputs: PricingInputs): PricingBreakdown {
  const { geometry, service, certs, wallBuildup } = inputs;

  const quantity = Math.max(1, Math.floor(Number(geometry.quantity) || 1));
  const gal = approxGallons(geometry.idIn, geometry.ssHeightIn);

  // --- Per-vessel breakdown -----------------------------------------------
  const unitLines: PricingLine[] = [];

  // Base + size-driven materials & labor.
  const baseAndSize = Math.max(BASE_FLOOR, BASE_FLOOR + gal * PRICE_PER_GALLON);
  unitLines.push({
    key: 'base_size',
    label:
      gal > 0
        ? `Materials & fabrication (≈ ${Math.round(gal).toLocaleString('en-US')} gal)`
        : 'Materials & fabrication (minimum)',
    amount: round2(baseAndSize),
  });

  // Resin premium: compatible with Derakane 411-350 as the baseline — more
  // expensive resins (novolacs, chlorendics) bump the unit price. Ignores
  // selection when we can't find the resin — keeps the engine resilient.
  const resin = wallBuildup.resinId
    ? SEED_RESINS.find((r) => r.id === wallBuildup.resinId)
    : null;
  if (resin) {
    const baselineResinCost = 2.85 * RESIN_WEIGHT_PRICE_LB_SCALE; // Derakane 411-350 @ $2.85/lb
    const thisResinCost     = resin.price_per_lb * RESIN_WEIGHT_PRICE_LB_SCALE;
    const resinPremium      = thisResinCost - baselineResinCost;
    if (Math.abs(resinPremium) >= 1) {
      unitLines.push({
        key: 'resin_premium',
        label: `Resin premium (${resin.name})`,
        amount: round2(resinPremium),
      });
    }
  }

  // Accessories: nozzles, baffles, stand.
  const nozzleCount = Array.isArray(geometry.nozzles)
    ? geometry.nozzles.reduce((n, x) => n + (Number(x?.quantity) || 0), 0)
    : 0;
  if (nozzleCount > 0) {
    unitLines.push({
      key: 'nozzles',
      label: `Nozzles & connections (${nozzleCount})`,
      amount: nozzleCount * NOZZLE_UNIT_COST,
    });
  }
  if (geometry.baffles && (geometry.baffleCount ?? 0) > 0) {
    unitLines.push({
      key: 'baffles',
      label: `Baffles (${geometry.baffleCount})`,
      amount: (geometry.baffleCount ?? 0) * BAFFLE_UNIT_COST,
    });
  }
  if (geometry.stainlessStand) {
    unitLines.push({
      key: 'ss_stand',
      label: `Stainless steel stand${geometry.stainlessGrade ? ` (${geometry.stainlessGrade.replace(/^SS/, '')})` : ''}`,
      amount: SS_STAND_COST,
    });
  }

  // Running subtotal before multiplicative adjustments.
  let subtotal = unitLines.reduce((sum, l) => sum + l.amount, 0);

  // Certification premium (multiplicative on subtotal).
  const certClass = certs.asmeRtp1Class ?? null;
  const certMult = certClass ? (CERT_MULTIPLIER[String(certClass)] ?? 1) : 1;
  if (certMult > 1) {
    const certLine = subtotal * (certMult - 1);
    unitLines.push({
      key: 'asme_rtp1',
      label: `ASME RTP-1 Class ${certClass} premium (+${Math.round((certMult - 1) * 100)}%)`,
      amount: round2(certLine),
    });
    subtotal += certLine;
  }

  // NSF 61 / NSF 2 QA premiums.
  if (certs.nsfAnsi61Required) {
    const nsf61 = subtotal * 0.03;
    unitLines.push({ key: 'nsf61', label: 'NSF/ANSI 61 compliance (+3%)', amount: round2(nsf61) });
    subtotal += nsf61;
  }
  if (certs.nsfAnsi2Required) {
    const nsf2 = subtotal * 0.02;
    unitLines.push({ key: 'nsf2', label: 'NSF/ANSI 2 compliance (+2%)', amount: round2(nsf2) });
    subtotal += nsf2;
  }

  // Horizontal orientation: adds saddles / support hardware complexity.
  if (geometry.orientation === 'horizontal') {
    const horiz = subtotal * 0.08;
    unitLines.push({ key: 'horizontal', label: 'Horizontal saddles & support (+8%)', amount: round2(horiz) });
    subtotal += horiz;
  }

  // Post-cure process.
  if (service.postCure) {
    const pc = subtotal * 0.05;
    unitLines.push({ key: 'post_cure', label: 'Post-cure process (+5%)', amount: round2(pc) });
    subtotal += pc;
  }

  // Third-party inspector bump — flat fee, doesn't compound.
  if (certs.thirdPartyInspector && certs.thirdPartyInspector !== 'NONE') {
    const fee = 3_500;
    unitLines.push({
      key: 'inspector',
      label: `Third-party inspector (${certs.thirdPartyInspector})`,
      amount: fee,
    });
    subtotal += fee;
  }

  const unitPrice = round2(subtotal);

  // --- Extended ----------------------------------------------------------
  const extendedPrice  = round2(unitPrice * quantity);
  const totalDelivered = round2(extendedPrice + FREIGHT);

  return {
    unitPrice,
    unitLines,
    quantity,
    extendedPrice,
    freight: FREIGHT,
    totalDelivered,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
