'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { cloneQuoteForEdit, deleteQuote } from '@/lib/actions/quotes';

/**
 * QuoteRowMenu — 3-dot menu at the end of every quotes-table row. Mirrors
 * CustomerRowMenu's structure: popover with Edit + Delete, each option
 * spawning its own confirm modal (delete) or triggering a server action
 * directly (edit kicks off a revision clone + wizard redirect).
 */

type Props = {
  quoteId: string;
  quoteNumber: string;
  currentLabel: string;
};

export function QuoteRowMenu({ quoteId, quoteNumber, currentLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'delete' | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [editPending, startEditTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onEdit = () => {
    setOpen(false);
    const formData = new FormData();
    formData.set('quoteId', quoteId);
    // Fire-and-forget: cloneQuoteForEdit redirects, which unmounts this tree.
    startEditTransition(() => { void cloneQuoteForEdit(formData); });
  };

  return (
    <>
      <div ref={wrapRef} className="relative inline-block">
        <button
          type="button"
          aria-label={`Actions for ${quoteNumber}`}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={editPending}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          <MoreHorizontal className="w-4 h-4" aria-hidden />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-white rounded-xl border border-slate-200 p-1"
            style={{ boxShadow: '0 10px 30px -8px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(15, 23, 42, 0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={onEdit}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px] text-slate-700 hover:bg-slate-100 text-left transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" aria-hidden />
              <span>Edit</span>
              <span className="ml-auto text-[11px] text-slate-400 font-mono">
                → Rev {nextLetter(currentLabel)}
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setMode('delete'); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px] text-rose-700 hover:bg-rose-50 text-left transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
              Delete
            </button>
          </div>
        )}
      </div>

      {mode === 'delete' && (
        <DeleteQuoteModal
          quoteId={quoteId}
          quoteNumber={quoteNumber}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

// Client-side mirror of lib/actions/quotes.ts `nextRevisionLabel` for the
// UI hint only — the server is still the source of truth on submit.
function nextLetter(label: string): string {
  if (!label) return 'A';
  const last = label[label.length - 1];
  if (last >= 'A' && last < 'Z') {
    return label.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  }
  return label + 'A';
}

function DeleteQuoteModal({
  quoteId,
  quoteNumber,
  onClose,
}: {
  quoteId: string;
  quoteNumber: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [pending, startTransition] = useTransition();

  const close = () => { if (!pending) onClose(); };
  const canSubmit = !pending && confirmText.trim().toLowerCase() === 'delete';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set('quoteId', quoteId);
    startTransition(async () => {
      try {
        await deleteQuote(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete.');
      }
    });
  };

  return typeof document !== 'undefined'
    ? createPortal(
        <>
          <div
            onClick={close}
            aria-hidden
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0, left: 0,
              zIndex: 60,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
            }}
          />
          <div
            className="flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-quote-title"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 70 }}
          >
            <div
              className="pointer-events-auto relative bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col"
              style={{
                width: 'min(460px, calc(100vw - 2rem))',
                boxShadow:
                  '0 30px 80px -20px rgba(15, 23, 42, 0.55), 0 4px 12px rgba(15, 23, 42, 0.10)',
              }}
            >
              <form onSubmit={handleSubmit}>
                <div className="px-6 pt-6 pb-5">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                      <AlertTriangle className="w-5 h-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3
                        id="delete-quote-title"
                        className="text-[16px] font-semibold tracking-tight text-slate-900"
                      >
                        Delete {quoteNumber}?
                      </h3>
                      <p className="text-[13.5px] text-slate-600 mt-1.5 leading-snug">
                        Removes the quote and every revision underneath. This cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="delete-quote-confirm" className="glass-label">
                      Type <span className="font-mono text-rose-700">delete</span> to confirm
                    </label>
                    <input
                      id="delete-quote-confirm"
                      autoFocus
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="glass-input"
                    />
                  </div>

                  {error && (
                    <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-900">
                      <span className="font-semibold">Couldn&apos;t delete.</span> {error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60">
                  <button type="button" onClick={close} disabled={pending} className="btn-glass text-[13.5px]">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600 text-white text-[13.5px] font-medium hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {pending ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                        Delete Quote
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>,
        document.body,
      )
    : null;
}
