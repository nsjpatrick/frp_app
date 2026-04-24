'use client';

import { useState, useTransition } from 'react';
import { MapPin } from 'lucide-react';
import { lookupSiteByPostal } from '@/lib/actions/site-lookup';

type Site = {
  indoor: boolean;
  seismic: { siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; Ss: number; S1: number; Ie: number; riskCategory: 'I' | 'II' | 'III' | 'IV' };
  wind:    { V: number; exposure: 'B' | 'C' | 'D'; Kzt: number; riskCategory: 'I' | 'II' | 'III' | 'IV' };
};

/**
 * Either "use this number as-is" or leave blank. Seismic Ss/S1 and wind V
 * start empty for fresh quotes so reps must either run the postal-code
 * lookup or type the values in — no silent defaults that would otherwise
 * let them advance past Step 1 without a real calculation. We serialize
 * the form as `siteJson` only when all three are numeric; the submit
 * button is tied to the same guard.
 */
const numStr = (n: number | null | undefined): string =>
  n != null && Number.isFinite(n) ? String(n) : '';

// Countries supported by Zippopotam.us that cover most real-world quotes.
// US sits first / default because ASCE 7-22 seismic values only cover
// US territory — non-US lookups will geocode but USGS returns nothing.
const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'MX', label: 'Mexico' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IT', label: 'Italy' },
  { code: 'ES', label: 'Spain' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'SE', label: 'Sweden' },
  { code: 'NO', label: 'Norway' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'JP', label: 'Japan' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'BR', label: 'Brazil' },
  { code: 'PR', label: 'Puerto Rico' },
];

export function SiteLookupSection({
  initial,
  defaultPostal,
  defaultCountry = 'US',
}: {
  initial: Site;
  /** Seed the postal-code input from whatever was on the last revision. */
  defaultPostal?: string;
  defaultCountry?: string;
}) {
  const [site, setSite]     = useState<Site>(initial);
  // Numeric fields that MUST be filled by a real seismic/wind calculation
  // live as strings so an empty input paints as empty rather than "0".
  // Populated either by the postal-code lookup or direct entry.
  const [ssStr, setSsStr] = useState<string>(numStr(initial.seismic?.Ss));
  const [s1Str, setS1Str] = useState<string>(numStr(initial.seismic?.S1));
  const [vStr,  setVStr]  = useState<string>(numStr(initial.wind?.V));
  const [country, setCountry] = useState(defaultCountry || 'US');
  const [postal, setPostal]   = useState(defaultPostal || '');
  const [lookupResult, setLookupResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleLookup = () => {
    if (!postal.trim()) {
      setLookupResult({ ok: false, msg: 'Enter a postal code first.' });
      return;
    }
    startTransition(async () => {
      const r = await lookupSiteByPostal(country, postal, site.seismic.siteClass, site.seismic.riskCategory);
      if ('seismic' in r) {
        setSite((s) => ({
          ...s,
          seismic: { ...s.seismic, Ss: r.seismic.Ss, S1: r.seismic.S1 },
          wind:    { ...s.wind,    V: r.wind ? r.wind.V : s.wind.V },
        }));
        setSsStr(String(r.seismic.Ss));
        setS1Str(String(r.seismic.S1));
        if (r.wind) setVStr(String(r.wind.V));
        setLookupResult({
          ok: true,
          msg: r.wind
            ? `${r.matchedAddress} · Wind ${r.wind.V} mph (${r.wind.note})`
            : `${r.matchedAddress} · Seismic populated. Wind outside zone map — enter manually.`,
        });
      } else {
        // Even on "unsupported country" we still surface the resolved
        // place name so the rep can confirm geocoding worked.
        const prefix = r.matchedAddress ? `${r.matchedAddress} — ` : '';
        setLookupResult({ ok: false, msg: prefix + r.error });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Postal-code row */}
      <div>
        <div className="grid grid-cols-[140px_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="site-country" className="glass-label">Country</label>
            <select
              id="site-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="glass-input"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="site-postal" className="glass-label">Postal / ZIP code</label>
            <input
              id="site-postal"
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } }}
              placeholder={country === 'US' ? '45014' : country === 'GB' ? 'SW1A 1AA' : country === 'CA' ? 'M5V 3A8' : 'Postal code'}
              className="glass-input font-mono tabular-nums"
              autoComplete="postal-code"
            />
          </div>
          <button
            type="button"
            onClick={handleLookup}
            disabled={pending || !postal.trim()}
            className="btn-glass text-[13px]"
          >
            {pending ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                Looking up…
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                Look up hazards
              </>
            )}
          </button>
        </div>
        <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">
          Pulls ASCE 7-22 seismic (USGS) + basic wind V (zone-based) for the
          geocoded point. Coverage is US + territories — international postal
          codes will geocode, but Ss/S₁/V must be entered manually or derived
          from a site-specific study.
        </p>
      </div>

      {lookupResult && (
        <div
          className={`glass-chip ${lookupResult.ok ? 'glass-tinted-emerald' : 'glass-tinted-rose'}`}
          role="status"
        >
          {lookupResult.ok ? '✓' : '!'} {lookupResult.msg}
        </div>
      )}

      {/* Seismic block */}
      <div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">Seismic (ASCE 7-22)</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="glass-label">Site class</label>
            <select
              value={site.seismic.siteClass}
              onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, siteClass: e.target.value as Site['seismic']['siteClass'] } })}
              className="glass-input"
            >
              {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label">Risk cat</label>
            <select
              value={site.seismic.riskCategory}
              onChange={(e) => setSite({
                ...site,
                seismic: { ...site.seismic, riskCategory: e.target.value as Site['seismic']['riskCategory'] },
                wind:    { ...site.wind,    riskCategory: e.target.value as Site['wind']['riskCategory'] },
              })}
              className="glass-input"
            >
              {(['I', 'II', 'III', 'IV'] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label">Ss (g)</label>
            <input
              type="number" step="any" min="0"
              required
              value={ssStr}
              onChange={(e) => {
                setSsStr(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setSite({ ...site, seismic: { ...site.seismic, Ss: n } });
              }}
              placeholder="Run lookup"
              className="glass-input"
            />
          </div>
          <div>
            <label className="glass-label">S₁ (g)</label>
            <input
              type="number" step="any" min="0"
              required
              value={s1Str}
              onChange={(e) => {
                setS1Str(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setSite({ ...site, seismic: { ...site.seismic, S1: n } });
              }}
              placeholder="Run lookup"
              className="glass-input"
            />
          </div>
          <div>
            <label className="glass-label">I<sub>e</sub></label>
            <input
              type="number" step="any"
              required
              value={site.seismic.Ie}
              onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, Ie: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
        </div>
        <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">
          Ss + S₁ are mandatory — derive them from the ASCE 7-22 lookup above or a site-specific seismic study.
        </p>
      </div>

      {/* Wind block */}
      <div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">Wind (ASCE 7-22)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="glass-label">Basic wind V (mph)</label>
            <input
              type="number" step="any" min="0"
              required
              value={vStr}
              onChange={(e) => {
                setVStr(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setSite({ ...site, wind: { ...site.wind, V: n } });
              }}
              placeholder="mph"
              className="glass-input"
            />
          </div>
          <div>
            <label className="glass-label">Exposure</label>
            <select
              value={site.wind.exposure}
              onChange={(e) => setSite({ ...site, wind: { ...site.wind, exposure: e.target.value as Site['wind']['exposure'] } })}
              className="glass-input"
            >
              {(['B', 'C', 'D'] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label">K<sub>zt</sub></label>
            <input
              type="number" step="any"
              value={site.wind.Kzt}
              onChange={(e) => setSite({ ...site, wind: { ...site.wind, Kzt: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
        </div>
      </div>

      {/* Persist the postal code alongside the site data so a later edit
          reseeds the input instead of making the rep look it up again. */}
      <input
        type="hidden"
        name="siteJson"
        value={JSON.stringify({ ...site, postal: { country, code: postal } })}
      />
    </div>
  );
}
