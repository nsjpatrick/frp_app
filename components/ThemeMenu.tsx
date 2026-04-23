'use client';

import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Monitor, User } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'theme';

// Resolve the user's preference to the concrete value that lives on
// <html data-theme="…">. Keeps the DOM attribute either 'light' or
// 'dark' (never 'system') so the CSS selectors don't have to branch.
function resolveTheme(pref: Theme): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * ThemeMenu — the Nav's avatar doubles as a theme picker. Click opens a
 * small popover with System / Light / Dark options. Choice persists to
 * localStorage and toggles the `.is-dark` class on <html> to match the
 * CSS rules in globals.css.
 *
 * The pre-hydration script in app/layout.tsx already sets the correct
 * class before first paint, so this component just has to stay in sync
 * with subsequent changes (user clicks + system-theme switches while in
 * 'system' mode).
 */
export function ThemeMenu({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>('system');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the UI state from localStorage, keep `data-theme` on <html>
  // aligned with the stored preference, and (only when that preference
  // is 'system') subscribe to OS-theme changes so the page follows the
  // system setting live.
  //
  // Single effect on purpose: if we split hydration and the system-mode
  // subscription into two useEffects, the second one fires on initial
  // mount with the stale `theme='system'` default and clobbers what the
  // first one just set.
  useEffect(() => {
    const stored = (typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null) as Theme | null;
    const current: Theme =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    if (current !== theme) setThemeState(current);

    const root = document.documentElement;
    root.dataset.themePreference = current;
    root.dataset.theme = resolveTheme(current);

    if (current !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { root.dataset.theme = mq.matches ? 'dark' : 'light'; };
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current || wrapRef.current.contains(e.target as Node)) return;
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

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    const root = document.documentElement;
    root.dataset.themePreference = next;
    root.dataset.theme = resolveTheme(next);
    setOpen(false);
  };

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light',  label: 'Light',  icon: Sun     },
    { value: 'dark',   label: 'Dark',   icon: Moon    },
  ];

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Theme menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title={userEmail}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        // Opaque — no backdrop-filter. Nav is already .glass-raised; a nested
        // backdrop-blur disappears in Safari, so keep the avatar solid.
        className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition-colors"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(15,23,42,0.06)' }}
      >
        <User className="w-4 h-4" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[160px] bg-white rounded-xl border border-slate-200 p-1"
          style={{ boxShadow: '0 10px 30px -8px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(15, 23, 42, 0.08)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-widest uppercase text-slate-400">
            Theme
          </div>
          {options.map((o) => {
            const Icon = o.icon;
            const active = theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitem"
                onClick={() => setTheme(o.value)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px] text-left transition-colors ${
                  active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                <span className="flex-1">{o.label}</span>
                {active && <span className="text-[11px] text-amber-700 font-medium">Current</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
