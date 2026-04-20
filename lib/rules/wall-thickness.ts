/**
 * FRP tank wall thickness per ASTM D3299 (filament-wound) + D4097 (contact-molded heads)
 * with minimums from RTP-1 Part 3B Table 3B-1.
 *
 * Primary hoop design:
 *   t_hoop = P_design × D / (2 × HDS)
 */

import type { WallThicknessResult, VesselGeometryInput, ServiceInput } from './types';
import {
  RTP1_HOOP_DESIGN_STRESS_PSI,
  rtp1MinimumShellThicknessIn,
} from './constants';

const PSI_PER_FT_WATER = 0.43352;

export function computeWallThickness(input: {
  geometry: VesselGeometryInput;
  service: ServiceInput;
}): WallThicknessResult {
  const { idIn, ssHeightIn } = input.geometry;
  const { specificGravity, operatingPressurePsig } = input.service;

  const liquidHeightFt = ssHeightIn / 12;
  const hydroHeadPsi = liquidHeightFt * specificGravity * PSI_PER_FT_WATER;
  const designPressurePsi = hydroHeadPsi + operatingPressurePsig;

  const hoopThicknessIn = (designPressurePsi * idIn) / (2 * RTP1_HOOP_DESIGN_STRESS_PSI);
  const minimumThicknessIn = rtp1MinimumShellThicknessIn(idIn);

  const shellThicknessIn = Math.max(hoopThicknessIn, minimumThicknessIn);
  const headThicknessIn = +(shellThicknessIn * 1.15).toFixed(4);

  const governingRule: WallThicknessResult['governingRule'] =
    hoopThicknessIn > minimumThicknessIn ? 'hoop_pressure' : 'rtp1_minimum';

  return {
    shellThicknessIn: +shellThicknessIn.toFixed(4),
    headThicknessIn,
    governingRule,
    engineVersion: 'wall-thickness-v1',
    citations: ['ASTM D3299', 'ASTM D4097', 'RTP-1 Part 3B'],
  };
}
