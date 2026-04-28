'use client';

import { useEffect, useState } from 'react';

/**
 * NsfToggles — only renders the NSF/ANSI 61 + NSF/ANSI 2 toggles when
 * the current configuration actually needs them. Per PTI convention:
 *
 *   - **Bryneer™** vessels are NSF 61 listed by default; the toggle is
 *     visible so the rep can confirm or opt out.
 *   - **Sodium hypochlorite** service (chemicalFamily = `hypochlorite`,
 *     or chemical text contains "hypochlorite" / "bleach") may need NSF
 *     61 depending on the application — visible for rep judgement.
 *   - **Every other FRP vessel** hides the toggles entirely. The form
 *     still submits `false` for both fields so the saved revision
 *     stays consistent.
 *
 * Listens for:
 *   - `tank-type:changed` (broadcast by `TankTypeSelect`) — reacts to
 *     the rep flipping between Bryneer and other types
 *   - `live-pricing:patch`  — service+certs+wallBuildup overlays
 *     dispatched by `LivePricingSync` capture the `chemicalFamily` etc.
 *     We listen here just to keep our visibility decision in sync.
 *   - DOM `input` / `change` on the form — covers manual edits the rep
 *     makes to the chemical name + family (LivePricingSync rebroadcasts
 *     anyway, but listening here too keeps us decoupled).
 */
export function NsfToggles({
  initialTankType,
  initialChemicalFamily,
  initialChemical,
  initialNsf61,
  initialNsf2,
}: {
  initialTankType: string | undefined;
  initialChemicalFamily: string | undefined;
  initialChemical: string | undefined;
  initialNsf61: boolean;
  initialNsf2: boolean;
}) {
  const [tankType, setTankType] = useState(initialTankType ?? '');
  const [family, setFamily]     = useState(initialChemicalFamily ?? '');
  const [chemical, setChemical] = useState(initialChemical ?? '');

  useEffect(() => {
    const onTankType = (e: Event) => {
      const id = (e as CustomEvent<{ tankType?: string }>).detail?.tankType;
      if (typeof id === 'string') setTankType(id);
    };
    const refreshFromDom = () => {
      const f = (document.querySelector('select[name="chemicalFamily"]') as HTMLSelectElement | null)?.value;
      const c = (document.querySelector('input[name="chemical"]') as HTMLInputElement | null)?.value;
      const t = (document.querySelector('select[name="tankType"]') as HTMLSelectElement | null)?.value;
      if (typeof f === 'string') setFamily(f);
      if (typeof c === 'string') setChemical(c);
      if (typeof t === 'string') setTankType(t);
    };
    window.addEventListener('tank-type:changed', onTankType);
    document.addEventListener('input', refreshFromDom);
    document.addEventListener('change', refreshFromDom);
    return () => {
      window.removeEventListener('tank-type:changed', onTankType);
      document.removeEventListener('input', refreshFromDom);
      document.removeEventListener('change', refreshFromDom);
    };
  }, []);

  const isHypochlorite = family === 'hypochlorite' || /hypochlorite|bleach/i.test(chemical);
  const isBryneer = tankType === 'bryneer' || tankType === 'brinemaker';
  const visible = isHypochlorite || isBryneer;

  // Hidden inputs are rendered when toggles are hidden so the form still
  // submits a consistent `nsfAnsi61Required` / `nsfAnsi2Required` payload.
  if (!visible) {
    return (
      <>
        <input type="hidden" name="nsfAnsi61Required" value={initialNsf61 ? 'on' : ''} />
        <input type="hidden" name="nsfAnsi2Required"  value={initialNsf2 ? 'on' : ''} />
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <label className="toggle-pill">
        <input type="checkbox" name="nsfAnsi61Required" defaultChecked={initialNsf61} />
        <span>NSF / ANSI 61</span>
        <span className="opacity-60 text-xs">potable water</span>
      </label>
      <label className="toggle-pill">
        <input type="checkbox" name="nsfAnsi2Required" defaultChecked={initialNsf2} />
        <span>NSF / ANSI 2</span>
        <span className="opacity-60 text-xs">food contact</span>
      </label>
      <span className="text-[12px] text-slate-500 self-center ml-2">
        Optional — {isBryneer ? 'Bryneer™ ships NSF 61 listed by default.' : 'sodium hypochlorite service may require NSF 61 listing.'}
      </span>
    </div>
  );
}
