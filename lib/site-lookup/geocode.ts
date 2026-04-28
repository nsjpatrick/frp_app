/**
 * Geocoders for the seismic site lookup.
 *
 * - geocodeAddress    — free-form US address via the US Census geocoder.
 *                       Used by the legacy project-address flow.
 * - geocodePostalCode — postal / ZIP code via Zippopotam.us. Works for
 *                       ~60 countries; we use ISO-2 country codes.
 */

export async function geocodeAddress(address: string): Promise<
  | { lat: number; lng: number; matchedAddress: string }
  | null
> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`geocode failed: HTTP ${res.status}`);

  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;

  return {
    lat: match.coordinates.y,
    lng: match.coordinates.x,
    matchedAddress: match.matchedAddress,
  };
}

/**
 * Resolve a postal code to lat/lng via Zippopotam.us. Free, no auth,
 * covers ~60 countries. Country codes are ISO-3166-1 alpha-2.
 *
 * Per-country normalization (each is a real format quirk we hit when
 * reps paste codes from elsewhere):
 *   - **GB** — Zippopotam indexes outward codes only ("SW1A"), not full
 *     postcodes. Truncate "SW1A 1AA" → "SW1A".
 *   - **CA** — Canadian codes look like "M5V 3A8". Zippopotam takes the
 *     forward sortation area only ("M5V"). Truncate accordingly.
 *   - **NL** — "1011 AB" works; the alpha suffix is optional. Strip it.
 *   - **BR**, **PL** — accept both "12345-678" and "12345678"; strip the
 *     hyphen so Zippopotam's alphanumeric path matches.
 *   - All countries — strip whitespace and uppercase the alphanumeric
 *     portion, since some Zippopotam endpoints are case-sensitive.
 */
export async function geocodePostalCode(
  countryCode: string,
  postalCode: string,
): Promise<
  | { lat: number; lng: number; matchedAddress: string; countryCode: string; postalCode: string }
  | null
> {
  const country = countryCode.trim().toLowerCase();
  if (!country || !postalCode.trim()) return null;
  // Normalize: strip whitespace + hyphens, uppercase letters.
  let postal = postalCode.trim().replace(/[\s\-_]+/g, '').toUpperCase();
  if (!postal) return null;

  // Per-country trims so the rep can paste any common format and have it
  // map to the form Zippopotam actually indexes.
  if (country === 'gb' && postal.length > 4) {
    // Outward code only ("SW1A 1AA" → "SW1A")
    postal = postal.slice(0, postal.length - 3);
  } else if (country === 'ca' && postal.length === 6) {
    // FSA only ("M5V3A8" → "M5V")
    postal = postal.slice(0, 3);
  } else if (country === 'nl' && /^[0-9]{4}[A-Z]{2}$/.test(postal)) {
    // Drop the alpha suffix ("1011AB" → "1011")
    postal = postal.slice(0, 4);
  }

  // Zippopotam path is case-sensitive: country lowercase, postal stays
  // uppercase for letter-bearing codes (CA, GB, NL).
  const url = `https://api.zippopotam.us/${encodeURIComponent(country)}/${encodeURIComponent(postal)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`postal geocode failed: HTTP ${res.status}`);

  const data = await res.json();
  const place = Array.isArray(data?.places) && data.places[0];
  if (!place) return null;

  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const placeName = [place['place name'], place['state abbreviation'] ?? place.state].filter(Boolean).join(', ');
  return {
    lat,
    lng,
    matchedAddress: `${placeName} ${data['post code'] ?? postal}, ${data['country abbreviation'] ?? country.toUpperCase()}`,
    countryCode: String(data['country abbreviation'] ?? country.toUpperCase()),
    postalCode: String(data['post code'] ?? postal),
  };
}
