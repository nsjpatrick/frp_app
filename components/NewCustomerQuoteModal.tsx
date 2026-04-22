'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';
import { createCustomerAndQuote } from '@/lib/actions/customers';
import { ContactsEditor, EMPTY_CONTACT, type ContactRow } from '@/components/ContactsEditor';

/**
 * NewCustomerQuoteModal — inline "New Customer" flow on the start-a-quote
 * page. Same expandable-contacts UX as the dashboard's NewCustomerModal,
 * but on save the server action creates the customer AND a fresh (project-
 * less) quote, then redirects straight into the configurator wizard.
 */

export function NewCustomerQuoteModal({
  triggerLabel = '+ New Customer',
  triggerClassName = 'btn-glass text-[13px]',
}: {
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([{ ...EMPTY_CONTACT }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  const reset = () => {
    setCompany('');
    setContacts([{ ...EMPTY_CONTACT }]);
    setError(null);
  };
  const close = () => { setOpen(false); reset(); };

  const canSubmit = company.trim().length > 0 && contacts[0]?.name.trim().length > 0;

  const handleAction = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await createCustomerAndQuote(formData);
      } catch (e) {
        if (e && typeof e === 'object' && 'digest' in e && String((e as any).digest).startsWith('NEXT_REDIRECT')) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not save.');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => !pending && close()}
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
            aria-labelledby="new-customer-quote-title"
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0, left: 0,
              zIndex: 70,
            }}
          >
            <div
              className="pointer-events-auto relative bg-white rounded-3xl border border-slate-200 w-full max-w-xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col"
              style={{
                boxShadow:
                  '0 30px 80px -20px rgba(15, 23, 42, 0.55), 0 4px 12px rgba(15, 23, 42, 0.10)',
              }}
            >
              <form action={handleAction} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h3
                      id="new-customer-quote-title"
                      className="text-[17px] font-semibold tracking-tight text-slate-900"
                    >
                      New Customer
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      Company and contacts. On save we&apos;ll start a quote for them.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={close}
                    disabled={pending}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">
                  <div>
                    <label htmlFor="new-customer-quote-name" className="glass-label">
                      Company Name
                    </label>
                    <input
                      id="new-customer-quote-name"
                      name="name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                      autoFocus
                      placeholder="e.g. Acme Chem Co."
                      className="glass-input"
                    />
                  </div>

                  <ContactsEditor contacts={contacts} onChange={setContacts} />

                  <input
                    type="hidden"
                    name="contactsJson"
                    value={JSON.stringify(
                      contacts.filter((c) => c.name.trim().length > 0),
                    )}
                  />

                  {error && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-900">
                      <span className="font-semibold">Couldn&apos;t save.</span> {error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="btn-glass text-[13.5px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !canSubmit}
                    className="btn-glass-prominent"
                  >
                    {pending ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        Save &amp; Start Quote
                        <ArrowRight className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
