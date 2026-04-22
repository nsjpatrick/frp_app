'use client';

import { Plus, Trash2 } from 'lucide-react';
import { COUNTRY_CODES, DEFAULT_COUNTRY_DIAL, composePhone, parsePhone } from '@/lib/phone';

/**
 * ContactsEditor — shared expandable contact-row editor.
 *
 * Used by all three customer modals (NewCustomer, NewCustomerQuote, AddContact)
 * so the country-code dropdown + phone layout stays identical everywhere.
 * The caller owns the `contacts` array state; this component just renders
 * the editor and invokes `onChange` whenever a row is mutated.
 *
 * Phone storage: the editor writes `+CC-<local>` into `contact.phone`
 * on every keystroke via `composePhone`, so the parent's hidden
 * `contactsJson` field always holds the canonical form.
 */

export type ContactRow = {
  name: string;
  email: string;
  phone: string;
};

export const EMPTY_CONTACT: ContactRow = { name: '', email: '', phone: '' };

export function ContactsEditor({
  contacts,
  onChange,
  primaryLabel = 'First row is the primary contact',
}: {
  contacts: ContactRow[];
  onChange: (next: ContactRow[]) => void;
  primaryLabel?: string;
}) {
  const updateRow = (idx: number, patch: Partial<ContactRow>) =>
    onChange(contacts.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const addRow = () => onChange([...contacts, { ...EMPTY_CONTACT }]);

  const removeRow = (idx: number) =>
    onChange(contacts.length > 1 ? contacts.filter((_, i) => i !== idx) : contacts);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="glass-label mb-0">Contacts</span>
        <span className="text-[11px] text-slate-400">{primaryLabel}</span>
      </div>

      {/* Column headers — phone column is wider to accommodate the country
          code dropdown next to the local-number input. */}
      <div className="grid grid-cols-[1fr_1fr_200px_36px] gap-2 px-1 pb-1.5">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Name</span>
        <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Email</span>
        <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Phone</span>
        <span />
      </div>

      <div className="space-y-2">
        {contacts.map((c, idx) => {
          const { dial, local } = parsePhone(c.phone);
          const activeDial = dial || DEFAULT_COUNTRY_DIAL;

          const onDialChange = (next: string) => {
            updateRow(idx, { phone: composePhone(next, local) });
          };
          const onLocalChange = (next: string) => {
            updateRow(idx, { phone: composePhone(activeDial, next) });
          };

          return (
            <div
              key={idx}
              className="grid grid-cols-[1fr_1fr_200px_36px] gap-2 items-center"
            >
              <input
                type="text"
                value={c.name}
                onChange={(e) => updateRow(idx, { name: e.target.value })}
                placeholder="Jane Doe"
                required={idx === 0}
                className="glass-input"
                aria-label={`Contact ${idx + 1} name`}
              />
              <input
                type="email"
                value={c.email}
                onChange={(e) => updateRow(idx, { email: e.target.value })}
                placeholder="jane@acme.com"
                className="glass-input"
                aria-label={`Contact ${idx + 1} email`}
              />

              {/* Phone: country dropdown + local number. Nested grid so the
                  two controls share the 200px column proportionally without
                  fighting the parent grid's sizing. */}
              <div className="grid grid-cols-[76px_1fr] gap-1.5">
                <select
                  value={activeDial}
                  onChange={(e) => onDialChange(e.target.value)}
                  className="glass-input !pr-5"
                  aria-label={`Contact ${idx + 1} country code`}
                >
                  {COUNTRY_CODES.map((cc) => (
                    <option key={cc.iso} value={cc.dial}>
                      {cc.flag} +{cc.dial}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={local}
                  onChange={(e) => onLocalChange(e.target.value)}
                  placeholder="555-123-4567"
                  className="glass-input"
                  aria-label={`Contact ${idx + 1} phone`}
                />
              </div>

              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={contacts.length === 1}
                aria-label="Remove contact"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={addRow}
          className="btn-glass text-[13px]"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          Add Contact
        </button>
      </div>
    </div>
  );
}
