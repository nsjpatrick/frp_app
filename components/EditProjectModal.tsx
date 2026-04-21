'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X, Check } from 'lucide-react';
import { updateProject } from '@/lib/actions/projects';

/**
 * EditProjectModal — edits the four "core" project fields:
 *   - Title (project name)
 *   - Description (optional longer-form context)
 *   - Location (site address)
 *   - Need-by date
 *
 * Uses a transition-wrapped form action so the modal can close on success
 * without relying on navigation (updateProject only revalidates, it doesn't
 * redirect — so a plain `action={updateProject}` would leave the modal
 * frozen open after save).
 */

export function EditProjectModal({
  project,
}: {
  project: {
    id: string;
    name: string;
    description: string | null;
    siteAddress: string | null;
    needByDate: string | null; // ISO yyyy-mm-dd or full ISO
  };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [siteAddress, setSiteAddress] = useState(project.siteAddress ?? '');
  const [needByDate, setNeedByDate] = useState(
    project.needByDate ? project.needByDate.slice(0, 10) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  const openModal = () => {
    setName(project.name);
    setDescription(project.description ?? '');
    setSiteAddress(project.siteAddress ?? '');
    setNeedByDate(project.needByDate ? project.needByDate.slice(0, 10) : '');
    setError(null);
    setOpen(true);
  };

  // Form submit handler — calls the server action inside a transition so
  // we can close the modal on success and show an error if it rejects.
  const handleAction = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateProject(formData);
        setOpen(false);
      } catch (e) {
        // Surface the underlying cause so we can debug from the browser
        // console. Some server-action errors (e.g. Prisma validation) have
        // useful `.message` strings; others are generic React internals.
        // eslint-disable-next-line no-console
        console.error('[EditProjectModal] updateProject failed:', e);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || 'Could not save changes.');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="btn-glass-secondary"
      >
        <Pencil className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        Edit Project
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => !pending && setOpen(false)}
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
            aria-labelledby="edit-project-title"
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
              {/* flex-1 min-h-0 lets the form fill the card's max-height so
                  the inner `flex-1 overflow-y-auto` body actually scrolls. */}
              <form action={handleAction} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h3
                      id="edit-project-title"
                      className="text-[17px] font-semibold tracking-tight text-slate-900"
                    >
                      Edit Project
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      Title, description, location, and timeline.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
                  <input type="hidden" name="projectId" value={project.id} />

                  <div>
                    <label htmlFor="edit-project-name" className="glass-label">
                      Title
                    </label>
                    <input
                      id="edit-project-name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-project-description" className="glass-label">
                      Description
                    </label>
                    <textarea
                      id="edit-project-description"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Short context — scope, drivers, any relevant background."
                      className="glass-input resize-none block"
                      style={{ minHeight: '90px', lineHeight: 1.5 }}
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-project-location" className="glass-label">
                      Location
                    </label>
                    <input
                      id="edit-project-location"
                      name="siteAddress"
                      value={siteAddress}
                      onChange={(e) => setSiteAddress(e.target.value)}
                      placeholder="123 Industrial Pkwy, Fairfield OH"
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-project-need-by" className="glass-label">
                      Need By Date
                    </label>
                    <input
                      id="edit-project-need-by"
                      type="date"
                      name="needByDate"
                      value={needByDate}
                      onChange={(e) => setNeedByDate(e.target.value)}
                      className="glass-input"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-900">
                      <span className="font-semibold">Couldn&apos;t save.</span> {error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="btn-glass text-[13.5px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !name.trim()}
                    className="btn-glass-prominent"
                  >
                    {pending ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden />
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
      )}
    </>
  );
}
