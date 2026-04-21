'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus } from 'lucide-react';

export type CustomerSuggestion = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  projectCount: number;
};

/**
 * Autosuggest input for the "New Quote" intake. Filters the tenant's customer
 * list (passed in from the server component) in real time by customer name,
 * contact name, or contact email. Selecting a suggestion navigates to
 * `/quotes/new?customerId=X`, which triggers the next step of the intake.
 *
 * Client-side filter is fine for V1 (<15 mock customers, realistically <500
 * per tenant). If we scale to 5k+ customers per tenant, move to a debounced
 * server action.
 */
export function CustomerAutoSuggest({
  customers,
  placeholder = 'Search customers or contacts…',
}: {
  customers: CustomerSuggestion[];
  placeholder?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        const hay = [c.name, c.contactName ?? '', c.contactEmail ?? '']
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [customers, query]);

  // Reset highlight when the filtered list shifts.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commit = (id: string) => {
    setIsOpen(false);
    router.push(`/quotes/new?customerId=${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && filtered[activeIndex]) {
        e.preventDefault();
        commit(filtered[activeIndex].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="glass-input pl-10 pr-4"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="customer-suggestions"
          aria-autocomplete="list"
        />
      </div>

      {isOpen && (
        // Opaque (non-glass) surface on purpose: Safari drops backdrop-filter
        // when a parent already has one, which made this dropdown invisible
        // inside the Step 1 `.glass-raised` section. A solid white card with
        // a soft ring/shadow reads as an overlay in all three browsers.
        <div
          id="customer-suggestions"
          role="listbox"
          className="absolute z-30 top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 overflow-hidden"
          style={{ boxShadow: '0 24px 60px -24px rgba(15, 23, 42, 0.28), 0 2px 6px rgba(15, 23, 42, 0.06)' }}
        >
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-slate-500">
              <div className="mb-3">No Customers Match &ldquo;{query}&rdquo;</div>
              <a
                href="/customers"
                className="btn-glass text-[13px] inline-flex"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                New Customer
              </a>
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-auto py-1">
              {filtered.map((c, idx) => (
                <li key={c.id} role="option" aria-selected={idx === activeIndex}>
                  <button
                    type="button"
                    onClick={() => commit(c.id)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      idx === activeIndex ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-medium text-slate-900 truncate">
                        {c.name}
                      </div>
                      <div className="text-[12.5px] text-slate-500 truncate mt-0.5">
                        {c.contactName ?? 'No Contact'}
                        {c.contactEmail ? ` · ${c.contactEmail}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11.5px] text-slate-400 pt-0.5">
                      {c.projectCount} Project{c.projectCount === 1 ? '' : 's'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
