'use client';

import { useState, useTransition } from 'react';
import { lookupSiteByAddress } from '@/lib/actions/site-lookup';

type Site = {
  indoor: boolean;
  seismic: { siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; Ss: number; S1: number; Ie: number; riskCategory: 'I' | 'II' | 'III' | 'IV' };
  wind: { V: number; exposure: 'B' | 'C' | 'D'; Kzt: number; riskCategory: 'I' | 'II' | 'III' | 'IV' };
};

export function SiteLookupSection({ initial, siteAddress }: { initial: Site; siteAddress: string }) {
  const [site, setSite] = useState<Site>(initial);
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleLookup = () => {
    startTransition(async () => {
      const r = await lookupSiteByAddress(siteAddress, site.seismic.siteClass, site.seismic.riskCategory);
      if ('error' in r) {
        setLookupResult(`Error: ${r.error}`);
      } else {
        setSite((s) => ({
          ...s,
          seismic: { ...s.seismic, Ss: r.seismic.Ss, S1: r.seismic.S1 },
        }));
        setLookupResult(`Looked up ${r.matchedAddress}`);
      }
    });
  };

  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Site & Environmental</h3>

      <div className="flex items-end gap-2">
        <div className="text-xs text-gray-500">Site address (from project): <strong>{siteAddress || 'none'}</strong></div>
        <button type="button" onClick={handleLookup} disabled={pending || !siteAddress}
                className="ml-auto rounded bg-slate-700 text-white px-3 py-1 text-xs disabled:opacity-50">
          {pending ? 'Looking up…' : 'Look up seismic from USGS'}
        </button>
      </div>
      {lookupResult && <p className="text-xs text-gray-600">{lookupResult}</p>}

      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-gray-600">Site class</span>
          <select value={site.seismic.siteClass} onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, siteClass: e.target.value as Site['seismic']['siteClass'] } })} className="w-full rounded border px-2 py-1">
            {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">Risk category</span>
          <select value={site.seismic.riskCategory} onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, riskCategory: e.target.value as Site['seismic']['riskCategory'] }, wind: { ...site.wind, riskCategory: e.target.value as Site['wind']['riskCategory'] } })} className="w-full rounded border px-2 py-1">
            {(['I', 'II', 'III', 'IV'] as const).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">Importance Ie</span>
          <input type="number" step="any" value={site.seismic.Ie} onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, Ie: Number(e.target.value) } })} className="w-full rounded border px-2 py-1" />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-gray-600">Ss (g)</span>
          <input type="number" step="any" value={site.seismic.Ss} onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, Ss: Number(e.target.value) } })} className="w-full rounded border px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">S1 (g)</span>
          <input type="number" step="any" value={site.seismic.S1} onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, S1: Number(e.target.value) } })} className="w-full rounded border px-2 py-1" />
        </label>
        <div />

        <label className="space-y-1">
          <span className="text-xs text-gray-600">Wind V (mph)</span>
          <input type="number" step="any" value={site.wind.V} onChange={(e) => setSite({ ...site, wind: { ...site.wind, V: Number(e.target.value) } })} className="w-full rounded border px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">Exposure</span>
          <select value={site.wind.exposure} onChange={(e) => setSite({ ...site, wind: { ...site.wind, exposure: e.target.value as Site['wind']['exposure'] } })} className="w-full rounded border px-2 py-1">
            {(['B', 'C', 'D'] as const).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">Kzt</span>
          <input type="number" step="any" value={site.wind.Kzt} onChange={(e) => setSite({ ...site, wind: { ...site.wind, Kzt: Number(e.target.value) } })} className="w-full rounded border px-2 py-1" />
        </label>
      </div>

      <input type="hidden" name="siteJson" value={JSON.stringify(site)} />
    </section>
  );
}
