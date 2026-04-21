'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, AlertTriangle } from 'lucide-react';

/**
 * SendQuoteButton — kicks off the "send quote" flow on Review & Generate.
 *
 * Two things happen when the user confirms:
 *   1. Internal: the engineering specification JSON is filed into the
 *      project's engineering folder (V1 pilot: this is a mock/placeholder —
 *      we'll wire the actual filer in Plan 3 / 4 once a shared project
 *      store exists).
 *   2. Customer: a `mailto:` URL opens the rep's default mail client
 *      pre-addressed to the customer contact, with a plain-text quote
 *      summary (pricing + key details) — NEVER the engineering JSON.
 *
 * Modal layering: uses stacked `fixed inset-0` elements at z-[60] (backdrop)
 * and z-[70] (modal wrapper). Nav is z-40, so both always sit on top. Modal
 * wrapper is pointer-events-none with pointer-events-auto on the card, so
 * clicks on the backdrop (not the card) dismiss. Both are opaque — no
 * backdrop-filter, Safari-safe.
 */

export function SendQuoteButton({
  quoteNumber,
  customerCompany,
  customerContact,
  customerEmail,
  customerBody,
}: {
  quoteNumber: string;
  customerCompany: string;
  customerContact: string | null;
  customerEmail: string | null;
  customerBody: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSend = () => {
    const subject = encodeURIComponent(quoteNumber);
    const body = encodeURIComponent(customerBody);
    const to = encodeURIComponent(customerEmail ?? '');
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-glass-prominent"
      >
        <Send className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        Send Quote
      </button>

      {/* Portal to document.body so the overlay escapes ancestors that
          become containing blocks for fixed-positioned descendants
          (.glass-raised has backdrop-filter, which does exactly that).
          Without this, the "fixed inset-0" only covers the wizard's
          middle column instead of the viewport. */}
      {open && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop — full viewport, above every other layer.
              Using inline rgba rather than Tailwind's `bg-slate-900/75`
              because some Safari versions inconsistently compile Tailwind v4's
              color-mix() opacity syntax, leaving the backdrop invisible. */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 60,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
            }}
          />
          {/* Modal container — also full viewport so we can center the card. */}
          <div
            className="flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-quote-title"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 70,
            }}
          >
            <div
              className="pointer-events-auto relative bg-white rounded-3xl border border-slate-200 p-7 w-full max-w-md"
              style={{
                boxShadow:
                  '0 30px 80px -20px rgba(15, 23, 42, 0.55), 0 4px 12px rgba(15, 23, 42, 0.10)',
              }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>

              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" strokeWidth={2.25} aria-hidden />
                </div>
                <div className="pt-1">
                  <h3 id="send-quote-title" className="text-[17px] font-semibold tracking-tight text-slate-900">
                    Send Quote {quoteNumber}?
                  </h3>
                  <p className="text-[14px] text-slate-600 leading-relaxed mt-1.5">
                    We&apos;ll send the specification JSON to engineering and file it in
                    the appropriate project folder. A customer-facing quote summary
                    (pricing and scope, no engineering detail) will open in your mail
                    client for <strong className="text-slate-800">{customerContact ?? customerCompany}</strong>
                    {customerEmail ? (
                      <>
                        {' '}at <span className="font-mono text-[13px] text-slate-700">{customerEmail}</span>
                      </>
                    ) : null}.
                  </p>
                  <p className="text-[13px] text-slate-500 leading-relaxed mt-2">
                    Are you sure you&apos;ve reviewed all options?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-glass text-[13.5px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  className="btn-glass-prominent"
                >
                  <Send className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                  Yes, Send Quote
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
