export type WallThicknessInput = {
  idIn: number;
  ssHeightIn: number;
  specificGravity: number;
};

export type WallThicknessResult = {
  shellThicknessIn: number;
  headThicknessIn: number;
  governingRule: string;
  engineVersion: string;
};

// Stub: piecewise linear estimate. Real ASTM D3299 / RTP-1 math in Plan 2.
export function estimateWallThickness(input: WallThicknessInput): WallThicknessResult {
  const diameterFactor = Math.max(0.25, input.idIn / 240);
  const sgFactor = Math.max(0.8, input.specificGravity);
  const shell = +(diameterFactor * sgFactor).toFixed(3);
  const head = +(shell * 1.15).toFixed(3);

  return {
    shellThicknessIn: shell,
    headThicknessIn: head,
    governingRule: 'stub-lookup',
    engineVersion: 'wall-thickness-stub-v0',
  };
}
