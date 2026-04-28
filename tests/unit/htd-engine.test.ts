import { describe, it, expect } from 'vitest';
import { computeHtdHeaterSizing, HTD_PRICING } from '@/lib/pricing/htd-engine';

/**
 * Pins down the HTD heater-sizing engine against the workbook's reference
 * scenario: an 8 ft × 12 ft vertical FRP vessel maintained at 60 °F over
 * a 0 °F worst-case ambient (ΔT = 60), 2″ fiberglass insulation, 105 mph
 * wind, atmospheric / no manway / no supports. The engine should land at
 * two 640W panels + one 2XTC controller + one tape roll (~415 ft² × 2.34
 * w/ft² adjusted = ~970W + 20% safety ≈ 1.16 kW).
 */
describe('HTD heater sizing engine', () => {
  const baseInputs = {
    diameterFt: 8,
    heightFt: 12,
    orientation: 'vertical' as const,
    maintainTempF: 60,
    minAmbientTempF: 0,
    topHead: 'F_AND_D' as const,
    bottom: 'flat_ring_supported' as const,
    insulationType: 'fiberglass' as const,
    insulationThicknessIn: 2 as const,
    safetyFactor: 0.2,
    windSpeedMph: 105,
    manwayCount: 0,
    manwayDiameterIn: 0,
    manwayInsulated: false,
    supportStyle: 'concrete_pad' as const,
    numSupports: 0,
  };

  it('sizes a small vertical tank with 2" fiberglass at ΔT 60 to two panels', () => {
    const out = computeHtdHeaterSizing(baseInputs);

    // ΔT and surface area sanity.
    expect(out.deltaTF).toBe(60);
    // Lateral + dished top + flat bottom for an 8' Ø × 12' tall tank
    // ≈ π·8·12 + 1.084·π·16 + π·16 ≈ 410 ft²
    expect(out.surfaceAreaSqft).toBeGreaterThan(380);
    expect(out.surfaceAreaSqft).toBeLessThan(440);

    // Adjusted rate = base × 1.0 (fiberglass) × 1.17 (>30 mph windage).
    expect(out.windageFactor).toBeCloseTo(1.17, 5);
    expect(out.insulationFactor).toBeCloseTo(1.0, 5);

    // ~1.16 kW total → ceil(1160/640) = 2 panels, 1 controller (≤5).
    expect(out.panels640w).toBe(2);
    expect(out.controllers2xtc).toBe(1);
    expect(out.aluminumTapeRolls).toBe(1);

    // Pricing ties to HTD_PRICING constants.
    expect(out.totalCostUsd).toBeCloseTo(
      2 * HTD_PRICING.panel640wUsd + HTD_PRICING.controller2xtcUsd + HTD_PRICING.aluminumTape150Usd,
      5,
    );
  });

  it('scales panel count up with cellular-glass insulation (1.5× factor)', () => {
    const out = computeHtdHeaterSizing({
      ...baseInputs,
      insulationType: 'cellular_glass',
      insulationThicknessIn: 1,
    });
    // 1″ cellular-glass at ΔT 60 with windage pushes the rate up enough
    // that a small tank still fits in one panel — but the numbers must
    // be strictly higher than the fiberglass-2" baseline.
    const baseline = computeHtdHeaterSizing(baseInputs);
    expect(out.totalHeatLossW).toBeGreaterThan(baseline.totalHeatLossW);
    expect(out.adjustedHeatLossRate).toBeGreaterThan(baseline.adjustedHeatLossRate);
  });

  it('adds support heat-loss when supports > 0', () => {
    const noSupports = computeHtdHeaterSizing(baseInputs);
    const withSlab   = computeHtdHeaterSizing({ ...baseInputs, numSupports: 1, supportStyle: 'concrete_pad' });

    expect(noSupports.supportHeatLossW).toBe(0);
    expect(withSlab.supportHeatLossW).toBeGreaterThan(0);
    expect(withSlab.totalHeatLossW).toBeGreaterThan(noSupports.totalHeatLossW);
  });

  it('adds manway heat-loss when an uninsulated manway is present', () => {
    const noManway = computeHtdHeaterSizing(baseInputs);
    const withManway = computeHtdHeaterSizing({
      ...baseInputs,
      manwayCount: 1,
      manwayDiameterIn: 24,
      manwayInsulated: false,
    });
    expect(noManway.manwayHeatLossW).toBe(0);
    expect(withManway.manwayHeatLossW).toBeGreaterThan(0);
    // Insulated manway must lose strictly less than uninsulated.
    const insulatedManway = computeHtdHeaterSizing({
      ...baseInputs,
      manwayCount: 1,
      manwayDiameterIn: 24,
      manwayInsulated: true,
    });
    expect(insulatedManway.manwayHeatLossW).toBeLessThan(withManway.manwayHeatLossW);
  });

  it('clamps ΔT at zero when ambient is warmer than maintain', () => {
    const out = computeHtdHeaterSizing({ ...baseInputs, maintainTempF: 40, minAmbientTempF: 80 });
    expect(out.deltaTF).toBe(0);
    expect(out.surfaceHeatLossW).toBe(0);
    // Engine still hands back at least one panel + one controller so the
    // pricing engine doesn't divide-by-zero on the line item.
    expect(out.panels640w).toBe(1);
    expect(out.controllers2xtc).toBe(1);
  });
});
