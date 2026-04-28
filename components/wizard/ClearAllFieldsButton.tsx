'use client';

import { useCallback, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { accessoriesSchema } from '@/lib/validators/entities';
import { getDefaultsForTankType } from '@/lib/catalog/tank-type-defaults';
import { resetRevisionToDefaults } from '@/lib/actions/revisions';

/**
 * ResetAllFieldsButton — top-bar affordance that resets the configurator
 * to FRP Vessel defaults (the same starting state a fresh quote shows).
 *
 * Behavior:
 *   - Wipes free-text inputs the rep types (chemical name, concentration)
 *   - Restores baseline defaults from `tank-type-defaults.frp_vessel`:
 *       size: 8 ft × 12 ft, freeboard: 1 ft, quantity: 1
 *       op temp: 80°F, design temp: 120°F
 *       op pressure: 0 psig, vacuum: 0 psig (atmospheric)
 *       resin: derakane-411-350 (Signia 411)
 *   - Resets accessories + nozzles to FRP Vessel defaults (mostly empty)
 *   - Broadcasts `live-pricing:patch` so the right-rail re-prices
 *     instantly without needing to touch any field
 *
 * Save state on the server is left alone. The rep can hit "Cancel"
 * (browser back) to restore the persisted values, or refine + Submit to
 * persist the new state.
 */
export function ClearAllFieldsButton({
  formSelector = 'form',
  quoteId,
  revLabel,
}: {
  formSelector?: string;
  /** When provided, Reset wipes the rev's persisted state via the server
   *  action AND clears the form. Without these we just clear the form. */
  quoteId?: string;
  revLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const onClick = useCallback(() => {
    const form = document.querySelector<HTMLFormElement>(formSelector);
    if (!form) return;

    const setControlValue = (
      el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
      value: string,
    ) => {
      const proto = el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, value);
    };

    const setNamed = (name: string, value: string | number | boolean) => {
      const el = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (!el) return;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        el.checked = !!value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      setControlValue(el, String(value));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const d = getDefaultsForTankType('frp_vessel');

    // ─── Service / chemistry / certs ─────────────────────────────
    setNamed('chemical', '');                          // free-text — wipe
    setNamed('chemicalFamily', d.service.chemicalFamily);
    setNamed('concentrationPct', '');                  // free-text — wipe
    setNamed('specificGravity', '');                   // free-text — wipe (placeholder still hints "1.20")
    setNamed('operatingTempF',  d.service.operatingTempF);
    setNamed('designTempF',     d.service.designTempF);
    setNamed('minAmbientTempF', d.service.minAmbientTempF);
    // Pressure + vacuum default to 0 (atmospheric) per jobcalc xls.
    // They remain related to size — engineering re-derives them from the
    // hydrostatic head once the rep enters geometry. We just reset to the
    // baseline atmospheric value here.
    setNamed('operatingPressurePsig', d.service.operatingPressurePsig);
    setNamed('vacuumPsig',            d.service.vacuumPsig);
    setNamed('postCure',              d.service.postCure);
    setNamed('installationLocation',  d.service.installationLocation);
    setNamed('tankColor',             d.service.tankColor);

    setNamed('asmeRtp1Class',         d.certs.asmeRtp1Class ?? '');
    setNamed('nsfAnsi61Required',     d.certs.nsfAnsi61Required);
    setNamed('nsfAnsi2Required',      d.certs.nsfAnsi2Required);
    setNamed('thirdPartyInspector',   d.certs.thirdPartyInspector);
    // ASTM + cert toggles — restore the schema defaults (D-3299 + D-4097
    // ON, D-5685 / PE Stamp / ICC-ES OFF) so the rep starts from the
    // standard FRP layup spec set.
    setNamed('astmD3299',             true);
    setNamed('astmD4097',             true);
    setNamed('astmD5685',             false);
    setNamed('peStamp',               false);
    setNamed('iccEsListed',           false);

    setNamed('resinId',               d.wallBuildup.resinId);
    setNamed('veilId',                d.wallBuildup.veilId);

    // ─── Geometry (form is in feet) ──────────────────────────────
    setNamed('orientation',  d.geometry.orientation);
    // Diameter + SS-height clear to empty strings on reset — FRP Vessel
    // defaults are null (the rep must enter real numbers), and the
    // pricing engine returns $0 until both are filled in.
    setNamed('idFt',         d.geometry.idIn       != null ? d.geometry.idIn       / 12 : '');
    setNamed('ssHeightFt',   d.geometry.ssHeightIn != null ? d.geometry.ssHeightIn / 12 : '');
    setNamed('freeboardFt',  d.geometry.freeboardIn / 12);  // 1 ft default
    setNamed('quantity',     1);                            // always 1 on clear

    // ─── Step 2 fields (when present on the page) ────────────────
    setNamed('topHead',         d.geometry.topHead);
    setNamed('bottom',          d.geometry.bottom);
    setNamed('doubleWall',      d.geometry.doubleWall);
    // Baffle toggle retired — drive the section via count alone.
    setNamed('baffleCount',     d.geometry.baffleCount > 0 ? d.geometry.baffleCount : 0);
    setNamed('baffleType',      d.geometry.baffleType);
    setNamed('standType',       d.geometry.stainlessStand ? 'ss316' : 'none');
    setNamed('standHeightFt',   4);
    setNamed('stainlessStand',  d.geometry.stainlessStand);

    // ─── JSON-encoded hidden inputs ──────────────────────────────
    setNamed('accessoriesJson', JSON.stringify(d.accessories));
    setNamed('nozzlesJson',     JSON.stringify(d.geometry.nozzles));

    // ─── Stateful client sections (Accessories, Nozzles) ─────────
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

    // ─── Live-pricing rail ──────────────────────────────────────
    // Broadcast nullable size as `null` so the LiveSummary clears any
    // residual idIn/ssHeightIn from before the reset. The pricing
    // engine's missing-dimensions guard then drops the unit price to $0.
    window.dispatchEvent(
      new CustomEvent('live-pricing:patch', {
        detail: {
          geometry: {
            orientation: d.geometry.orientation,
            idIn:        d.geometry.idIn,
            ssHeightIn:  d.geometry.ssHeightIn,
            freeboardIn: d.geometry.freeboardIn,
            quantity:    1,
            accessories: d.accessories,
            nozzles:     [],
          },
          service: {
            postCure: d.service.postCure,
            minAmbientTempF: d.service.minAmbientTempF,
          },
          certs:   {
            asmeRtp1Class: d.certs.asmeRtp1Class,
            nsfAnsi61Required: d.certs.nsfAnsi61Required,
            nsfAnsi2Required: d.certs.nsfAnsi2Required,
            thirdPartyInspector: d.certs.thirdPartyInspector,
          },
          wallBuildup: { resinId: d.wallBuildup.resinId, veilId: d.wallBuildup.veilId },
        },
      }),
    );

    // ─── Persist the reset on the server, then navigate ─────────
    // The form-clear above gives the rep instant visual feedback; the
    // server action wipes every JSON column on the revision so Step 2
    // state (accessories, nozzles, baffles, stand, etc.) actually
    // resets — not just the fields currently on the page. We then
    // force a full page navigation so every client component
    // (TankTypeSelect, AccessoriesSection, NozzleSchedule, …) re-mounts
    // from the freshly-reset server state — `router.refresh()` keeps
    // local React state and would let stale picks survive the reset.
    const m = window.location.pathname.match(/^\/quotes\/([^/]+)\/rev\/([^/]+)\//);
    const ids = quoteId && revLabel ? { quoteId, revLabel } : m ? { quoteId: m[1], revLabel: m[2] } : null;
    if (ids) {
      startTransition(async () => {
        try {
          await resetRevisionToDefaults(ids.quoteId, ids.revLabel);
        } catch {
          // Server action throws a Next.js redirect — that's expected;
          // anything else just falls through to the hard navigation.
        }
        window.location.assign(`/quotes/${ids.quoteId}/rev/${ids.revLabel}/step-1`);
      });
    }
  }, [formSelector, quoteId, revLabel]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-amber-700 transition-colors disabled:opacity-60"
      title="Reset every field on this and every other step to FRP Vessel defaults, then return to Step 1."
    >
      <RotateCcw className={`w-3.5 h-3.5 ${pending ? 'animate-spin' : ''}`} strokeWidth={2} aria-hidden />
      {pending ? 'Resetting…' : 'Reset all fields'}
    </button>
  );
}
