/**
 * Geocode a free-form US address using the US Census Bureau's free Geocoder API.
 * https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
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
