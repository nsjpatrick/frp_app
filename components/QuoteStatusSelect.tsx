'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { setQuoteStatus } from '@/lib/actions/quotes';

/**
 * QuoteStatusSelect — click-to-change status chip for the quotes table.
 * Opens a popover styled like the 3-dot row menu (rounded pill items
 * inset by 4px from the card edge). Selecting a new status fires the
 * server action and closes the menu; the current row's status gets a
 * check mark as a selection indicator.
 */

const STATUSES: Array<{ value: string; label: string; chip: string }> = [
  { value: 'DRAFT',       label: 'Draft',       chip: 'glass-chip' },
  { value: 'SENT',        label: 'Sent',        chip: 'glass-chip glass-tinted-slate' },
  { value: 'ENGINEERING', label: 'Engineering', chip: 'glass-chip glass-tinted-amber' },
  { value: 'BUILDING',    label: 'Fabricating', chip: 'glass-chip bg-sky-100/70 text-sky-900 border-sky-300/50' },
  { value: 'WON',         label: 'Won',         chip: 'glass-chip glass-tinted-emerald' },
  { value: 'SHIPPED',     label: 'Shipped',     chip: 'glass-chip glass-tinted-emerald' },
  { value: 'LOST',        label: 'Lost',        chip: 'glass-chip glass-tinted-rose' },
];

const LABEL_BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s.label])) as Record<string, string>;
const CHIP_BY_VALUE  = Object.fromEntries(STATUSES.map((s) => [s.value, s.chip ])) as Record<string, string>;

export function QuoteStatusSelect({
  quoteId,
  status,
}: {
  quoteId: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Keep the visible chip in sync if the parent re-renders with a new
  // status (e.g. after a dashboard revalidation landed a different value).
  useEffect(() => { setCurrent(status); }, [status]);

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

  const pickStatus = (next: string) => {
    setOpen(false);
    if (next === current) return;
    // Optimistic update so the chip changes immediately.
    const prev = current;
    setCurrent(next);
    const formData = new FormData();
    formData.set('quoteId', quoteId);
    formData.set('status',  next);
    startTransition(async () => {
      try {
        await setQuoteStatus(formData);
      } catch {
        // Revert on error — revalidatePath will re-sync us on next fetch.
        setCurrent(prev);
      }
    });
  };

  const chipClass = CHIP_BY_VALUE[current] ?? 'glass-chip';
  const label     = LABEL_BY_VALUE[current] ?? current;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={`${chipClass} inline-flex items-center gap-1 cursor-pointer hover:brightness-95 transition disabled:opacity-60`}
      >
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-20 min-w-[180px] bg-white rounded-xl border border-slate-200 p-1"
          style={{ boxShadow: '0 10px 30px -8px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(15, 23, 42, 0.08)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {STATUSES.map((s) => {
            const active = s.value === current;
            return (
              <button
                key={s.value}
                type="button"
                role="menuitem"
                onClick={() => pickStatus(s.value)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                  active ? 'bg-slate-50' : 'hover:bg-slate-100'
                }`}
              >
                <span className={`${s.chip} !px-2 !py-0.5 text-[11px]`}>{s.label}</span>
                {active && <span className="ml-auto text-[11px] text-amber-700 font-medium">Current</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
