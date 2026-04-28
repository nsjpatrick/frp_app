'use client';

import { useEffect, useRef } from 'react';

/**
 * LivePricingSync — drops a delegate form listener into Step 1 and Step 2
 * so the right-rail LiveSummary can react to ANY field change, not just
 * the quantity event Step 2 already broadcasts.
 *
 * How it works:
 *   1. This component mounts a hidden marker <div> inside its parent
 *      <form>. On mount it walks up to the nearest <form> element and
 *      attaches `input` + `change` listeners.
 *   2. On every keystroke / select change / checkbox toggle, it reads a
 *      FormData snapshot, plucks out the fields the pricing engine cares
 *      about, and dispatches a `live-pricing:patch` CustomEvent carrying
 *      that partial inputs shape.
 *   3. LiveSummary listens for `live-pricing:patch`, merges into its
 *      internal inputs state, and re-runs `computePricing`. The ticker
 *      re-rolls as the rep types.
 *
 * Why a delegate form listener instead of per-component broadcasts:
 * most wizard form fields are still server-rendered `<input>`s + native
 * `<select>`s (no React state). We'd need to convert every one to a
 * client component to get onChange. This single client marker captures
 * everything with zero surgery.
 *
 * Fields read below match the `PricingInputs` shape in
 * lib/pricing/pricing-engine.ts. Adding a new pricing-relevant field
 * means adding one line here and one line in the engine — the rest of
 * the UI keeps working unchanged.
 */
export function LivePricingSync() {
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest('form');
    if (!form) return;

    const read = () => {
      const data = new FormData(form);
      const get = (k: string) => data.get(k);
      const checked = (k: string) =>
        !!(form.querySelector(`input[name="${k}"]`) as HTMLInputElement | null)?.checked;
      const num = (k: string): number | undefined => {
        const v = get(k);
        if (v == null || v === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      // Geometry — Step 2 owns these, but pricing engine reads them all
      // the time. Some fields come via hidden JSON (`nozzlesJson`).
      const nozzles = (() => {
        try {
          const raw = get('nozzlesJson');
          if (!raw) return undefined;
          const parsed = JSON.parse(String(raw));
          return Array.isArray(parsed) ? parsed : undefined;
        } catch {
          return undefined;
        }
      })();

      const geometry: Record<string, unknown> = {};
      if (get('orientation'))  geometry.orientation = String(get('orientation'));
      // Step 1 captures dimensions in feet; the pricing engine works in
      // inches. Convert at the seam so the rest of the engine stays unit-
      // consistent.
      const idFt        = num('idFt');
      const ssHeightFt  = num('ssHeightFt');
      const freeboardFt = num('freeboardFt');
      if (idFt        != null) geometry.idIn        = idFt        * 12;
      if (ssHeightFt  != null) geometry.ssHeightIn  = ssHeightFt  * 12;
      if (freeboardFt != null) geometry.freeboardIn = freeboardFt * 12;
      if (num('quantity')    != null) geometry.quantity    = num('quantity');
      // Baffles — count > 0 is the on/off signal now that the explicit
      // toggle was retired. We infer `baffles: true/false` from the count
      // so the pricing engine's existing gate keeps working.
      if (form.querySelector('input[name="baffleCount"]')) {
        const bc = num('baffleCount');
        if (bc != null) {
          geometry.baffleCount = bc;
          geometry.baffles = bc > 0;
        }
        const bl = num('baffleLengthFt');
        if (bl != null) geometry.baffleLengthFt = bl;
      }
      if (form.querySelector('input[name="stainlessStand"]')) {
        geometry.stainlessStand = checked('stainlessStand');
        if (get('stainlessGrade')) geometry.stainlessGrade = String(get('stainlessGrade'));
      }
      if (form.querySelector('select[name="standType"]')) {
        geometry.standType = String(get('standType'));
      }
      if (num('standHeightFt') != null) geometry.standHeightFt = num('standHeightFt');
      if (form.querySelector('input[name="doubleWall"]')) {
        geometry.doubleWall = checked('doubleWall');
      }
      if (form.querySelector('select[name="topHead"]') ||
          form.querySelector('input[name="topHead"]')) {
        const top = String(get('topHead') ?? '');
        if (top) geometry.topHead = top;
      }
      if (form.querySelector('select[name="bottom"]') ||
          form.querySelector('input[name="bottom"]')) {
        const bot = String(get('bottom') ?? '');
        if (bot) geometry.bottom = bot;
      }
      if (nozzles) geometry.nozzles = nozzles;

      // Accessories — same JSON-in-hidden-input pattern as nozzles, so any
      // toggle in `AccessoriesSection` re-broadcasts the whole accessory
      // bundle and the rail re-prices instantly.
      try {
        const raw = get('accessoriesJson');
        if (raw) {
          const parsed = JSON.parse(String(raw));
          if (parsed && typeof parsed === 'object') {
            geometry.accessories = parsed;
          }
        }
      } catch {
        /* ignore — bad JSON just means stale broadcast */
      }
      if (form.querySelector('select[name="baffleType"]')) {
        const bt = String(get('baffleType') ?? 'plate');
        if (bt === 'plate' || bt === 'wedge') geometry.baffleType = bt;
      }

      // Service — just the knobs pricing engine uses. Chemistry name /
      // family / concentration don't affect price; only `postCure` and
      // `minAmbientTempF` (HTD ΔT driver) do.
      const service: Record<string, unknown> = {};
      if (form.querySelector('input[name="postCure"]')) {
        service.postCure = checked('postCure');
      }
      if (num('minAmbientTempF') != null) {
        service.minAmbientTempF = num('minAmbientTempF');
      }

      // Certs — RTP-1 class + NSF toggles + inspector.
      const certs: Record<string, unknown> = {};
      if (get('asmeRtp1Class') !== null) {
        const v = String(get('asmeRtp1Class') ?? '').trim();
        certs.asmeRtp1Class = v || null;
      }
      if (form.querySelector('input[name="nsfAnsi61Required"]')) {
        certs.nsfAnsi61Required = checked('nsfAnsi61Required');
      }
      if (form.querySelector('input[name="nsfAnsi2Required"]')) {
        certs.nsfAnsi2Required = checked('nsfAnsi2Required');
      }
      if (get('thirdPartyInspector')) {
        certs.thirdPartyInspector = String(get('thirdPartyInspector'));
      }

      // Wall buildup — resin + surface veil.
      const wallBuildup: Record<string, unknown> = {};
      if (get('resinId')) wallBuildup.resinId = String(get('resinId'));
      if (get('veilId'))  wallBuildup.veilId  = String(get('veilId'));

      return { geometry, service, certs, wallBuildup };
    };

    const broadcast = () => {
      const patch = read();
      window.dispatchEvent(
        new CustomEvent('live-pricing:patch', { detail: patch }),
      );
    };

    // Prime the rail on mount so the first render of LiveSummary gets
    // the current form state — saves a flicker between the server-
    // rendered pricing and the live-computed one once the rep touches
    // any field.
    broadcast();

    form.addEventListener('input', broadcast);
    form.addEventListener('change', broadcast);
    return () => {
      form.removeEventListener('input', broadcast);
      form.removeEventListener('change', broadcast);
    };
  }, []);

  return <div ref={anchorRef} aria-hidden style={{ display: 'none' }} />;
}
