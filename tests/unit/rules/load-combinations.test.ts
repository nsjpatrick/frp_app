import { describe, it, expect } from 'vitest';
import { selectGoverningLoadCase } from '@/lib/rules/load-combinations';

describe('selectGoverningLoadCase — ASCE 7-22 §2.3', () => {
  it('picks wind uplift combo when wind overturning > seismic and dead load small', () => {
    const r = selectGoverningLoadCase({
      deadLoadLbf: 5000,
      windShearLbf: 3000,
      windOverturningLbfIn: 500_000,
      seismicShearLbf: 2000,
      seismicOverturningLbfIn: 300_000,
    });
    expect(r.governingCase).toBe('0.6D+W');
    expect(r.governingUpliftLbf).toBeGreaterThan(0);
  });

  it('picks seismic uplift when seismic overturning dominates', () => {
    const r = selectGoverningLoadCase({
      deadLoadLbf: 5000,
      windShearLbf: 2000,
      windOverturningLbfIn: 200_000,
      seismicShearLbf: 4000,
      seismicOverturningLbfIn: 600_000,
    });
    expect(r.governingCase).toBe('0.9D+1.0E');
  });

  it('returns nonzero lateral and overturning magnitudes', () => {
    const r = selectGoverningLoadCase({
      deadLoadLbf: 5000,
      windShearLbf: 3000,
      windOverturningLbfIn: 500_000,
      seismicShearLbf: 2000,
      seismicOverturningLbfIn: 300_000,
    });
    expect(r.governingLateralLbf).toBeGreaterThan(0);
    expect(r.governingOverturningLbfIn).toBeGreaterThan(0);
  });
});
