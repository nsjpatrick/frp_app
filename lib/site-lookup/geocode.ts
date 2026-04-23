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
 * covers most of North America + Europe + a handful of APAC countries.
 * Country codes are ISO-3166-1 alpha-2 (US, CA, MX, GB, DE, …).
 */
export async function geocodePostalCode(
  countryCode: string,
  postalCode: string,
): Promise<
  | { lat: number; lng: number; matchedAddress: string; countryCode: string; postalCode: string }
  | null
> {
  const country = countryCode.trim().toLowerCase();
  let postal    = postalCode.trim().replace(/\s+/g, '');
  if (!country || !postal) return null;

  // UK quirk: Zippopotam only indexes outward codes ("SW1A"), not full
  // postcodes ("SW1A1AA"). Truncate to the outward portion when the user
  // pastes a full one so the happy path covers both forms.
  if (country === 'gb' && postal.length > 4) {
    postal = postal.slice(0, postal.length - 3).toUpperCase();
  }

  const url = `https://api.zippopotam.us/${encodeURIComponent(country)}/${encodeURIComponent(postal)}`;
  const res = await fetch(url);
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
