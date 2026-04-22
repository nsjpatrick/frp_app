'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, X } from 'lucide-react';
import { addContactsToCustomer } from '@/lib/actions/customers';
import { ContactsEditor, EMPTY_CONTACT, type ContactRow } from '@/components/ContactsEditor';

/**
 * AddContactModal — appends one or more contacts to an existing customer.
 * Uses the shared ContactsEditor so the country-code dropdown + phone
 * layout stays identical to the other customer modals.
 */

export function AddContactModal({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([{ ...EMPTY_CONTACT }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  const handleAction = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await addContactsToCustomer(formData);
        setOpen(false);
        setContacts([{ ...EMPTY_CONTACT }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save contact.');
      }
    });
  };

  const reset = () => setContacts([{ ...EMPTY_CONTACT }]);
  const close = () => { setOpen(false); reset(); };

  const canSubmit = contacts[0]?.name.trim().length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-glass-secondary"
      >
        <UserPlus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        New Contact
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
            aria-labelledby="add-contact-title"
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
                      id="add-contact-title"
                      className="text-[17px] font-semibold tracking-tight text-slate-900"
                    >
                      New Contact
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      Adding to <strong className="text-slate-700">{customerName}</strong>.
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

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
                  <input type="hidden" name="customerId" value={customerId} />

                  <ContactsEditor
                    contacts={contacts}
                    onChange={setContacts}
                    primaryLabel="One name per row"
                  />

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
                        <UserPlus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                        Add Contact{contacts.filter((c) => c.name.trim()).length > 1 ? 's' : ''}
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
