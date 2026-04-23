'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { updateCustomer, deleteCustomer } from '@/lib/actions/customers';
import { ContactsEditor, type ContactRow } from '@/components/ContactsEditor';

/**
 * CustomerRowMenu — the 3-dot action menu at the end of every customers
 * table row. Click opens a small popover with Edit + Delete. Each option
 * spawns its own modal (both portal-rendered with inline-styled overlays,
 * matching the rest of the app's Safari-safe modal pattern).
 */

type Props = {
  customerId: string;
  customerName: string;
  contacts: ContactRow[];
  projectCount: number;
  quoteCount: number;
};

export function CustomerRowMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / escape while the popover is open. `click`
  // (not `mousedown`) so the menuitem's own click event lands first —
  // mousedown would close the menu before React could process the select.
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

  return (
    <>
      <div ref={wrapRef} className="relative inline-block">
        <button
          type="button"
          aria-label={`Actions for ${props.customerName}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" aria-hidden />
        </button>

        {open && (
          <div
            role="menu"
            // p-1 gives each item a 4px inset from the container edge; the
            // items themselves are rounded-lg so the hover pill sits neatly
            // within the card's rounded-xl shell instead of painting into
            // the corners.
            className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-white rounded-xl border border-slate-200 p-1"
            style={{ boxShadow: '0 10px 30px -8px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(15, 23, 42, 0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setMode('edit'); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px] text-slate-700 hover:bg-slate-100 text-left transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" aria-hidden />
              Edit
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

      {mode === 'edit' && (
        <EditCustomerModal {...props} onClose={() => setMode(null)} />
      )}
      {mode === 'delete' && (
        <DeleteCustomerModal {...props} onClose={() => setMode(null)} />
      )}
    </>
  );
}

// --- Edit --------------------------------------------------------------------

function EditCustomerModal({
  customerId,
  customerName,
  contacts: initialContacts,
  onClose,
}: Props & { onClose: () => void }) {
  const [company, setCompany] = useState(customerName);
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts.length ? initialContacts : [{ name: '', email: '', phone: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => { if (!pending) onClose(); };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateCustomer(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save.');
      }
    });
  };

  const canSubmit = company.trim().length > 0 && contacts[0]?.name.trim().length > 0 && !pending;

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
            aria-labelledby="edit-customer-title"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 70 }}
          >
            <div
              className="pointer-events-auto relative bg-white rounded-3xl border border-slate-200 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col"
              style={{
                width: 'min(640px, calc(100vw - 2rem))',
                boxShadow:
                  '0 30px 80px -20px rgba(15, 23, 42, 0.55), 0 4px 12px rgba(15, 23, 42, 0.10)',
              }}
            >
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                <input type="hidden" name="customerId" value={customerId} />

                <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h3 id="edit-customer-title" className="text-[17px] font-semibold tracking-tight text-slate-900">
                      Edit Customer
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">Company name and contact roster.</p>
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
                    <label htmlFor="edit-customer-name" className="glass-label">Company Name</label>
                    <input
                      id="edit-customer-name"
                      name="name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                      className="glass-input"
                    />
                  </div>

                  <ContactsEditor contacts={contacts} onChange={setContacts} />

                  <input
                    type="hidden"
                    name="contactsJson"
                    value={JSON.stringify(contacts.filter((c) => c.name.trim().length > 0))}
                  />

                  {error && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-900">
                      <span className="font-semibold">Couldn&apos;t save.</span> {error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0">
                  <button type="button" onClick={close} disabled={pending} className="btn-glass text-[13.5px]">
                    Cancel
                  </button>
                  <button type="submit" disabled={!canSubmit} className="btn-glass-prominent">
                    {pending ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Pencil className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                        Save Changes
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

// --- Delete ------------------------------------------------------------------

function DeleteCustomerModal({
  customerId,
  customerName,
  projectCount,
  quoteCount,
  onClose,
}: Props & { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState('');

  const close = () => { if (!pending) onClose(); };

  const hasDependents = projectCount > 0 || quoteCount > 0;
  const confirmPhrase = 'delete';
  const canSubmit = !pending && confirmText.trim().toLowerCase() === confirmPhrase;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set('customerId', customerId);
    startTransition(async () => {
      try {
        await deleteCustomer(formData);
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
            aria-labelledby="delete-customer-title"
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
                        id="delete-customer-title"
                        className="text-[16px] font-semibold tracking-tight text-slate-900"
                      >
                        Delete {customerName}?
                      </h3>
                      <p className="text-[13.5px] text-slate-600 mt-1.5 leading-snug">
                        This permanently removes the customer{hasDependents ? ', all ' : ''}
                        {projectCount > 0 && (
                          <>
                            <strong className="text-slate-900">{projectCount}</strong> project{projectCount === 1 ? '' : 's'}
                          </>
                        )}
                        {projectCount > 0 && quoteCount > 0 && ', and '}
                        {quoteCount > 0 && (
                          <>
                            <strong className="text-slate-900">{quoteCount}</strong> quote{quoteCount === 1 ? '' : 's'} (including all revisions)
                          </>
                        )}
                        . This cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="delete-confirm-input" className="glass-label">
                      Type <span className="font-mono text-rose-700">delete</span> to confirm
                    </label>
                    <input
                      id="delete-confirm-input"
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
                        Delete Customer
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
