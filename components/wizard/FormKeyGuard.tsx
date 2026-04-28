'use client';

import { useEffect, useRef } from 'react';

/**
 * FormKeyGuard — prevents Enter from submitting the wizard form.
 *
 * Reps frequently hit Enter while filling number / select fields and
 * accidentally trip the action="save" submission, jumping a step ahead
 * with partial data. Browsers also "implicit-submit" any single-input
 * form on Enter, which is the wrong default for a multi-section
 * configurator.
 *
 * The guard mounts a hidden marker, walks up to the nearest parent
 * <form>, and swallows Enter on every focusable element EXCEPT
 * <textarea> (free-form notes still need newlines) and explicit submit
 * <button>s (so the rep clicking "Next" still advances). The user uses
 * the Next button to commit the step.
 */
export function FormKeyGuard() {
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest('form');
    if (!form) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName;
      // Allow newline-bearing inputs and buttons.
      if (tag === 'TEXTAREA') return;
      if (tag === 'BUTTON') return;
      // Composing IME → don't fight the input method editor.
      if ((e as unknown as { isComposing?: boolean }).isComposing) return;

      e.preventDefault();
    };

    form.addEventListener('keydown', handler);
    return () => form.removeEventListener('keydown', handler);
  }, []);

  return <div ref={anchorRef} aria-hidden style={{ display: 'none' }} />;
}
