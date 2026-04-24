'use client';

import { useState } from 'react';

/**
 * QuantityInput — controlled number input for Step 2's Quantity field.
 *
 * Used to broadcast its own `live-pricing:quantity` CustomEvent for the
 * right-rail preview. That's now handled by the generic `LivePricingSync`
 * delegate listener on the form, which picks up quantity alongside every
 * other pricing-relevant field. This component is kept as a client-side
 * controlled input so the value renders cleanly through React's lifecycle
 * (plain `<input defaultValue>` from a server component loses sync when
 * the revision JSON changes underneath it).
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
      onChange={(e) => setValue(e.target.value)}
      required
      className="glass-input"
    />
  );
}
