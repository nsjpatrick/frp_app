import type { SeedResin, ChemicalFamily } from '@/lib/catalog/seed-data';

export function filterByChemistry(
  resins: SeedResin[],
  chemicalFamily: ChemicalFamily,
  designTempF: number,
): SeedResin[] {
  return resins.filter(
    (r) =>
      r.compatible_chemical_families.includes(chemicalFamily) &&
      r.max_service_temp_F >= designTempF,
  );
}
