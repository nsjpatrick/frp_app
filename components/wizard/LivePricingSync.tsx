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
      if (num('idIn')        != null) geometry.idIn        = num('idIn');
      if (num('ssHeightIn')  != null) geometry.ssHeightIn  = num('ssHeightIn');
      if (num('quantity')    != null) geometry.quantity    = num('quantity');
      if (form.querySelector('input[name="baffles"]')) {
        geometry.baffles = checked('baffles');
        const bc = num('baffleCount');
        if (bc != null) geometry.baffleCount = bc;
      }
      if (form.querySelector('input[name="stainlessStand"]')) {
        geometry.stainlessStand = checked('stainlessStand');
        if (get('stainlessGrade')) geometry.stainlessGrade = String(get('stainlessGrade'));
      }
      if (nozzles) geometry.nozzles = nozzles;

      // Service — just the knobs pricing engine uses. Chemistry name /
      // family / concentration don't affect price; only `postCure` does.
      const service: Record<string, unknown> = {};
      if (form.querySelector('input[name="postCure"]')) {
        service.postCure = checked('postCure');
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

      // Wall buildup — only the resin id.
      const wallBuildup: Record<string, unknown> = {};
      if (get('resinId')) wallBuildup.resinId = String(get('resinId'));

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
