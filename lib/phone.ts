/**
 * Phone number helpers — country-aware.
 *
 * Storage shape: `+CC-<local>` where <local> is the country-appropriate
 * dash form. For North America the local form is `XXX-XXX-XXXX`. Other
 * countries pass through with the raw digits joined by spaces so we don't
 * guess at a block pattern we don't know.
 *
 * All display + save code in the app goes through these helpers — the
 * contact editor's country dropdown emits the `+CC` prefix which splices
 * onto the normalized local form.
 */

export type CountryCode = {
  dial: string;   // e.g. "1", "44"
  iso: string;    // e.g. "US", "GB"
  label: string;  // e.g. "United States"
  flag: string;   // unicode flag — purely visual, never stored
};

// Ordered for dropdown presentation: US default first, then common markets
// we see in the quoter's target audience. Keep the list manageable rather
// than exhaustive — this isn't a global directory.
export const COUNTRY_CODES: CountryCode[] = [
  { dial: '1',   iso: 'US', label: 'United States',  flag: '🇺🇸' },
  { dial: '1',   iso: 'CA', label: 'Canada',         flag: '🇨🇦' },
  { dial: '52',  iso: 'MX', label: 'Mexico',         flag: '🇲🇽' },
  { dial: '44',  iso: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { dial: '49',  iso: 'DE', label: 'Germany',        flag: '🇩🇪' },
  { dial: '33',  iso: 'FR', label: 'France',         flag: '🇫🇷' },
  { dial: '39',  iso: 'IT', label: 'Italy',          flag: '🇮🇹' },
  { dial: '34',  iso: 'ES', label: 'Spain',          flag: '🇪🇸' },
  { dial: '31',  iso: 'NL', label: 'Netherlands',    flag: '🇳🇱' },
  { dial: '46',  iso: 'SE', label: 'Sweden',         flag: '🇸🇪' },
  { dial: '47',  iso: 'NO', label: 'Norway',         flag: '🇳🇴' },
  { dial: '45',  iso: 'DK', label: 'Denmark',        flag: '🇩🇰' },
  { dial: '358', iso: 'FI', label: 'Finland',        flag: '🇫🇮' },
  { dial: '81',  iso: 'JP', label: 'Japan',          flag: '🇯🇵' },
  { dial: '86',  iso: 'CN', label: 'China',          flag: '🇨🇳' },
  { dial: '91',  iso: 'IN', label: 'India',          flag: '🇮🇳' },
  { dial: '61',  iso: 'AU', label: 'Australia',      flag: '🇦🇺' },
  { dial: '55',  iso: 'BR', label: 'Brazil',         flag: '🇧🇷' },
  { dial: '971', iso: 'AE', label: 'UAE',            flag: '🇦🇪' },
  { dial: '966', iso: 'SA', label: 'Saudi Arabia',   flag: '🇸🇦' },
];

export const DEFAULT_COUNTRY_DIAL = '1';

/**
 * parsePhone — split a stored phone into country code + local number.
 * Accepts anything — raw input, canonical `+1-555-...`, plain digits.
 * Leans forgiving: if it can't find a `+CC` prefix, assumes the default
 * country (US/+1).
 */
export function parsePhone(raw: string | null | undefined): {
  dial: string;
  local: string;
} {
  if (!raw) return { dial: DEFAULT_COUNTRY_DIAL, local: '' };
  const trimmed = raw.trim();

  // Explicit +CC prefix — greedy match, then shrink until it's a code we
  // recognize. Covers 3-digit codes like +971 as well as +1 / +44.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    for (const len of [3, 2, 1]) {
      const maybe = digits.slice(0, len);
      if (COUNTRY_CODES.some((c) => c.dial === maybe)) {
        return { dial: maybe, local: digits.slice(len) };
      }
    }
  }

  // No recognizable country prefix — treat as default-country local.
  return { dial: DEFAULT_COUNTRY_DIAL, local: trimmed.replace(/\D/g, '') };
}

/**
 * formatLocal — render a bare local number in its country-appropriate
 * dash form. Only North America (NANP) has block conventions we enforce;
 * other codes fall back to digit-only / space-joined to avoid inventing
 * patterns we can't verify.
 */
function formatLocal(dial: string, localDigits: string): string {
  if (!localDigits) return '';
  if (dial === '1') {
    if (localDigits.length === 10) {
      return `${localDigits.slice(0, 3)}-${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
    }
    if (localDigits.length === 7) {
      return `${localDigits.slice(0, 3)}-${localDigits.slice(3)}`;
    }
  }
  return localDigits;
}

/**
 * formatPhone — human-readable form with country code always visible.
 * `+1-555-123-4567`. Missing input → empty string. Partial input (no
 * local digits) returns just the `+CC` prefix so the dropdown can show
 * something before the user types the number.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const { dial, local } = parsePhone(raw);
  const localFmt = formatLocal(dial, local);
  if (!localFmt) return `+${dial}`;
  return `+${dial}-${localFmt}`;
}

/**
 * normalizePhone — canonical storage form. Same output as formatPhone
 * today; kept as a distinct export so the intent at call sites is clear
 * ("I'm saving this" vs "I'm rendering this").
 */
export function normalizePhone(raw: string | null | undefined): string {
  return formatPhone(raw);
}

/**
 * composePhone — build the stored form from the dropdown's dial + the
 * user's local-number text. Used inside contact editors on every
 * keystroke so the hidden form value stays canonical.
 */
export function composePhone(dial: string, localRaw: string): string {
  const local = localRaw.replace(/\D/g, '');
  if (!local) return '';
  return normalizePhone(`+${dial}-${local}`);
}

/**
 * telHref — digits-only including country code, for `tel:` links so
 * the dialer gets an unambiguous number.
 */
export function telHref(raw: string | null | undefined): string {
  if (!raw) return '';
  const { dial, local } = parsePhone(raw);
  return `+${dial}${local}`;
}
