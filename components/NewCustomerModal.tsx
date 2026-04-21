'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Trash2 } from 'lucide-react';
import { createCustomer } from '@/lib/actions/customers';

/**
 * NewCustomerModal — opens from the Customers page header as the amber
 * prominent CTA. Captures the company name plus one-or-more contacts
 * (name + email + phone) via expandable rows, same pattern as the nozzle
 * schedule. Submits via the existing `createCustomer` server action.
 *
 * Rendering: portaled to document.body so the fixed overlay escapes any
 * ancestor with backdrop-filter (which would otherwise constrain "fixed"
 * to that ancestor). Matches the SendQuoteButton pattern.
 */

type ContactRow = {
  name: string;
  email: string;
  phone: string;
};

const EMPTY_CONTACT: ContactRow = { name: '', email: '', phone: '' };

export function NewCustomerModal() {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([{ ...EMPTY_CONTACT }]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const reset = () => {
    setCompany('');
    setContacts([{ ...EMPTY_CONTACT }]);
  };
  const close = () => { setOpen(false); reset(); };

  const addContact = () => setContacts((c) => [...c, { ...EMPTY_CONTACT }]);
  const removeContact = (idx: number) =>
    setContacts((c) => (c.length > 1 ? c.filter((_, i) => i !== idx) : c));
  const updateContact = (idx: number, patch: Partial<ContactRow>) =>
    setContacts((c) => c.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-glass-prominent"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        New Customer
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop — full viewport, inline styles for Safari predictability. */}
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
          {/* Modal container. pointer-events-none so backdrop click dismisses;
              card inside re-enables pointer-events. */}
          <div
            className="flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-customer-title"
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
              <form action={createCustomer} className="flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-200">
                  <div>
                    <h3
                      id="new-customer-title"
                      className="text-[17px] font-semibold tracking-tight text-slate-900"
                    >
                      New Customer
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      Company name + one or more contacts.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={close}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>

                {/* Body — scrolls if there are many contacts */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                  <div>
                    <label htmlFor="customer-name" className="glass-label">
                      Company Name
                    </label>
                    <input
                      id="customer-name"
                      name="name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                      autoFocus
                      placeholder="e.g. Acme Chem Co."
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="glass-label mb-0">Contacts</span>
                      <span className="text-[11px] text-slate-400">
                        First row is the primary contact
                      </span>
                    </div>

                    {/* Column headers — mirror the nozzle-schedule layout */}
                    <div className="grid grid-cols-[1fr_1fr_140px_36px] gap-2 px-1 pb-1.5">
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Name</span>
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Email</span>
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Phone</span>
                      <span />
                    </div>

                    <div className="space-y-2">
                      {contacts.map((c, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_1fr_140px_36px] gap-2 items-center"
                        >
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => updateContact(idx, { name: e.target.value })}
                            placeholder="Jane Doe"
                            required={idx === 0}
                            className="glass-input"
                            aria-label={`Contact ${idx + 1} name`}
                          />
                          <input
                            type="email"
                            value={c.email}
                            onChange={(e) => updateContact(idx, { email: e.target.value })}
                            placeholder="jane@acme.com"
                            className="glass-input"
                            aria-label={`Contact ${idx + 1} email`}
                          />
                          <input
                            type="tel"
                            value={c.phone}
                            onChange={(e) => updateContact(idx, { phone: e.target.value })}
                            placeholder="555-0100"
                            className="glass-input"
                            aria-label={`Contact ${idx + 1} phone`}
                          />
                          <button
                            type="button"
                            onClick={() => removeContact(idx)}
                            disabled={contacts.length === 1}
                            aria-label="Remove contact"
                            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={addContact}
                        className="btn-glass text-[13px]"
                      >
                        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                        Add Contact
                      </button>
                    </div>
                  </div>

                  <input
                    type="hidden"
                    name="contactsJson"
                    value={JSON.stringify(
                      contacts.filter((c) => c.name.trim().length > 0),
                    )}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60">
                  <button
                    type="button"
                    onClick={close}
                    className="btn-glass text-[13.5px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!company.trim() || !contacts[0]?.name.trim()}
                    className="btn-glass-prominent"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                    Create Customer
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
