/**
 * Structural analysis orchestrator.
 */

import type {
  StructuralAnalysisResult,
  VesselGeometryInput,
  ServiceInput,
  SeismicSiteInput,
  WindSiteInput,
} from './types';
import type { AnchorDetail } from '@/lib/catalog/anchor';
import { computeWallThickness } from './wall-thickness';
import { computeWindAnalysis } from './wind';
import { computeSeismicAnalysis } from './seismic';
import { selectGoverningLoadCase } from './load-combinations';
import { sizeAnchors } from './anchor-sizing';
import { IN_PER_FT } from './constants';

function approximateVesselDeadLoadLbf(input: {
  geometry: VesselGeometryInput;
  wallThicknessIn: number;
}): number {
  const FRP_DENSITY_PCF = 95;
  const { idIn, ssHeightIn } = input.geometry;
  const tFt = input.wallThicknessIn / IN_PER_FT;
  const dFt = idIn / IN_PER_FT;
  const hFt = ssHeightIn / IN_PER_FT;
  const shellWeight = Math.PI * dFt * hFt * tFt * FRP_DENSITY_PCF;
  const headArea = Math.PI * (dFt / 2) ** 2;
  const headWeight = 2 * headArea * (tFt * 1.15) * FRP_DENSITY_PCF;
  return shellWeight + headWeight;
}

export function computeStructuralAnalysis(input: {
  geometry: VesselGeometryInput;
  service: ServiceInput;
  seismic: SeismicSiteInput;
  wind: WindSiteInput;
  anchorCatalog: AnchorDetail[];
}): StructuralAnalysisResult {
  const wallThickness = computeWallThickness({
    geometry: input.geometry,
    service: input.service,
  });

  const wind = computeWindAnalysis({
    geometry: input.geometry,
    wind: input.wind,
  });

  const seismic = computeSeismicAnalysis({
    geometry: input.geometry,
    service: input.service,
    site: input.seismic,
  });

  const deadLoadLbf = approximateVesselDeadLoadLbf({
    geometry: input.geometry,
    wallThicknessIn: wallThickness.shellThicknessIn,
  });

  const loadCombination = selectGoverningLoadCase({
    deadLoadLbf,
    windShearLbf: wind.baseShearLbf,
    windOverturningLbfIn: wind.overturningMomentLbfIn,
    seismicShearLbf: seismic.baseShearLbf,
    seismicOverturningLbfIn: seismic.overturningMomentLbfIn,
    diameterIn: input.geometry.idIn,
  });

  const anchor = sizeAnchors({
    upliftLbf: loadCombination.governingUpliftLbf,
    catalog: input.anchorCatalog,
  });

  return {
    wallThickness,
    wind,
    seismic,
    loadCombination,
    anchor,
    preliminary: true,
    reviewRequired: true,
    engineVersion: '0.2.0-rules-depth',
  };
}
