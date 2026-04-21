'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { createProject } from '@/lib/actions/projects';

/**
 * NewProjectModal — opens from the customer detail page header. Captures
 * the fields the `createProject` server action expects: name, customer PO,
 * site address, end use, need-by date. Matches the NewCustomerModal
 * rendering pattern (portaled to body with inline-style full-viewport
 * overlay, opaque card, Safari-safe).
 */

export function NewProjectModal({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setName('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-glass-prominent"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        New Project
      </button>

      {open && typeof document !== 'undefined' && createPortal(
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
            aria-labelledby="new-project-title"
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
              <form action={createProject} className="flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-200">
                  <div>
                    <h3
                      id="new-project-title"
                      className="text-[17px] font-semibold tracking-tight text-slate-900"
                    >
                      New Project
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      Under <strong className="text-slate-700">{customerName}</strong>.
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

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  <input type="hidden" name="customerId" value={customerId} />

                  <div>
                    <label htmlFor="project-name" className="glass-label">Project Name</label>
                    <input
                      id="project-name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                      placeholder="e.g. Main Sulfuric Day Tank"
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="project-description" className="glass-label">
                      Description
                    </label>
                    <textarea
                      id="project-description"
                      name="description"
                      rows={3}
                      placeholder="Short context — scope, drivers, any relevant background."
                      className="glass-input resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div>
                      <label htmlFor="project-po" className="glass-label">
                        Customer PO #
                      </label>
                      <input
                        id="project-po"
                        name="customerProjectNumber"
                        placeholder="PO-42137"
                        className="glass-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="project-need-by" className="glass-label">
                        Need By
                      </label>
                      <input
                        id="project-need-by"
                        type="date"
                        name="needByDate"
                        className="glass-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="project-site" className="glass-label">
                      Site Address
                    </label>
                    <input
                      id="project-site"
                      name="siteAddress"
                      placeholder="123 Industrial Pkwy, Fairfield OH"
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="project-enduse" className="glass-label">
                      End Use
                    </label>
                    <input
                      id="project-enduse"
                      name="endUse"
                      placeholder="50% H2SO4 storage"
                      className="glass-input"
                    />
                    <p className="text-[11.5px] text-slate-400 mt-1.5">
                      Chemical formulas like H2SO4, NaOH, FeCl3 render with subscripts
                      site-wide when displayed.
                    </p>
                  </div>
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
                    disabled={!name.trim()}
                    className="btn-glass-prominent"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                    Create Project
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
