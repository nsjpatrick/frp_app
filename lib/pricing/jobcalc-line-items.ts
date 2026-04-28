/**
 * Line-item builders.
 *
 * One function per Excel "Mod" or accessory category. Each takes the wizard
 * inputs and returns zero or more `JobCalcLineItem`s so the engine can
 * roll them up. Builders that don't apply to the given inputs simply
 * return `[]`.
 *
 * The builders intentionally err on the side of producing *something* —
 * Excel's behavior is that an unconfigured option contributes nothing,
 * and an unselected option simply doesn't appear in the rollup.
 */

import {
  HYDROTEST,
  POST_CURE_LABOR_HRS_BY_CAPACITY,
  SHELL_FAB_RATIOS,
} from './jobcalc-constants';
import {
  AGITATOR_SUPPORT_TABLE,
  BAFFLE_LABOR_TABLE,
  BLIND_FLANGE_TABLE,
  BRYNEER_ADDER_PARTS,
  BRYNEER_SALT_PIPE_PASSIVATION_ADDER,
  BRYNEER_SALT_PIPE_TABLE,
  BRYNEER_SMARTBOB_PARTS,
  CHANNEL_TABLE,
  DIP_PIPE_TABLE,
  GOOSENECK_VENT_TABLE,
  HANDRAIL_COST_TABLE,
  HANDRAIL_LABOR_TABLE,
  LADDER_CAGE_COST_TABLE,
  LADDER_COST_TABLE,
  LUG_TABLE,
  MUSHROOM_VENT_TABLE,
  RING_STAND_TABLE,
  SADDLE_TABLE,
  STAINLESS_STAND_BASE_COST_USD,
  STAINLESS_STAND_LABOR_HRS_BY_GRADE,
  V_VENT_TABLE,
  VEIL_OPTIONS,
  WALKTHRU_COST_TABLE,
  findVeil,
  lookupApprox,
  lookupManway,
  lookupNozzle,
} from './jobcalc-catalog';
import type { Accessories } from '@/lib/validators/entities';
import {
  cylinderCapacityGal,
  headAreaFt2,
  nominalDiameterFt,
  shellLateralAreaFt2,
} from './jobcalc-geometry';
import { computeWallThickness } from '@/lib/rules/wall-thickness';
import { computeHtdHeaterSizing, type HtdInsulationThickness, type HtdInsulationType, type HtdSupportStyle } from './htd-engine';
import {
  emptyLine,
  type JobCalcLineItem,
} from './jobcalc-engine';

/* ── Inputs shared by all builders ──────────────────────────────────── */

export type JobCalcInputs = {
  geometry: {
    orientation?: 'vertical' | 'horizontal' | string | null;
    idIn?: number | null;
    ssHeightIn?: number | null;
    nozzles?: Array<{
      type?: string | null;
      sizeNps?: string | null;
      rating?: string | null;
      quantity?: number | null;
    }>;
    baffles?: boolean;
    baffleCount?: number | null;
    baffleType?: 'plate' | 'wedge' | string | null;
    /** Baffle length in feet. `0` / undefined = derive 90% of SS height. */
    baffleLengthFt?: number | null;
    /** Top-head shape — open_top_cover means the dome doesn't take a
     *  veil layup (the cover is bolt-on plywood). */
    topHead?: 'flat' | 'F_AND_D' | 'conical' | 'open_top_cover' | string | null;
    /** Bottom shape — drives HTD bottom-area calc (flat ring vs dished
     *  vs conical drain) and the Excel "bottom layup" line item. */
    bottom?: 'flat_ring_supported' | 'dished' | 'conical_drain' | 'sloped' | string | null;
    /** True = integral double-wall (secondary containment). Adds the
     *  Excel "Double Wall — Shell + Bottom + Joint Seams + Leak Det"
     *  line items at roughly +60% of the base shell-fab cost. */
    doubleWall?: boolean;
    /** New canonical stand field — 'none' | 'frp' | 'ss304' | 'ss316' | 'skirt'. */
    standType?: string | null;
    /** Legacy fields — preserved on persisted revisions saved before the
     *  standType refactor. The pricing engine reads `standType` first
     *  and only falls back to these. */
    stainlessStand?: boolean;
    stainlessGrade?: string | null;
    quantity?: number | null;
    /** Full accessory bundle from Step 2's AccessoriesSection. */
    accessories?: Partial<Accessories> | null;
  };
  service: {
    postCure?: boolean;
    specificGravity?: number | null;
    operatingPressurePsig?: number | null;
    operatingTempF?: number | null;
    designTempF?: number | null;
    /** Worst-case minimum ambient (°F). Drives the HTD ΔT for the
     *  Plastatherm heater sizing. */
    minAmbientTempF?: number | null;
  };
  certs: {
    asmeRtp1Class?: 'I' | 'II' | 'III' | null | string;
    nsfAnsi61Required?: boolean;
    nsfAnsi2Required?: boolean;
    thirdPartyInspector?: 'NONE' | 'TUV' | 'LLOYDS' | 'INTERTEK' | null | string;
  };
  wallBuildup: {
    resinId?: string | null;
    /** Surface veil id from `VEIL_OPTIONS` (e.g. `c_glass_1`,
     *  `carbon_2`). Drives the veil line-item builder. */
    veilId?: string | null;
  };
};

/* ── Shell fabrication (Labor!650:658 + 673:674) ────────────────────── */

/**
 * Produces three line items: corrosion barrier (chop+resin), structural
 * winding (uni + woven roving + winding glass), and top/bottom heads.
 *
 * Wall thickness comes from the existing wall-thickness rules engine; if
 * required service inputs are missing we fall back to a 0.25" min shell
 * + 0.30" head (Excel's RTP-1 Part 3B Table 3B-1 minimums).
 */
export function buildShellFabLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const { idIn, ssHeightIn } = inp.geometry;
  if (!idIn || !ssHeightIn) return [];

  // Wall thickness — needs service inputs. Fall back to RTP-1 minimums when
  // they're missing (early in the wizard before Step 1 is filled in).
  let shellThicknessIn = 0.25;
  let headThicknessIn  = 0.30;
  if (inp.service.specificGravity && inp.service.operatingPressurePsig != null) {
    const wt = computeWallThickness({
      geometry: { idIn, ssHeightIn },
      service: {
        specificGravity: inp.service.specificGravity,
        operatingPressurePsig: inp.service.operatingPressurePsig,
      },
    } as Parameters<typeof computeWallThickness>[0]);
    shellThicknessIn = wt.shellThicknessIn;
    headThicknessIn  = wt.headThicknessIn;
  }

  const shellArea = shellLateralAreaFt2(idIn, ssHeightIn);
  const headArea  = headAreaFt2(idIn);

  // Corrosion barrier — first ~0.10" of the shell is chop+resin (Excel
  // hard-codes choplayerthickness = 0.10").
  const cbThicknessIn = Math.min(0.10, shellThicknessIn * 0.4);
  const cbChop  = shellArea * SHELL_FAB_RATIOS.chopLbsPerSqftPerInch    * cbThicknessIn;
  const cbResin = shellArea * SHELL_FAB_RATIOS.resinLbsPerSqftPerInchCB * cbThicknessIn;

  // Structural winding — remainder is filament-wound (winding + uni glass).
  const structThicknessIn = Math.max(0, shellThicknessIn - cbThicknessIn);
  const windingLb = shellArea * structThicknessIn * 7.0;        // ~7 lb/sqft/inch (50/50 glass:resin by wt)
  const uniLb     = shellArea * structThicknessIn * 1.5;        // hoop+axial unidirectional reinforcement
  const structResinLb = shellArea * structThicknessIn * SHELL_FAB_RATIOS.resinLbsPerSqftPerInchCB * 0.6;

  // Labor: rule of thumb from Excel's labor-per-ply tables — about
  // 2.0 hours of shell-fab per ply, plus an irreducible 12-hr setup.
  const numPlies = Math.ceil(structThicknessIn / SHELL_FAB_RATIOS.windingPlyThicknessIn);
  const shellFabHrs = 12 + numPlies * 2.0;
  const finishingHrs = 6 + (idIn / 12) * 0.4;

  const cb: JobCalcLineItem = {
    ...emptyLine('shell_fab_cb', 'Corrosion-barrier layup', 'shellFab', 'shell'),
    shellFabHrs:  numPlies * 0.5 + 4,
    choppedLb: cbChop,
    resinLb:   cbResin,
  };

  const struct: JobCalcLineItem = {
    ...emptyLine('shell_fab_winding', 'Structural filament winding', 'shellFab', 'shell'),
    shellFabHrs,
    finishingHrs,
    windingLb,
    uniLb,
    resinLb: structResinLb,
  };

  // Heads — flat top + dished bottom per Excel rows 673 & 674 (top/bottom
  // construction). For V1 we apply the same per-sqft model, just twice
  // (one head each). Real engineering picks specific layups; that hooks
  // into Plan 7's head-type selector.
  const headChopLb  = headArea * SHELL_FAB_RATIOS.chopLbsPerSqftPerInch    * headThicknessIn * 2;
  const headResinLb = headArea * SHELL_FAB_RATIOS.resinLbsPerSqftPerInchBot * headThicknessIn * 2;
  const heads: JobCalcLineItem = {
    ...emptyLine('shell_fab_heads', 'Top + bottom heads', 'shellFab', 'shell'),
    shellFabHrs: 18,
    finishingHrs: 4,
    choppedLb: headChopLb,
    resinLb:   headResinLb,
  };

  return [cb, struct, heads];
}

/* ── Nozzles (Labor!748:767 + Accessories!B19:Z39) ──────────────────── */

export function buildNozzleLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const list = inp.geometry.nozzles ?? [];
  const lines: JobCalcLineItem[] = [];
  for (const n of list) {
    const qty = Number(n?.quantity) || 0;
    if (qty <= 0) continue;
    const row = lookupNozzle(n?.sizeNps ?? null);
    if (!row) continue;
    const ratingMult = n.rating === '300#' ? 1.25 : 1.0;
    lines.push({
      ...emptyLine(
        `nozzle:${row.npsIn}_${n.type ?? 'misc'}_${n.rating ?? '150'}`,
        `${n.type ?? 'Nozzle'} ${row.npsIn}" ${n.rating ?? '150#'} (×${qty})`,
        'fittings',
        'fittings',
      ),
      shellFabHrs: row.makeHrs * qty,
      fittingsHrs: row.installHrs * qty,
      buyoutsUsd:  row.costUsd * qty * ratingMult,
    });
  }
  return lines;
}

/* ── Manway / cover (Accessories!B71:V76) ──────────────────────────── */

export function buildManwayLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const m = inp.geometry.accessories?.manway;
  if (!m || m.type === 'none') return [];
  const row = lookupManway(m.diameterIn ?? 24);
  if (!row) return [];
  const variant =
    m.type === 'top_hinged' ? row.topHinged :
    m.type === 'top_flanged' ? row.topFlanged :
    row.sideFlanged;
  const rtp1Surcharge = m.rtp1Style ? 1.15 : 1.0;
  const labelType =
    m.type === 'top_hinged' ? 'top-hinged' :
    m.type === 'top_flanged' ? 'top-flanged' :
    'side-flanged';
  return [{
    ...emptyLine(`manway:${row.diameterIn}_${m.type}`, `Manway ${row.diameterIn}" ${labelType}`, 'fittings', 'fittings'),
    shellFabHrs: variant.makeHrs * rtp1Surcharge,
    fittingsHrs: variant.installHrs * rtp1Surcharge,
    buyoutsUsd:  variant.costUsd * rtp1Surcharge,
  }];
}

/* ── Baffles (Labor!789 + Accessories!B96:E102) ─────────────────────── */

export function buildBaffleLines(inp: JobCalcInputs): JobCalcLineItem[] {
  if (!inp.geometry.baffles) return [];
  const count = Math.max(0, Number(inp.geometry.baffleCount) || 0);
  if (count <= 0) return [];
  const dFt = nominalDiameterFt(inp.geometry.idIn ?? 0);
  const row = lookupApprox(BAFFLE_LABOR_TABLE, 'diameterFt', dFt);
  if (!row) return [];

  // Resolve baffle length: explicit override or auto-derive 90% of SS
  // height (jobcalc convention — baffles stop ~10% above the bottom so
  // liquid can sweep underneath).
  const ssHeightFt = (inp.geometry.ssHeightIn ?? 0) / 12;
  const lengthFt = (inp.geometry.baffleLengthFt && inp.geometry.baffleLengthFt > 0)
    ? Number(inp.geometry.baffleLengthFt)
    : ssHeightFt * 0.9;

  // Excel applies layup + 4 gussets/baffle + a single cut-out batch.
  // Layup hrs scale roughly linearly with baffle length — a 12-ft tank's
  // baffle takes ~3× the labor of a 4-ft tank's. Use the lookup's base
  // rate for a "tall" tank (ssHeight ~ 12 ft) and prorate.
  const lengthMult = ssHeightFt > 0 ? lengthFt / Math.max(ssHeightFt, 1) : 1;
  const perBaffleHrs = (row.layupHrs * lengthMult) + row.gussetHrs * 4;
  // Material: each baffle is roughly 0.4" × (width × length) of FRP.
  // Width ≈ 60% of diameter (Excel platebaffles convention).
  const baffleArea = dFt * 0.6 * lengthFt * count;
  return [{
    ...emptyLine('baffles', `Mixing baffles (${count} × ${lengthFt.toFixed(1)}' long)`, 'finishing', 'fittings'),
    shellFabHrs: perBaffleHrs * count + row.cutOutHrs,
    choppedLb: baffleArea * 0.4 * SHELL_FAB_RATIOS.chopLbsPerSqftPerInch,
    resinLb:   baffleArea * 0.4 * SHELL_FAB_RATIOS.resinLbsPerSqftPerInchCB,
  }];
}

/* ── Stainless-steel stand (composite — Labor!690:694) ─────────────── */

export function buildStainlessStandLines(inp: JobCalcInputs): JobCalcLineItem[] {
  // Resolve standType — prefer the new canonical field, fall back to
  // the legacy stainlessStand+stainlessGrade pair so quotes saved
  // before the refactor still price correctly.
  const explicit = inp.geometry.standType;
  let kind: 'none' | 'frp' | 'ss304' | 'ss316' | 'skirt';
  if (explicit && ['none', 'frp', 'ss304', 'ss316', 'skirt'].includes(explicit)) {
    kind = explicit as typeof kind;
  } else if (inp.geometry.stainlessStand) {
    const g = inp.geometry.stainlessGrade ?? 'SS304';
    kind = (g === 'SS316' || g === 'SS316L') ? 'ss316' : 'ss304';
  } else {
    kind = 'none';
  }
  if (kind === 'none') return [];

  // FRP skirt is a fabricated layup — labor on the shell-fab side, no
  // SS buyout. Stainless leg-stands are mostly buyout cost + fittings
  // labor for the bolt-up.
  if (kind === 'frp') {
    return [{
      ...emptyLine('stand_frp', 'FRP leg-stand (fabricated)', 'shellFab', 'structure'),
      shellFabHrs: 14,
      finishingHrs: 4,
      resinLb:    35,
      choppedLb:  20,
      buyoutsUsd: 250, // hardware + brackets
    }];
  }
  if (kind === 'skirt') {
    const idFt = (inp.geometry.idIn ?? 0) / 12;
    const skirtHeightFt = 1.5;
    const sqft = Math.PI * idFt * skirtHeightFt;
    return [{
      ...emptyLine('stand_skirt', 'FRP skirt (with 24" pipe stub)', 'shellFab', 'structure'),
      shellFabHrs: 6 + sqft * 0.4,
      finishingHrs: 2,
      resinLb:    sqft * 1.8,
      choppedLb:  sqft * 0.7,
      buyoutsUsd: 150,
    }];
  }
  // Stainless 304 / 316
  const grade = kind === 'ss304' ? 'SS304' : 'SS316';
  const fabHrs = STAINLESS_STAND_LABOR_HRS_BY_GRADE[grade] ?? STAINLESS_STAND_LABOR_HRS_BY_GRADE.SS304;
  const displayGrade = kind === 'ss304' ? 'SS 304' : 'SS 316';
  return [{
    ...emptyLine(`stand_${kind}`, `Stainless steel stand (${displayGrade})`, 'fittingsHot', 'structure'),
    shellFabHrs: 2,
    fittingsHrs: fabHrs,
    buyoutsUsd:  STAINLESS_STAND_BASE_COST_USD * (kind === 'ss316' ? 1.12 : 1.0),
  }];
}

/* ── Horizontal saddles (Labor!796) ─────────────────────────────────── */

export function buildHorizontalSaddleLines(inp: JobCalcInputs): JobCalcLineItem[] {
  if (inp.geometry.orientation !== 'horizontal') return [];
  const dFt = nominalDiameterFt(inp.geometry.idIn ?? 0);
  const row = lookupApprox(SADDLE_TABLE, 'diameterFt', dFt);
  if (!row) return [];
  return [{
    ...emptyLine('saddles_horiz', `Horizontal vessel wood saddles (${dFt}' dia.)`, 'fittingsHot', 'structure'),
    shellFabHrs: 6,
    fittingsHrs: 4,
    buyoutsUsd:  row.woodCostUsd * 2, // pair of saddles
  }];
}

/* ── Ring stand fit-up (Labor!690:694, Accessories!B156:F182) ───────── */

// A ring stand is the "ring" the tank rests on. Always present for
// vertical tanks unless a stainless stand was configured.
export function buildRingStandLines(inp: JobCalcInputs): JobCalcLineItem[] {
  if (inp.geometry.orientation === 'horizontal') return [];
  // Skip ring-stand if a discrete stand was chosen — the leg-stand /
  // skirt replaces it.
  const std = inp.geometry.standType ?? (inp.geometry.stainlessStand ? 'ss304' : 'none');
  if (std !== 'none') return [];
  const dFt = nominalDiameterFt(inp.geometry.idIn ?? 0);
  if (dFt < 2) return [];
  const row = lookupApprox(RING_STAND_TABLE, 'diameterFt', dFt);
  if (!row) return [];
  return [{
    ...emptyLine('ring_stand', `FRP ring stand (${dFt}' dia.)`, 'fittingsHot', 'structure'),
    shellFabHrs: row.fitupHrs + row.shearCollarHrs + row.wearPadHrs,
    fittingsHrs: row.supportStopsHrs,
    // Materials are approximated as 50 lbs of resin + chop + fasteners.
    buyoutsUsd: 80,
    resinLb:   30,
    choppedLb: 20,
  }];
}

/* ── Hydrotest (Labor!596:598) ─────────────────────────────────────── */

// Excel does this conditionally on Quote2!I7. We always produce a $0 line
// when un-set so the rollup stays uniform; it costs zero unless the rep
// flips the toggle later.
export function buildHydrotestLines(_inp: JobCalcInputs): JobCalcLineItem[] {
  return [];
}

/* ── Post-cure (Labor!596 col J + Accessories!B107:D117) ────────────── */

export function buildPostCureLines(inp: JobCalcInputs): JobCalcLineItem[] {
  if (!inp.service.postCure) return [];
  const gal = cylinderCapacityGal(inp.geometry.idIn ?? 0, inp.geometry.ssHeightIn ?? 0);
  const row = lookupApprox(POST_CURE_LABOR_HRS_BY_CAPACITY, 'minGal', gal);
  const hrs = row?.hrs ?? 30;
  // Each 100-lb propane cylinder is around $50; a large tank uses ~5 hrs.
  const propaneCost = Math.max(50, Math.min(300, gal / 200) * 50);
  return [{
    ...emptyLine('post_cure', 'Post-cure (thermal)', 'flat', 'tests'),
    finishingHrs: hrs,
    buyoutsUsd:   propaneCost,
  }];
}

/* ── Certifications: ASME RTP-1, NSF/ANSI, third-party inspector ─────── */

// Excel embeds these in line-item labor hours (rtp1Laminate, nozzle_rtp1_labor).
// For V1 we model them as a labor-only premium line item proportional to the
// rest of the labor amount — same model as the V0 engine, but expressed
// through the line-item structure so the rollup stays consistent.
export function buildCertificationLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const lines: JobCalcLineItem[] = [];

  if (inp.certs.thirdPartyInspector && inp.certs.thirdPartyInspector !== 'NONE') {
    lines.push({
      ...emptyLine(
        `inspector:${inp.certs.thirdPartyInspector}`,
        `Third-party inspector (${inp.certs.thirdPartyInspector})`,
        'flat',
        'tests',
      ),
      buyoutsUsd: 3_500,
    });
  }
  return lines;
}

// RTP-1 + NSF premiums are best modeled as multipliers on the combined
// shell + fittings cost since they affect QA across the whole vessel. The
// engine post-processes them in `pricing-engine.ts` rather than emitting
// fake line items here.

/* ── Misc / freight indirect labor (Hydrotest!C598 — example) ──────── */

// Indirect labor for blocking off fittings during hydro/post-cure, etc.
export function buildIndirectLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const ssFt = (inp.geometry.ssHeightIn ?? 0) / 12;
  if (ssFt <= 0) return [];
  const hrs = ssFt <= 15
    ? HYDROTEST.indirectLaborHrsShort
    : HYDROTEST.indirectLaborHrsTall;
  return [{
    ...emptyLine('indirect', 'Indirect labor (blocking, prep, QA)', 'flat'),
    indirectHrs: hrs,
  }];
}

/* ── Vents (Accessories!B46:R65) ────────────────────────────────────── */

export function buildVentLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const vents = inp.geometry.accessories?.vents ?? [];
  const lines: JobCalcLineItem[] = [];
  for (const v of vents) {
    const qty = Math.max(0, Number(v?.quantity) || 0);
    if (qty <= 0) continue;
    const table =
      v.kind === 'gooseneck' ? GOOSENECK_VENT_TABLE :
      v.kind === 'mushroom'  ? MUSHROOM_VENT_TABLE  :
      V_VENT_TABLE;
    const row = lookupApprox(table, 'npsIn', Number(v.sizeIn) || 0);
    if (!row) continue;
    const kindLabel =
      v.kind === 'gooseneck' ? 'Gooseneck'  :
      v.kind === 'mushroom'  ? 'Mushroom'   :
      '“V”';
    lines.push({
      ...emptyLine(
        `vent:${v.kind}_${row.npsIn}`,
        `${kindLabel} vent ${row.npsIn}" (×${qty})`,
        'fittings',
        'fittings',
      ),
      shellFabHrs: row.makeHrs   * qty,
      fittingsHrs: row.installHrs * qty,
      buyoutsUsd:  row.costUsd   * qty,
    });
  }
  return lines;
}

/* ── Blind flanges (Accessories!B83:H89) ────────────────────────────── */

export function buildBlindFlangeLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const list = inp.geometry.accessories?.blindFlanges ?? [];
  const lines: JobCalcLineItem[] = [];
  for (const b of list) {
    const qty = Math.max(0, Number(b?.quantity) || 0);
    if (qty <= 0) continue;
    const row = lookupApprox(BLIND_FLANGE_TABLE, 'diameterIn', Number(b.diameterIn) || 0);
    if (!row) continue;
    const cost = b.material === 'pvc' ? row.pvcCostUsd : row.frpCostUsd;
    lines.push({
      ...emptyLine(
        `blindflange:${row.diameterIn}_${b.material}`,
        `Blind flange ${row.diameterIn}" ${b.material.toUpperCase()} (×${qty})`,
        'fittings',
        'fittings',
      ),
      shellFabHrs: row.makeHrs * qty,
      buyoutsUsd:  cost * qty,
    });
  }
  return lines;
}

/* ── Dip pipes (Accessories!J83:K88, Raw Materials!B504:D509) ───────── */

export function buildDipPipeLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const list = inp.geometry.accessories?.dipPipes ?? [];
  const lines: JobCalcLineItem[] = [];
  list.forEach((d, idx) => {
    if (!d?.diameterIn || !d?.lengthIn) return;
    const row = lookupApprox(DIP_PIPE_TABLE, 'diameterIn', Number(d.diameterIn) || 0);
    if (!row) return;
    const lengthFt = (Number(d.lengthIn) || 0) / 12;
    lines.push({
      ...emptyLine(
        `dippipe:${idx}_${row.diameterIn}`,
        `Dip pipe ${row.diameterIn}" × ${Math.round(d.lengthIn ?? 0)}"`,
        'fittings',
        'fittings',
      ),
      fittingsHrs: row.makeHrs + lengthFt * 0.25,
      buyoutsUsd:  lengthFt * row.costPerFtUsd,
    });
  });
  return lines;
}

/* ── Tie-down lugs (Raw Materials!B119:J124 + encapsulation labor) ──── */

export function buildLugLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const lugs = inp.geometry.accessories?.tieDownLugs;
  if (!lugs || !lugs.enabled || (lugs.quantity ?? 0) <= 0) return [];
  const row = lookupApprox(LUG_TABLE, 'ratingLb', Number(lugs.ratingLb) || 0);
  if (!row) return [];
  const grade = lugs.grade ?? 'ss304';
  const cost =
    grade === 'zinc_plated_steel' ? row.zincSteel :
    grade === 'ss304'              ? row.ss304     :
    grade === 'ss316'              ? row.ss316     :
    row.titanium;
  // Encapsulation = ~1.5 hrs of shell-fab labor per lug (Labor!A201).
  const encapHrs = lugs.encapsulated ? 1.5 * lugs.quantity : 0;
  return [{
    ...emptyLine(
      `lugs:${row.ratingLb}_${grade}`,
      `Tie-down lugs ${row.ratingLb.toLocaleString()} lb ${grade.replace(/_/g, ' ')} (×${lugs.quantity})`,
      'fittingsHot',
      'structure',
    ),
    shellFabHrs: encapHrs,
    fittingsHrs: lugs.quantity * 0.5,
    buyoutsUsd:  cost * lugs.quantity,
  }];
}

/* ── Lifting channels (Raw Materials!B130:N136) ────────────────────── */

export function buildLiftingChannelLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const ch = inp.geometry.accessories?.liftingChannels;
  if (!ch || !ch.enabled || (ch.quantity ?? 0) <= 0) return [];
  const row = lookupApprox(CHANNEL_TABLE, 'capacityLb', 6_000);
  if (!row) return [];
  const grade = ch.grade ?? 'zinc_plated_steel';
  const cost =
    grade === 'zinc_plated_steel' ? row.zincPlatedSteel :
    grade === 'ss304'              ? row.ss304          :
    grade === 'ss316'              ? row.ss316          :
    row.titanium;
  const encapHrs = ch.encapsulated ? 1.5 * ch.quantity : 0;
  return [{
    ...emptyLine(
      `lifting_channels:${grade}`,
      `Lifting channels ${grade.replace(/_/g, ' ')} (×${ch.quantity})`,
      'fittingsHot',
      'structure',
    ),
    shellFabHrs: encapHrs + ch.quantity * 1.0,
    buyoutsUsd:  cost * ch.quantity,
  }];
}

/* ── Ladder + cage + walk-thru (Raw Materials!B182:Z232 etc.) ────────── */

export function buildLadderLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const ladder = inp.geometry.accessories?.ladder;
  if (!ladder || ladder.type === 'none') return [];

  const ladderLengthFt = Math.max(6, Math.round(((inp.geometry.ssHeightIn ?? 144) / 12)));
  const costRow  = lookupApprox(LADDER_COST_TABLE, 'ladderLengthFt', ladderLengthFt);
  if (!costRow) return [];

  const grade =
    ladder.type === 'frp'              ? 'frp'      :
    ladder.type === 'aluminum'         ? 'aluminum' :
    'steel';
  const cost = costRow[grade];
  const outdoorMult = ladder.location === 'outdoor' ? 1.05 : 1.0;
  // Walk-thru / roof-turn each add ~$650 (Raw Materials!B297:V300, walkthru
  // straight pricing). We charge them as buyout addons.
  let extra = 0;
  if (ladder.walkthru) {
    const wt = lookupApprox(WALKTHRU_COST_TABLE, 'diameterFt', (inp.geometry.idIn ?? 0) / 12);
    if (wt) extra += wt[grade];
  }
  if (ladder.roofturn) {
    extra += grade === 'frp' ? 0 : grade === 'aluminum' ? 690 : 530;
  }
  // Cage: separate buyout from LADDER_CAGE_COST_TABLE.
  let cageCost = 0;
  if (ladder.cage) {
    const cageRow = lookupApprox(LADDER_CAGE_COST_TABLE, 'ladderLengthFt', ladderLengthFt);
    if (cageRow) cageCost = cageRow[grade];
  }
  const installHrs = grade === 'frp' ? 4 + ladderLengthFt * 0.4 : 4 + ladderLengthFt * 0.3;
  return [{
    ...emptyLine(
      `ladder:${grade}_${ladderLengthFt}ft`,
      `${grade.replace(/^./, c => c.toUpperCase())} ladder ${ladderLengthFt}'${ladder.cage ? ' + cage' : ''}${ladder.walkthru ? ' + walk-thru' : ''}`,
      'fittings',
      'structure',
    ),
    shellFabHrs: ladder.cage ? 2 : 0,
    fittingsHrs: installHrs,
    buyoutsUsd:  (cost + cageCost + extra) * outdoorMult,
  }];
}

/* ── Handrails (Raw Materials!B311 + Accessories!B187:E210) ─────────── */

export function buildHandrailLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const h = inp.geometry.accessories?.handrail;
  if (!h || h.type === 'none') return [];
  const dFt = Math.max(0, Math.round(((inp.geometry.idIn ?? 0) / 12) * 2) / 2);
  const laborRow = lookupApprox(HANDRAIL_LABOR_TABLE, 'diameterFt', dFt);
  const costRow  = lookupApprox(HANDRAIL_COST_TABLE,  'diameterFt', dFt);
  if (!laborRow || !costRow) return [];

  const installHrs =
    h.type === 'frp' || h.type === 'frp_3rail' ? laborRow.frpInstallHrs :
    h.type === 'aluminum'                       ? laborRow.aluminumInstallHrs :
    laborRow.steelInstallHrs;
  const cost =
    h.type === 'frp'        ? costRow.frp      :
    h.type === 'frp_3rail'  ? costRow.frp3rail :
    h.type === 'aluminum'   ? costRow.aluminum :
    costRow.steel;
  const gateAdder = h.selfCloseGate ? 350 : 0;
  return [{
    ...emptyLine(
      `handrail:${h.type}_${dFt}ft`,
      `${h.type === 'frp_3rail' ? 'FRP 3-rail' : h.type[0].toUpperCase() + h.type.slice(1)} handrail ${dFt}' dia.`,
      'fittingsHot',
      'structure',
    ),
    shellFabHrs: 4, // 4 hrs assembly/disassembly per Excel (Labor!H194)
    fittingsHrs: installHrs,
    buyoutsUsd:  cost + gateAdder,
  }];
}

/* ── Rest platform / Saf-T-Climb ────────────────────────────────────── */

export function buildAccessLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const lines: JobCalcLineItem[] = [];
  const a = inp.geometry.accessories;
  if (!a) return lines;

  if (a.restPlatform) {
    lines.push({
      ...emptyLine('rest_platform', 'Intermediate rest platform 4×4', 'fittingsHot', 'structure'),
      fittingsHrs: 6,
      buyoutsUsd:  1_000, // Labor!E816 & I816 — $1,000 platform buyout
    });
  }
  if (a.safTClimb && a.safTClimb !== 'none') {
    const ssFt = (inp.geometry.ssHeightIn ?? 0) / 12;
    lines.push({
      ...emptyLine('saf_t_climb', `Saf-T-Climb fall preventer (${a.safTClimb})`, 'fittings', 'structure'),
      fittingsHrs: 4 + ssFt * 0.2,
      buyoutsUsd:  150 + ssFt * 35 + (a.safTClimb === 'with_cage' ? 600 : 0),
    });
  }
  return lines;
}

/* ── Agitator support (Raw Materials!B340:C350 etc.) ─────────────────── */

export function buildAgitatorSupportLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const ag = inp.geometry.accessories?.agitatorSupport;
  if (!ag || !ag.enabled) return [];
  const dFt = Math.max(2, Math.round(((inp.geometry.idIn ?? 0) / 12) * 2) / 2);
  const row = lookupApprox(AGITATOR_SUPPORT_TABLE, 'diameterFt', dFt);
  if (!row) return [];
  const dishMult = inp.geometry.accessories?.splitHingedTopCover ? 1.5 : 1.0;
  const encapHrs = ag.encapsulated ? 4 * 1.5 : 0;
  return [{
    ...emptyLine(
      `agitator_support_${dFt}ft`,
      `Steel agitator support (${dFt}' dia.)`,
      'fittingsHot',
      'fittings',
    ),
    shellFabHrs: encapHrs,
    fittingsHrs: row.flatLaborHrs * dishMult,
    buyoutsUsd:  row.costUsd * dishMult,
  }];
}

/* ── Mixer pad + sight glass + nameplate + vent tags + clips ────────── */

export function buildMiscLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const a = inp.geometry.accessories;
  if (!a) return [];
  const out: JobCalcLineItem[] = [];

  if (a.mixerPad) {
    out.push({
      ...emptyLine('mixer_pad', 'Mixer pad reinforcement', 'finishing', 'fittings'),
      finishingHrs: 2,
      buyoutsUsd:   25,
    });
  }
  if (a.sightGlass?.enabled) {
    const sz = a.sightGlass.sizeIn ?? 1;
    // Materials cost from Raw Materials!H470 (1" $93, 2" $290, 3" $690).
    const matCost = sz <= 1 ? 93 : sz <= 2 ? 290 : 690;
    out.push({
      ...emptyLine(`sight_glass_${sz}in`, `Sight glass ${sz}" (encapsulated)`, 'fittings', 'fittings'),
      shellFabHrs: 1,
      fittingsHrs: 3,
      buyoutsUsd:  matCost,
    });
  }
  if (a.splitHingedTopCover) {
    const dFt = (inp.geometry.idIn ?? 0) / 12;
    out.push({
      ...emptyLine('split_hinged_top', 'Split / hinged top cover', 'finishing', 'fittings'),
      finishingHrs: 1 + Math.max(0, dFt - 4) * 0.5,
      buyoutsUsd:   50, // piano hinge from Labor!H185
    });
  }
  if (a.nameplate) {
    out.push({ ...emptyLine('nameplate', 'FRP encapsulated nameplate', 'flat', 'fittings'), fittingsHrs: 1 });
  }
  if (a.ventTags) {
    out.push({ ...emptyLine('vent_tags', 'Vent tags', 'flat', 'fittings'), fittingsHrs: 1 });
  }
  if ((a.pipeSupportClips ?? 0) > 0) {
    const n = a.pipeSupportClips ?? 0;
    out.push({
      ...emptyLine('pipe_support_clips', `Pipe support clips (${n})`, 'finishing', 'fittings'),
      finishingHrs: 1.25 * n,
      buyoutsUsd:   5 * n,
    });
  }
  if (a.liquidLevelIndicator) {
    out.push({
      ...emptyLine('liquid_level_strip', 'Liquid-level indicator strip', 'finishing', 'fittings'),
      finishingHrs: 3,
      buyoutsUsd:   45,
    });
  }
  return out;
}

/* ── Insulation + heat trace (Plastatherm) ──────────────────────────── */

export function buildInsulationLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const a = inp.geometry.accessories;
  if (!a) return [];
  const out: JobCalcLineItem[] = [];

  if (a.insulation && a.insulation !== 'none') {
    const layers = a.insulation === '1_layer' ? 1 : 2;
    const idFt = (inp.geometry.idIn ?? 0) / 12;
    const ssFt = (inp.geometry.ssHeightIn ?? 0) / 12;
    const sqft = Math.PI * idFt * ssFt + Math.PI * (idFt / 2) ** 2; // shell + top
    // 1" smooth insulation: $25.36/4×8 sheet ≈ $0.79/sqft. 2" ≈ $1.55/sqft.
    const matCostPerSqft = layers === 1 ? 0.85 : 1.65;
    out.push({
      ...emptyLine(
        `insulation_${layers}_layer`,
        `Insulation (${layers}" foam, ${Math.round(sqft)} sqft)`,
        'insulation',
        'options',
      ),
      shellFabHrs: 8 + sqft * 0.05,
      finishingHrs: 4 + sqft * 0.02,
      buyoutsUsd:   sqft * matCostPerSqft + (a.insulation === '2_layer' ? 11 : 5),
    });
  }
  if (a.plastatherm?.enabled) {
    const idFt = (inp.geometry.idIn ?? 0) / 12;
    const ssFt = (inp.geometry.ssHeightIn ?? 0) / 12;
    if (idFt > 0 && ssFt > 0) {
      // HTD heater package — full Tank Heat Loss Program calculation.
      const sizing = computeHtdHeaterSizing({
        diameterFt:           idFt,
        heightFt:             ssFt,
        orientation:         (inp.geometry.orientation === 'horizontal' ? 'horizontal' : 'vertical'),
        maintainTempF:        Number(a.plastatherm.maintainTempF) || 60,
        // Prefer the rep's site-wide minimum ambient (Step 1 service)
        // over the per-trace fallback so the calc tracks the actual
        // worst-case install condition.
        minAmbientTempF:      Number(inp.service.minAmbientTempF ?? a.plastatherm.minTempF) || 0,
        topHead:              (inp.geometry.topHead ?? 'F_AND_D') as 'flat' | 'F_AND_D' | 'conical' | 'open_top_cover',
        bottom:               (inp.geometry.bottom ?? 'flat_ring_supported') as 'flat_ring_supported' | 'dished' | 'conical_drain' | 'sloped',
        insulationType:       (a.plastatherm.insulationType as HtdInsulationType) ?? 'fiberglass',
        insulationThicknessIn:(a.plastatherm.insulationThicknessIn as HtdInsulationThickness) ?? 2,
        safetyFactor:         Number(a.plastatherm.safetyFactor ?? 0.2),
        windSpeedMph:         Number(a.plastatherm.windSpeedMph ?? 105),
        manwayCount:          a.manway && a.manway.type !== 'none' ? 1 : 0,
        manwayDiameterIn:     Number(a.manway?.diameterIn ?? 24),
        manwayInsulated:      !!a.plastatherm.manwayInsulated,
        supportStyle:         (a.plastatherm.supportStyle as HtdSupportStyle) ?? 'concrete_pad',
        numSupports:          Number(a.plastatherm.numSupports ?? 0),
      });

      // Install labor: 3 hrs base + 1.5 hrs per panel (panel mounting +
      // controller wiring). Tape application rolls into the panel hour.
      const installHrs = 3 + sizing.panels640w * 1.5 + sizing.controllers2xtc * 1.5;

      out.push({
        ...emptyLine(
          'plastatherm_htd',
          `Plastatherm — HTD package (${sizing.panels640w} × 640W panels · ${sizing.controllers2xtc} × 2XTC · ${sizing.aluminumTapeRolls} × tape, ${Math.round(sizing.totalHeatLossW)}W @ ΔT ${Math.round(sizing.deltaTF)}°F)`,
          'fittings',
          'options',
        ),
        fittingsHrs: installHrs,
        buyoutsUsd:  sizing.totalCostUsd,
      });
    }
  }
  return out;
}

/* ── SmartBob / Binmaster (Bryneer indicator) ────────────────────────── */

export function buildSmartBobLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const a = inp.geometry.accessories;
  if (!a || !a.smartBob || a.smartBob === 'none') return [];

  const cost =
    a.smartBob === 'binmaster_ao'         ? BRYNEER_SMARTBOB_PARTS.smartbobAoLevelPro :
    a.smartBob === 'binmaster_ao_heater'  ? BRYNEER_SMARTBOB_PARTS.smartbobAoLevelPro + BRYNEER_SMARTBOB_PARTS.smartbobHeater :
    /* SBR II */                             BRYNEER_SMARTBOB_PARTS.c100ControlConsole + BRYNEER_SMARTBOB_PARTS.smartbobSbrII;

  const label =
    a.smartBob === 'binmaster_ao'        ? 'Binmaster SmartBob AO + LevelPro' :
    a.smartBob === 'binmaster_ao_heater' ? 'Binmaster SmartBob AO + heater'   :
    'Binmaster SBR II remote';
  return [{
    ...emptyLine(`smartbob:${a.smartBob}`, label, 'fittings', 'fittings'),
    shellFabHrs: 2,
    fittingsHrs: 1.5,
    buyoutsUsd:  cost,
  }];
}

/* ── Bryneer™ branded package (salt pipe, plenum, fittings) ─────────── */

export function buildBryneerPackageLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const pkg = inp.geometry.accessories?.bryneerPackage;
  if (!pkg || !pkg.enabled) return [];
  const idFt = (inp.geometry.idIn ?? 0) / 12;
  const ssFt = (inp.geometry.ssHeightIn ?? 0) / 12;

  // Salt pipe — base cost by diameter + $35/ft for tanks > 15'.
  const saltPipeRow = lookupApprox(BRYNEER_SALT_PIPE_TABLE, 'diameterFt', idFt);
  const saltPipeBase = saltPipeRow?.baseCostUsd ?? 0;
  const tallAdder = ssFt > 15 ? (ssFt - 15) * 35 : 0;
  const passivation = BRYNEER_SALT_PIPE_PASSIVATION_ADDER;

  // Adder package parts — sum exactly the toggles the user kept on.
  const adderTotal =
    (pkg.breatherBag       ? BRYNEER_ADDER_PARTS.breatherBag      : 0) +
    (pkg.kamlockCoupling   ? BRYNEER_ADDER_PARTS.kamlockCoupling
                              + BRYNEER_ADDER_PARTS.fourInchAlumCap
                              + BRYNEER_ADDER_PARTS.eightInchNeoBoot : 0) +
    (pkg.solenoidValve     ? BRYNEER_ADDER_PARTS.solenoidValve    : 0) +
    (pkg.flowValve         ? BRYNEER_ADDER_PARTS.doleFlowValve    : 0) +
    (pkg.saltPipeStandoff  ? BRYNEER_ADDER_PARTS.sixInchPvcCap
                              + BRYNEER_ADDER_PARTS.oneAndQuarterTee
                              + BRYNEER_ADDER_PARTS.oneAndQuarterCapS
                              + BRYNEER_ADDER_PARTS.slottedPvcPipe
                              + BRYNEER_ADDER_PARTS.eightInchPvcPipe : 0) +
    BRYNEER_ADDER_PARTS.frpPlenum
    + BRYNEER_ADDER_PARTS.inletRingPipe
    + BRYNEER_ADDER_PARTS.miscPvc
    + BRYNEER_ADDER_PARTS.oAndMManual;

  // Bryneer-specific labor — 'Labor Hours'!CD3:CK9 by diameter.
  // Total = vent clips 2.5 + plenum clips 3.75 + salt pipe clip 6 + draw-off 1.5
  //       + inlet ring stubs (8-14 by dia) + plenum 3.5
  const inletRingStubs = idFt <= 8 ? 8 : idFt <= 9 ? 8 : idFt <= 10 ? 10 : idFt <= 11 ? 10 : idFt <= 12 ? 12 : 14;
  const bryneerLaborHrs = 2.5 + 3.75 + 6 + 1.5 + inletRingStubs + 3.5
    - (ssFt < 8 ? 1.25 : 0); // tall-tank labor adjustment

  return [{
    ...emptyLine(
      'bryneer_package',
      'Bryneer™ salt-brine package (salt pipe + plenum + fittings)',
      'fittings',
      'options',
    ),
    shellFabHrs: bryneerLaborHrs * 0.6,
    fittingsHrs: bryneerLaborHrs * 0.4,
    buyoutsUsd:  saltPipeBase + tallAdder + passivation + adderTotal,
  }];
}

/* ── Hydrotest, P.E. calcs, anchor templates, O&M (Labor!822-826) ───── */

export function buildDocumentationLines(inp: JobCalcInputs): JobCalcLineItem[] {
  const a = inp.geometry.accessories;
  if (!a) return [];
  const out: JobCalcLineItem[] = [];

  if (a.hydrotest) {
    const ssFt = (inp.geometry.ssHeightIn ?? 0) / 12;
    const idFt = (inp.geometry.idIn ?? 0) / 12;
    const gal  = Math.PI * (idFt / 2) ** 2 * ssFt * 7.48;

    const cranePermit = ssFt >= 15 ? HYDROTEST.cranePermitCost : 0;
    const craneRental = ssFt > 27
      ? HYDROTEST.craneCost45ton
      : ssFt >= 15
        ? HYDROTEST.craneCost18to25ton
        : 0;
    const water = gal * HYDROTEST.waterCostPerGallon;

    out.push({
      ...emptyLine('hydrotest', 'Hydrotest (water + crane + permit)', 'flat', 'tests'),
      indirectHrs: ssFt <= 15 ? HYDROTEST.indirectLaborHrsShort : HYDROTEST.indirectLaborHrsTall,
      buyoutsUsd:  water + craneRental + cranePermit,
    });
  }
  if (a.peCalcs) {
    out.push({
      ...emptyLine('pe_calcs', 'P.E. Calculations', 'flat', 'tests'),
      finishingHrs: 8,
      buyoutsUsd:   500, // outside PE stamp + plotting
    });
  }
  if (a.anchorBoltTemplates) {
    out.push({
      ...emptyLine('anchor_templates', 'Anchor bolt templates', 'flat', 'tests'),
      finishingHrs: 2,
      buyoutsUsd:   75,
    });
  }
  if ((a.oAndMManuals ?? 0) > 0) {
    const n = a.oAndMManuals ?? 0;
    out.push({
      ...emptyLine('o_and_m', `PTI Standard O&M Manuals (×${n})`, 'flat', 'tests'),
      indirectHrs: n * 10,                  // Labor!K596 = qty × 10 hrs
      buyoutsUsd:  n * 100,                 // $100 per binder
    });
  }
  return out;
}

/* ── Surface veil (Quote2!B25 — Raw Materials!B25:G28) ──────────────── */

export function buildVeilLine(inp: JobCalcInputs): JobCalcLineItem[] {
  const v = findVeil(inp.wallBuildup?.veilId) ?? VEIL_OPTIONS[0];
  const idIn = inp.geometry.idIn ?? 0;
  const ssHeightIn = inp.geometry.ssHeightIn ?? 0;
  if (!idIn || !ssHeightIn) return [];

  const idFt        = idIn / 12;
  const ssFt        = ssHeightIn / 12;
  const shellSqft   = Math.PI * idFt * ssFt;
  const headSqft    = Math.PI * (idFt / 2) ** 2;
  // Veil covers the inner surface — shell + bottom head + 80% of top
  // (open-top tanks exclude the dome/cover).
  const top = inp.geometry.topHead ?? 'F_AND_D';
  const topFactor = top === 'open_top_cover' ? 0 : 0.8;
  const veiledSqft = shellSqft + headSqft * (1 + topFactor);

  return [{
    ...emptyLine(`veil:${v.id}`, `Surface veil — ${v.label}`, 'shellFab', 'shell'),
    // ~4 hrs of shell-fab per ply (Labor!821 "A' Veil" line) plus a small
    // surface-area-driven add for layup time on larger vessels.
    shellFabHrs:  v.plies * 4 + veiledSqft * 0.005,
    buyoutsUsd:   veiledSqft * v.costPerSqft,
  }];
}

/* ── Double wall (Labor!790-795 — cardboard core + extra shell + bottom + seams) */

export function buildDoubleWallLines(inp: JobCalcInputs): JobCalcLineItem[] {
  if (!inp.geometry.doubleWall) return [];
  const idIn = inp.geometry.idIn ?? 0;
  const ssHeightIn = inp.geometry.ssHeightIn ?? 0;
  if (!idIn || !ssHeightIn) return [];

  const idFt        = idIn / 12;
  const ssFt        = ssHeightIn / 12;
  const shellSqft   = Math.PI * idFt * ssFt;
  const headSqft    = Math.PI * (idFt / 2) ** 2;

  // Cardboard core spacer between primary + secondary shells (Excel
  // Labor!790, "Double Wall - Cardboard"): ~0.0933 lb/sqft + buyout.
  const cardboard: JobCalcLineItem = {
    ...emptyLine('double_wall_cardboard', 'Double-wall — cardboard core spacer', 'shellFab', 'shell'),
    shellFabHrs:  4 + shellSqft * 0.04,
    buyoutsUsd:   shellSqft * 0.0933 + 35.03,
  };
  // Outer shell + structural buildup (Labor!791): ~60% of the primary
  // shell's resin/chop tonnage at fittingsHot markup.
  const outerShell: JobCalcLineItem = {
    ...emptyLine('double_wall_shell', 'Double-wall — outer shell + structure', 'shellFab', 'shell'),
    shellFabHrs:  10 + shellSqft * 0.18,
    finishingHrs: 4 + shellSqft * 0.04,
    resinLb:      shellSqft * 1.6,
    choppedLb:    shellSqft * 0.6,
    windingLb:    shellSqft * 0.8,
  };
  // Outer bottom (Labor!792).
  const bottom: JobCalcLineItem = {
    ...emptyLine('double_wall_bottom', 'Double-wall — outer bottom', 'shellFab', 'shell'),
    shellFabHrs:  6 + headSqft * 0.18,
    resinLb:      headSqft * 1.6,
    choppedLb:    headSqft * 0.6,
  };
  // Extra joint seams + horizontal head seams (Labor!793-794).
  const seams: JobCalcLineItem = {
    ...emptyLine('double_wall_seams', 'Double-wall — extra joint + head seams', 'finishing', 'finishing'),
    finishingHrs: 3 + ssFt * 0.4,
  };
  // Leak-detection assembly (Labor!795 + Raw Materials!F552).
  const leakDet: JobCalcLineItem = {
    ...emptyLine('double_wall_leak_det', 'Double-wall — leak-detection strobe + assembly', 'fittings', 'tests'),
    fittingsHrs:  2,
    buyoutsUsd:   215, // Raw Materials assembly + freight
  };

  return [cardboard, outerShell, bottom, seams, leakDet];
}

/* ── Aggregator ─────────────────────────────────────────────────────── */

export function buildAllLines(inp: JobCalcInputs): JobCalcLineItem[] {
  return [
    ...buildShellFabLines(inp),
    ...buildVeilLine(inp),
    ...buildNozzleLines(inp),
    ...buildManwayLines(inp),
    ...buildVentLines(inp),
    ...buildBlindFlangeLines(inp),
    ...buildDipPipeLines(inp),
    ...buildBaffleLines(inp),
    ...buildDoubleWallLines(inp),
    ...buildStainlessStandLines(inp),
    ...buildHorizontalSaddleLines(inp),
    ...buildRingStandLines(inp),
    ...buildLugLines(inp),
    ...buildLiftingChannelLines(inp),
    ...buildLadderLines(inp),
    ...buildHandrailLines(inp),
    ...buildAccessLines(inp),
    ...buildAgitatorSupportLines(inp),
    ...buildMiscLines(inp),
    ...buildInsulationLines(inp),
    ...buildSmartBobLines(inp),
    ...buildBryneerPackageLines(inp),
    ...buildDocumentationLines(inp),
    ...buildPostCureLines(inp),
    ...buildCertificationLines(inp),
    ...buildIndirectLines(inp),
  ];
}
