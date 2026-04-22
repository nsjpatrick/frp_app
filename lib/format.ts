/**
 * Formatting helpers for display-layer chemistry.
 *
 * formatFormula — turns plain-ASCII chemical strings into their
 * Unicode-subscripted display forms. "H2SO4" → "H₂SO₄", "50% NaOCl storage"
 * stays unchanged (no digits after letters without a chemical context),
 * "40% FeCl3 storage" → "40% FeCl₃ storage". Leaves leading numbers (e.g.
 * "50%") and standalone digits alone — only digits that immediately follow
 * an alphabetic character get subscripted, matching standard chemical
 * notation conventions.
 *
 * User input stays ASCII for ease of typing; display goes through this.
 */

const DIGIT_TO_SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

export function formatFormula(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/([A-Za-z])([0-9]+)/g, (_, letter: string, digits: string) => {
    const subscripted = digits
      .split('')
      .map((d) => DIGIT_TO_SUB[d] ?? d)
      .join('');
    return letter + subscripted;
  });
}

// Phone helpers now live in `@/lib/phone` — re-exported here so existing
// callers of `formatPhone` / `normalizePhone` keep working. New code
// should import directly from `@/lib/phone`.
export { formatPhone, normalizePhone } from '@/lib/phone';

// Whole-dollar, comma-grouped formatter: `127000 → "$127,000"`. Used on
// the dashboard and anywhere we want full precision instead of `$127k`.
const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatUSD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '$0';
  return USD.format(Math.round(value));
}
