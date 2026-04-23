'use client';

import { useEffect, useState } from 'react';

/**
 * TickerValue — animated odometer-style number display.
 *
 * Accepts a pre-formatted string (e.g. "$194,388" / "− $16,764" /
 * "50,112") and renders each digit in a rolling reel that slides to the
 * new position when the value changes. Non-digit characters ($, commas,
 * minus sign, spaces) are rendered statically alongside the reels so
 * the formatting stays intact.
 *
 * The first render is intentionally non-animated — reels start already
 * at their current digit so there's no "flash up from zero" on mount.
 * Subsequent updates slide the reel.
 *
 * The component is font-agnostic but relies on `font-variant-numeric:
 * tabular-nums` (applied at the call site) for a crisp line-up.
 */
export function TickerValue({
  value,
  className,
  durationMs = 450,
}: {
  value: string;
  className?: string;
  durationMs?: number;
}) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', fontVariantNumeric: 'tabular-nums' }}>
      {value.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <DigitReel key={`d-${i}`} digit={Number(ch)} durationMs={durationMs} />
        ) : (
          <span key={`s-${i}-${ch}`} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * One odometer digit. Stacks 0-9 vertically inside a 1em-tall viewport
 * and shifts the stack by translateY to show the active digit.
 *
 * `1.2em` line-height on the reel matches the default inline line-box
 * height so the container's baseline aligns with sibling text — without
 * this the ticker looks shifted up relative to currency symbols and
 * commas. Keep the reel's children at the same line-height so the stack
 * math (−digit × 1.2em) lands exactly on each digit.
 */
function DigitReel({ digit, durationMs }: { digit: number; durationMs: number }) {
  // Skip the transition on the very first paint so reels don't spin up
  // from 0 when the card first mounts.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const H = 1.2; // em — must match child line-height below.

  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        height: `${H}em`,
        lineHeight: `${H}em`,
        overflow: 'hidden',
        verticalAlign: 'baseline',
      }}
    >
      <span
        style={{
          display: 'block',
          transform: `translateY(-${digit * H}em)`,
          transition: mounted ? `transform ${durationMs}ms cubic-bezier(0.22, 0.72, 0.12, 1)` : 'none',
          willChange: 'transform',
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span key={d} style={{ display: 'block', height: `${H}em`, lineHeight: `${H}em` }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}
