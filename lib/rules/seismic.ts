/**
 * Seismic analysis for vertical flat-bottom ground-supported liquid-containing tanks per
 *   ASCE 7-22 §15.7 (references API 650 App E formulas for impulsive/convective decomposition).
 */

import type { SeismicAnalysisResult, SeismicSiteInput, VesselGeometryInput, ServiceInput } from './types';
import {
  FA_TABLE,
  FV_TABLE,
  IMPORTANCE_FACTOR,
  WATER_DENSITY_PCF,
  GRAVITY_IN_PER_SEC2,
  IN_PER_FT,
} from './constants';

function interp1d(table: Record<number, Partial<Record<string, number>>>, x: number, siteClass: string): number {
  const xs = Object.keys(table).map(Number).sort((a, b) => a - b);
  const clamped = Math.max(xs[0], Math.min(xs[xs.length - 1], x));
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (clamped >= x0 && clamped <= x1) {
      const y0 = table[x0][siteClass];
      const y1 = table[x1][siteClass];
      if (y0 == null || y1 == null) throw new Error(`no table entry for site class ${siteClass}`);
      const frac = (clamped - x0) / (x1 - x0);
      return y0 + frac * (y1 - y0);
    }
  }
  const fallback = table[xs[xs.length - 1]][siteClass];
  if (fallback == null) throw new Error(`no table entry for site class ${siteClass}`);
  return fallback;
}

export function designSpectralAccelerations(args: {
  Ss: number;
  S1: number;
  siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
}): { SDS: number; SD1: number; Fa: number; Fv: number } {
  if (args.siteClass === 'F') {
    throw new Error('Site Class F requires site-specific hazard analysis — out of V1 scope');
  }
  const Fa = interp1d(FA_TABLE as Record<number, Partial<Record<string, number>>>, args.Ss, args.siteClass);
  const Fv = interp1d(FV_TABLE as Record<number, Partial<Record<string, number>>>, args.S1, args.siteClass);
  const SMS = Fa * args.Ss;
  const SM1 = Fv * args.S1;
  return {
    SDS: (2 / 3) * SMS,
    SD1: (2 / 3) * SM1,
    Fa,
    Fv,
  };
}

const R_I_MECHANICALLY_ANCHORED = 1.5;
const R_C = 1.0;
const K_CONVECTIVE = 1.5;

export function computeSeismicAnalysis(input: {
  geometry: VesselGeometryInput;
  service: ServiceInput;
  site: SeismicSiteInput;
}): SeismicAnalysisResult {
  const { idIn, ssHeightIn, freeboardIn } = input.geometry;
  const { specificGravity } = input.service;
  const { SDS, SD1 } = designSpectralAccelerations(input.site);
  const Ie = IMPORTANCE_FACTOR[input.site.riskCategory].Ie;

  const dFt = idIn / IN_PER_FT;
  const hFt = Math.max(0, (ssHeightIn - freeboardIn) / IN_PER_FT);
  const dOverH = dFt / hFt;
  const hOverD = hFt / dFt;

  const volumeFt3 = Math.PI * (dFt / 2) ** 2 * hFt;
  const Wp = volumeFt3 * WATER_DENSITY_PCF * specificGravity;

  let Wi: number;
  if (dOverH >= 1.333) {
    Wi = Math.tanh(0.866 * dOverH) / (0.866 * dOverH) * Wp;
  } else {
    Wi = (1.0 - 0.218 * dOverH) * Wp;
  }

  const Wc = 0.230 * dOverH * Math.tanh(3.67 * hOverD) * Wp;

  let Hi_ft: number;
  if (dOverH >= 1.333) {
    Hi_ft = 0.375 * hFt;
  } else {
    Hi_ft = (0.50 - 0.094 * dOverH) * hFt;
  }
  const argC = 3.67 * hOverD;
  const Hc_ft = (1 - (Math.cosh(argC) - 1) / (argC * Math.sinh(argC))) * hFt;

  const dIn = idIn;
  const Tc = 2 * Math.PI * Math.sqrt(dIn / (3.68 * GRAVITY_IN_PER_SEC2 * Math.tanh(3.68 * hOverD)));

  const Ai = (SDS * Ie) / R_I_MECHANICALLY_ANCHORED;
  const Ac = Math.min(Ai, (K_CONVECTIVE * SD1 * Ie) / (Tc * R_C));

  const V_i = Ai * Wi;
  const V_c = Ac * Wc;
  const baseShearLbf = Math.sqrt(V_i ** 2 + V_c ** 2);

  const M_i = V_i * Hi_ft * IN_PER_FT;
  const M_c = V_c * Hc_ft * IN_PER_FT;
  const overturningMomentLbfIn = Math.sqrt(M_i ** 2 + M_c ** 2);

  const requiredFreeboardIn = 0.5 * dIn * Ac;

  return {
    SDS: +SDS.toFixed(3),
    SD1: +SD1.toFixed(3),
    Ai: +Ai.toFixed(3),
    Ac: +Ac.toFixed(3),
    Wi_lb: +Wi.toFixed(0),
    Wc_lb: +Wc.toFixed(0),
    Hi_in: +(Hi_ft * IN_PER_FT).toFixed(1),
    Hc_in: +(Hc_ft * IN_PER_FT).toFixed(1),
    baseShearLbf: +baseShearLbf.toFixed(0),
    overturningMomentLbfIn: +overturningMomentLbfIn.toFixed(0),
    requiredFreeboardIn: +requiredFreeboardIn.toFixed(2),
    engineVersion: 'seismic-v1',
    citations: ['ASCE 7-22 §15.7', 'API 650 App E', 'ASCE 7-22 §11.4'],
  };
}
