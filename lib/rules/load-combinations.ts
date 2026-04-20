/**
 * Governing load case per ASCE 7-22 §2.3 strength design combinations.
 * Uplift combos:
 *   0.6·D + W              (wind uplift)
 *   0.9·D + 1.0·E          (seismic uplift)
 * Lateral combos:
 *   1.2·D + 1.6·W
 *   1.2·D + 1.0·E + 0.2·S  (S=snow; 0 in V1)
 *
 * V1 approximation for net uplift at the anchor line: treat overturning as a couple
 * acting at effective radius R ≈ 0.4·D:
 *   uplift = M / R − dead_load_share_factor × D
 */

import type { LoadCombinationInput, LoadCombinationResult, GoverningCase } from './types';

const EFFECTIVE_LEVER_ARM_FRACTION_OF_D = 0.4;

export function selectGoverningLoadCase(
  input: LoadCombinationInput & { diameterIn?: number },
): LoadCombinationResult {
  const D_in = input.diameterIn ?? 120;
  const R = EFFECTIVE_LEVER_ARM_FRACTION_OF_D * D_in;

  const upliftWind = Math.max(0, input.windOverturningLbfIn / R - 0.6 * input.deadLoadLbf);
  const upliftSeismic = Math.max(0, input.seismicOverturningLbfIn / R - 0.9 * input.deadLoadLbf);

  let governingCase: GoverningCase;
  let governingUpliftLbf: number;

  if (upliftWind >= upliftSeismic) {
    governingCase = '0.6D+W';
    governingUpliftLbf = upliftWind;
  } else {
    governingCase = '0.9D+1.0E';
    governingUpliftLbf = upliftSeismic;
  }

  const lateralWind = 1.6 * input.windShearLbf;
  const lateralSeismic = 1.0 * input.seismicShearLbf;
  const governingLateralLbf = Math.max(lateralWind, lateralSeismic);

  const governingOverturningLbfIn = governingCase === '0.6D+W'
    ? input.windOverturningLbfIn
    : input.seismicOverturningLbfIn;

  return {
    governingCase,
    governingUpliftLbf: +governingUpliftLbf.toFixed(1),
    governingLateralLbf: +governingLateralLbf.toFixed(1),
    governingOverturningLbfIn: +governingOverturningLbfIn.toFixed(1),
    engineVersion: 'load-combinations-v1',
  };
}
