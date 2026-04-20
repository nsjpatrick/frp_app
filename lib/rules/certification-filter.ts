import type { SeedResin } from '@/lib/catalog/seed-data';

export type CertificationRequirements = {
  asme_rtp1_class: 'I' | 'II' | 'III' | null;
  ansi_standards: Array<{ code: string; revision: string; scope?: string }>;
  nsf_ansi_61_required: boolean;
  nsf_ansi_61_target_temp_F?: number;
  nsf_ansi_2_required: boolean;
};

export function filterByCertifications(
  resins: SeedResin[],
  reqs: CertificationRequirements,
  designTempF: number,
): SeedResin[] {
  return resins.filter((r) => {
    if (reqs.nsf_ansi_61_required) {
      if (!r.certifications.nsf_ansi_61.listed) return false;
      const listingMax = r.certifications.nsf_ansi_61.max_temp_F ?? -Infinity;
      const targetTemp = reqs.nsf_ansi_61_target_temp_F ?? designTempF;
      if (listingMax < targetTemp) return false;
    }
    if (reqs.nsf_ansi_2_required && !r.certifications.nsf_ansi_2.listed) return false;
    if (reqs.asme_rtp1_class &&
        !r.certifications.asme_rtp1_class_eligibility.includes(reqs.asme_rtp1_class)) {
      return false;
    }
    return true;
  });
}
