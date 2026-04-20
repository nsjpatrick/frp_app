/**
 * Wind analysis for vertical cylindrical tanks per ASCE 7-22.
 *
 * Velocity pressure (§26.10):
 *   q_z = 0.00256 × K_z × K_zt × K_d × V² × I_w    (psf)
 *
 * Force coefficient for round structures (§29.4 + Table 29.4-1):
 *   Cf ≈ 0.5 for D/√(q_z·h) > 2.5
 *   Cf ≈ 0.7 otherwise (conservative default for short FRP tanks)
 */

import type { WindAnalysisResult, VesselGeometryInput, WindSiteInput } from './types';
import { WIND_DIRECTIONALITY_Kd_ROUND_TANK, IMPORTANCE_FACTOR, IN_PER_FT } from './constants';

type Exposure = 'B' | 'C' | 'D';

const Kz_TABLE: Record<Exposure, Array<[number, number]>> = {
  B: [[15, 0.57], [20, 0.62], [25, 0.66], [30, 0.70], [40, 0.76], [50, 0.81], [60, 0.85], [70, 0.89], [80, 0.93], [90, 0.96], [100, 0.99], [120, 1.04]],
  C: [[15, 0.85], [20, 0.90], [25, 0.94], [30, 0.98], [40, 1.04], [50, 1.09], [60, 1.13], [70, 1.17], [80, 1.21], [90, 1.24], [100, 1.26], [120, 1.31]],
  D: [[15, 1.03], [20, 1.08], [25, 1.12], [30, 1.16], [40, 1.22], [50, 1.27], [60, 1.31], [70, 1.34], [80, 1.38], [90, 1.40], [100, 1.43], [120, 1.48]],
};

function lookupKz(exposure: Exposure, heightFt: number): number {
  const rows = Kz_TABLE[exposure];
  const clamped = Math.max(rows[0][0], Math.min(rows[rows.length - 1][0], heightFt));
  for (let i = 0; i < rows.length - 1; i++) {
    const [h0, k0] = rows[i];
    const [h1, k1] = rows[i + 1];
    if (clamped >= h0 && clamped <= h1) {
      const frac = (clamped - h0) / (h1 - h0);
      return k0 + frac * (k1 - k0);
    }
  }
  return rows[rows.length - 1][1];
}

export function velocityPressureQz(args: {
  V: number;
  exposure: Exposure;
  Kzt: number;
  riskCategory: 'I' | 'II' | 'III' | 'IV';
  heightFt: number;
}): number {
  const Kz = lookupKz(args.exposure, args.heightFt);
  const Iw = IMPORTANCE_FACTOR[args.riskCategory].Iw;
  const Kd = WIND_DIRECTIONALITY_Kd_ROUND_TANK;
  return 0.00256 * Kz * args.Kzt * Kd * args.V ** 2 * Iw;
}

export function computeWindAnalysis(input: {
  geometry: VesselGeometryInput;
  wind: WindSiteInput;
}): WindAnalysisResult {
  const hFt = input.geometry.ssHeightIn / IN_PER_FT;
  const dFt = input.geometry.idIn / IN_PER_FT;

  const meanHeightFt = hFt / 2;
  const qzPsf = velocityPressureQz({ ...input.wind, heightFt: meanHeightFt });

  const ratio = dFt / Math.sqrt(qzPsf * hFt);
  const Cf = ratio > 2.5 ? 0.5 : 0.7;

  const projectedAreaFt2 = dFt * hFt;
  const baseShearLbf = qzPsf * Cf * projectedAreaFt2;
  const overturningMomentLbfIn = baseShearLbf * (hFt * IN_PER_FT) / 2;

  return {
    qzPsf: +qzPsf.toFixed(2),
    Cf,
    baseShearLbf: +baseShearLbf.toFixed(1),
    overturningMomentLbfIn: +overturningMomentLbfIn.toFixed(1),
    projectedAreaFt2: +projectedAreaFt2.toFixed(1),
    meanHeightFt: +meanHeightFt.toFixed(2),
    engineVersion: 'wind-v1',
    citations: ['ASCE 7-22 §26.10', 'ASCE 7-22 Table 29.4-1'],
  };
}
