'use client';

import { useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { cloneQuoteForEdit } from '@/lib/actions/quotes';

/**
 * EditRevisionButton — quote-detail-page Edit affordance.
 *
 * Mirrors the queue's 3-dot-menu Edit option: clones the latest revision
 * into the next letter (A → B → …) and drops the rep into Step 1 of the
 * new rev. The original rev stays untouched as a historical snapshot.
 *
 * Implemented as a client wrapper around `cloneQuoteForEdit` (a server
 * action) so we can show a pending spinner while the redirect resolves.
 * The server action handles the actual revision insert, audit entry, and
 * redirect — this button is just the trigger.
 */
export function EditRevisionButton({
  quoteId,
  currentLabel,
}: {
  quoteId: string;
  /** Current latest rev letter, used for the "→ Rev B" hint chip. */
  currentLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const formData = new FormData();
    formData.set('quoteId', quoteId);
    // Fire-and-forget: cloneQuoteForEdit redirects, which unmounts this tree.
    startTransition(() => { void cloneQuoteForEdit(formData); });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Edit (creates Rev ${nextLetter(currentLabel)})`}
      className="btn-glass !px-2.5 !py-1.5 !text-[12.5px] disabled:opacity-60"
    >
      {pending ? (
        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
      ) : (
        <Pencil className="w-3.5 h-3.5" aria-hidden />
      )}
      <span>{pending ? 'Cloning…' : 'Edit'}</span>
      {!pending && (
        <span className="ml-1 text-[10.5px] text-slate-400 font-mono">
          → Rev {nextLetter(currentLabel)}
        </span>
      )}
    </button>
  );
}

// Client-side mirror of `nextRevisionLabel` from lib/actions/quotes.ts —
// for the UI hint only; the server is still the source of truth on click.
function nextLetter(label: string): string {
  if (!label) return 'A';
  const last = label[label.length - 1];
  if (last >= 'A' && last < 'Z') {
    return label.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  }
  return label + 'A';
}
