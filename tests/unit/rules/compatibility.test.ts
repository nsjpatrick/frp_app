import { describe, it, expect } from 'vitest';
import { filterByChemistry } from '@/lib/rules/compatibility';
import { SEED_RESINS } from '@/lib/catalog/seed-data';

describe('filterByChemistry', () => {
  it('filters to resins whose family supports the chemical and temp', () => {
    const result = filterByChemistry(SEED_RESINS, 'dilute_acid', 120);
    expect(result.map((r) => r.id).sort()).toEqual(['derakane-411-350', 'hetron-922']);
  });

  it('excludes resins below design temperature', () => {
    const result = filterByChemistry(SEED_RESINS, 'dilute_acid', 230);
    expect(result).toHaveLength(0);
  });

  it('handles unknown chemical family by returning empty', () => {
    const result = filterByChemistry(SEED_RESINS, 'fictional_chemical' as any, 120);
    expect(result).toHaveLength(0);
  });
});
