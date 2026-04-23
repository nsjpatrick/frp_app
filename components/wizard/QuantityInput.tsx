'use client';

import { useState } from 'react';

/**
 * QuantityInput — drop-in replacement for the plain <input> on Step 2's
 * Quantity field. Dispatches a `live-pricing:quantity` CustomEvent on
 * every keystroke so the right-rail `LiveSummary` can update in real
 * time without server roundtrips.
 *
 * Still a regular form control: `name="quantity"` and `type="number"`
 * so the surrounding Server-Action form submits the value the same way
 * the previous plain input did.
 */
export function QuantityInput({ defaultValue }: { defaultValue: number }) {
  const [value, setValue] = useState<string>(String(defaultValue));

  return (
    <input
      type="number"
      min={1}
      max={99}
      step={1}
      name="quantity"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n > 0) {
          window.dispatchEvent(
            new CustomEvent('live-pricing:quantity', { detail: { quantity: Math.floor(n) } }),
          );
        }
      }}
      required
      className="glass-input"
    />
  );
}
