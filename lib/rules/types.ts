import type { RiskCategory, SiteClass } from './constants';

export type Orientation = 'vertical' | 'horizontal';

export type SeismicSiteInput = {
  siteClass: SiteClass;
  Ss: number;   // short-period mapped spectral accel (g)
  S1: number;   // 1-sec mapped spectral accel (g)
  riskCategory: RiskCategory;
};

export type WindSiteInput = {
  V: number;                     // basic wind speed (mph) per ASCE 7 hazard map
  exposure: 'B' | 'C' | 'D';     // §26.7
  Kzt: number;                   // topographic factor §26.8 (1.0 flat)
  riskCategory: RiskCategory;
};

export type VesselGeometryInput = {
  orientation: Orientation;
  idIn: number;                  // inside diameter
  ssHeightIn: number;            // straight-side (shell) height
  freeboardIn: number;
  topHead: 'flat' | 'F_AND_D' | 'conical' | 'open_top_cover';
  bottom: 'flat_ring_supported' | 'dished' | 'conical_drain' | 'sloped';
};

export type ServiceInput = {
  specificGravity: number;
  designTempF: number;
  operatingPressurePsig: number;
  vacuumPsig: number;
};

export type WallThicknessResult = {
  shellThicknessIn: number;
  headThicknessIn: number;
  governingRule: 'hoop_pressure' | 'axial_pressure' | 'rtp1_minimum';
  engineVersion: string;
  citations: string[];
};

export type WindAnalysisResult = {
  qzPsf: number;
  Cf: number;
  baseShearLbf: number;
  overturningMomentLbfIn: number;
  projectedAreaFt2: number;
  meanHeightFt: number;
  engineVersion: string;
  citations: string[];
};

export type SeismicAnalysisResult = {
  SDS: number;
  SD1: number;
  Ai: number;
  Ac: number;
  Wi_lb: number;
  Wc_lb: number;
  Hi_in: number;
  Hc_in: number;
  baseShearLbf: number;
  overturningMomentLbfIn: number;
  requiredFreeboardIn: number;
  engineVersion: string;
  citations: string[];
};

export type LoadCombinationInput = {
  deadLoadLbf: number;
  windShearLbf: number;
  windOverturningLbfIn: number;
  seismicShearLbf: number;
  seismicOverturningLbfIn: number;
};

export type GoverningCase =
  | '0.6D+W'
  | '0.9D+1.0E'
  | '1.2D+1.6W'
  | '1.2D+1.0E+0.2S';

export type LoadCombinationResult = {
  governingCase: GoverningCase;
  governingUpliftLbf: number;
  governingLateralLbf: number;
  governingOverturningLbfIn: number;
  engineVersion: string;
};

export type AnchorSizingResult = {
  anchorDetailId: string;
  qty: number;
  requiredCapacityLbf: number;
  selectedCapacityLbfEach: number;
  pitch: 'inches' | 'acceptable';
  engineVersion: string;
};

export type StructuralAnalysisResult = {
  wallThickness: WallThicknessResult;
  wind: WindAnalysisResult;
  seismic: SeismicAnalysisResult;
  loadCombination: LoadCombinationResult;
  anchor: AnchorSizingResult;
  preliminary: true;
  reviewRequired: true;
  engineVersion: string;
};
