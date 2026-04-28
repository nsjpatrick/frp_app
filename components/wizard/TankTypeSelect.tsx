'use client';

import { useEffect, useState } from 'react';
import {
  TANK_TYPES,
  TANK_TYPE_BY_ID,
  TANK_TYPE_CATEGORY_ORDER,
} from '@/lib/catalog/tank-types';

/**
 * TankTypeSelect — full-width product-family dropdown for step 2.
 *
 * Client component so the hint text below the field reacts instantly to
 * the user's selection without a server round-trip. The <select> is a
 * plain form control (submits via `name="tankType"` with the parent
 * <form>), so no additional wiring is needed on the server action side.
 */

export function TankTypeSelect({ defaultValue }: { defaultValue?: string }) {
  // FRP Vessel is the workhorse — most quotes start there. We default to
  // it on a fresh quote so the form lands on a working configuration; the
  // rep can swap to a more specific type (Bryneer, mixing tank, etc.) and
  // get its tailored autofill. A persisted defaultValue still wins.
  const initial = defaultValue && TANK_TYPE_BY_ID[defaultValue] ? defaultValue : 'frp_vessel';
  const [value, setValue] = useState(initial);
  const current = TANK_TYPE_BY_ID[value];

  // Broadcast the selected tank-type so sibling client components in the
  // same step (e.g. the certifications section) can react without having
  // to be re-parented. Keeps the form markup flat while still letting
  // downstream sections conditionally show/hide fields like the RTP-1
  // class picker, which only applies when "ASME RTP-1 Vessel" is chosen.
  const broadcast = (next: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('tank-type:changed', { detail: { tankType: next } }),
    );
  };

  // On a fresh quote (no persisted tankType), fire the cascade once on
  // mount so picking up the FRP Vessel default actually fills in the
  // downstream chemistry / geometry / accessories defaults. We skip the
  // broadcast when the rev already has a saved tank type — reps who
  // customized away from the default shouldn't have their edits stomped
  // when they reload the page.
  useEffect(() => {
    if (!defaultValue) broadcast(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label className="glass-label" htmlFor="tankType">Product family</label>
      <select
        id="tankType"
        name="tankType"
        value={value}
        onChange={(e) => { setValue(e.target.value); broadcast(e.target.value); }}
        className="glass-input w-full"
        required
      >
        {TANK_TYPE_CATEGORY_ORDER.map((group) => (
          <optgroup key={group.category} label={group.label}>
            {TANK_TYPES
              .filter((t) => t.category === group.category)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
          </optgroup>
        ))}
      </select>

      {/* Description reacts to the current selection. Fixed two-line height
          so switching options doesn't nudge the rest of the form up/down. */}
      <p className="text-[12.5px] text-slate-500 leading-snug mt-2 min-h-[2.5em]">
        {current?.description ?? 'Pick a product family — defaults will fill in for chemistry, geometry, certs, and accessories.'}
      </p>
    </div>
  );
}
