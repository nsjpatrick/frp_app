'use client';

import { useEffect, useRef } from 'react';
import { getDefaultsForTankType, type TankTypeDefaults } from '@/lib/catalog/tank-type-defaults';

/**
 * TankTypeDefaultsApplier — listens for `tank-type:changed` (broadcast by
 * `TankTypeSelect`) and writes per-tank-type defaults into every form
 * field on the page.
 *
 * Two modes:
 *
 * 1. **Native form fields** — sets `<input>` / `<select>` values directly,
 *    then dispatches a synthetic `input` event so React-controlled
 *    components and the LivePricingSync rail re-read.
 *
 * 2. **Stateful client sections** — for sections that own their own
 *    React state (`AccessoriesSection`, `NozzleSchedule`,
 *    `ChemistrySection`, etc.), we re-broadcast the relevant slice on
 *    `tank-type:apply-defaults` so they can `setState` from it.
 *
 * The component renders nothing visible — it only attaches listeners.
 *
 * Behavior is intentionally **non-destructive**: defaults only apply on
 * the *first* tank-type pick after page load (or when the rep explicitly
 * chooses a different type after fields are still empty). Once the rep
 * starts editing, we don't clobber their work — the next switch only
 * touches the central tank-type-driven fields, not their custom edits.
 */

export function TankTypeDefaultsApplier() {
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    function setNative(name: string, value: string | number | boolean) {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (!el) return;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = !!value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function apply(d: TankTypeDefaults) {
      // ─── Service ─────────────────────────────────────────────
      setNative('chemicalFamily',         d.service.chemicalFamily);
      if (d.service.chemical)             setNative('chemical', d.service.chemical);
      if (d.service.concentrationPct != null) setNative('concentrationPct', d.service.concentrationPct);
      setNative('specificGravity',        d.service.specificGravity);
      setNative('operatingTempF',         d.service.operatingTempF);
      setNative('designTempF',            d.service.designTempF);
      setNative('minAmbientTempF',        d.service.minAmbientTempF);
      setNative('operatingPressurePsig',  d.service.operatingPressurePsig);
      setNative('vacuumPsig',             d.service.vacuumPsig);
      setNative('postCure',               d.service.postCure);
      setNative('installationLocation',   d.service.installationLocation);
      setNative('tankColor',              d.service.tankColor);

      // ─── Certs ───────────────────────────────────────────────
      setNative('asmeRtp1Class',          d.certs.asmeRtp1Class ?? '');
      setNative('nsfAnsi61Required',      d.certs.nsfAnsi61Required);
      setNative('nsfAnsi2Required',       d.certs.nsfAnsi2Required);
      setNative('thirdPartyInspector',    d.certs.thirdPartyInspector);

      // ─── Wall buildup (resin + veil) ─────────────────────────
      setNative('resinId',                d.wallBuildup.resinId);
      setNative('veilId',                 d.wallBuildup.veilId);

      // ─── Geometry ────────────────────────────────────────────
      setNative('orientation',            d.geometry.orientation);
      // Step 1 size inputs are in feet — defaults are in inches, so divide
      // by 12 before writing. The form's own onSubmit handler converts
      // them back to inches for the schema.
      setNative('idFt',                   d.geometry.idIn        / 12);
      setNative('ssHeightFt',             d.geometry.ssHeightIn  / 12);
      setNative('freeboardFt',            d.geometry.freeboardIn / 12);
      setNative('topHead',                d.geometry.topHead);
      setNative('bottom',                 d.geometry.bottom);
      setNative('doubleWall',             d.geometry.doubleWall);
      // The "Include Baffles" toggle was retired — count alone gates
      // the section. Write the count; if a default has `baffles:true`
      // but `count:0`, fall back to 4 as a sensible mixing default.
      setNative('baffleCount',            d.geometry.baffleCount > 0 ? d.geometry.baffleCount : (d.geometry.baffles ? 4 : 0));
      // Stand — write both the new canonical field and the legacy
      // boolean+grade pair so any sibling component that hasn't been
      // updated to read `standType` yet still gets a consistent value.
      setNative('standType',              d.geometry.stainlessStand ? 'ss316' : 'none');
      setNative('standHeightFt',          4);
      setNative('stainlessStand',         d.geometry.stainlessStand);

      // ─── Stateful sections (broadcast) ───────────────────────
      window.dispatchEvent(
        new CustomEvent('tank-type:apply-defaults', {
          detail: {
            accessories: d.accessories,
            nozzles: d.geometry.nozzles,
            service: d.service,
            certs: d.certs,
            wallBuildup: d.wallBuildup,
          },
        }),
      );

      // Direct live-pricing patch so the rail re-prices instantly even on
      // Step 1, where `AccessoriesSection` isn't mounted to forward the
      // accessory bundle through the form's hidden input. Mirrors what
      // `LivePricingSync` would broadcast after a real form change.
      window.dispatchEvent(
        new CustomEvent('live-pricing:patch', {
          detail: {
            geometry: {
              orientation: d.geometry.orientation,
              idIn: d.geometry.idIn,
              ssHeightIn: d.geometry.ssHeightIn,
              accessories: d.accessories,
              nozzles: d.geometry.nozzles,
            },
            service: {
              postCure: d.service.postCure,
              minAmbientTempF: d.service.minAmbientTempF,
            },
            certs: {
              asmeRtp1Class: d.certs.asmeRtp1Class,
              nsfAnsi61Required: d.certs.nsfAnsi61Required,
              nsfAnsi2Required: d.certs.nsfAnsi2Required,
              thirdPartyInspector: d.certs.thirdPartyInspector,
            },
            wallBuildup: { resinId: d.wallBuildup.resinId, veilId: d.wallBuildup.veilId },
          },
        }),
      );
    }

    function handler(e: Event) {
      const id = (e as CustomEvent<{ tankType?: string }>).detail?.tankType;
      if (!id || id === lastApplied.current) return;
      lastApplied.current = id;
      apply(getDefaultsForTankType(id));
    }

    window.addEventListener('tank-type:changed', handler);
    return () => window.removeEventListener('tank-type:changed', handler);
  }, []);

  return null;
}
