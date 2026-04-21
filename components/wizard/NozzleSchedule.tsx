'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * NozzleSchedule — editable table of inlets, outlets, manways, vents, etc.
 * for the Geometry step. Rows are managed client-side; on submit the array
 * is serialized into a hidden `nozzlesJson` input that the server action
 * parses via the Zod schema in `lib/validators/entities.ts`.
 *
 * For V1 we capture type + size (NPS) + pressure rating + quantity. More
 * detail (flange face, clock position, reinforcement) is deferred to Plan 7.
 */

const NOZZLE_TYPES = [
  { value: 'inlet',      label: 'Inlet' },
  { value: 'outlet',     label: 'Outlet' },
  { value: 'manway',     label: 'Manway' },
  { value: 'vent',       label: 'Vent' },
  { value: 'overflow',   label: 'Overflow' },
  { value: 'drain',      label: 'Drain' },
  { value: 'sample',     label: 'Sample Port' },
  { value: 'instrument', label: 'Instrument' },
] as const;

const NOZZLE_SIZES = [
  '1"', '1.5"', '2"', '3"', '4"', '6"', '8"', '10"', '12"', '16"', '20"', '24"',
  // Manway-only sizes — surfaced only when type === 'manway'.
  '36"', '48"',
] as const;

// Manways come in larger access-sized openings; restrict the size dropdown
// when type is 'manway' so the user can't pick a 2" manway.
const MANWAY_SIZES = ['24"', '36"', '48"'] as const;
const STANDARD_SIZES = NOZZLE_SIZES.filter(
  (s) => !['36"', '48"'].includes(s),
) as readonly (typeof NOZZLE_SIZES)[number][];

const NOZZLE_RATINGS = ['150#', '300#'] as const;

export type NozzleRow = {
  type: (typeof NOZZLE_TYPES)[number]['value'];
  sizeNps: (typeof NOZZLE_SIZES)[number];
  rating: (typeof NOZZLE_RATINGS)[number];
  quantity: number;
};

const EMPTY_ROW: NozzleRow = { type: 'inlet', sizeNps: '2"', rating: '150#', quantity: 1 };

export function NozzleSchedule({ initial }: { initial: NozzleRow[] }) {
  const [rows, setRows] = useState<NozzleRow[]>(initial);

  const addRow = () => setRows((r) => [...r, { ...EMPTY_ROW }]);
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<NozzleRow>) =>
    setRows((r) =>
      r.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        // If the type switched, clamp the size into the set that's valid
        // for the new type so we never persist a 2" manway or a 48" inlet.
        if (patch.type && patch.type !== row.type) {
          const allowed = patch.type === 'manway' ? MANWAY_SIZES : STANDARD_SIZES;
          if (!allowed.includes(next.sizeNps as (typeof allowed)[number])) {
            next.sizeNps = patch.type === 'manway' ? '24"' : '2"';
          }
        }
        return next;
      }),
    );

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_72px_80px_80px_36px] gap-3 px-1 pb-1">
          <span className="glass-label mb-0">Type</span>
          <span className="glass-label mb-0">Size (NPS)</span>
          <span className="glass-label mb-0">Rating</span>
          <span className="glass-label mb-0">Qty</span>
          <span />
        </div>
      )}

      {rows.map((row, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_72px_80px_80px_36px] gap-3 items-center"
        >
          <select
            value={row.type}
            onChange={(e) => updateRow(idx, { type: e.target.value as NozzleRow['type'] })}
            className="glass-input"
            aria-label="Connection type"
          >
            {NOZZLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            value={row.sizeNps}
            onChange={(e) => updateRow(idx, { sizeNps: e.target.value as NozzleRow['sizeNps'] })}
            className="glass-input glass-input-tight"
            aria-label="Nominal pipe size"
          >
            {(row.type === 'manway' ? MANWAY_SIZES : STANDARD_SIZES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={row.rating}
            onChange={(e) => updateRow(idx, { rating: e.target.value as NozzleRow['rating'] })}
            className="glass-input glass-input-tight"
            aria-label="Flange rating"
          >
            {NOZZLE_RATINGS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={99}
            step={1}
            value={row.quantity}
            onChange={(e) =>
              updateRow(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
            }
            className="glass-input"
            style={{ paddingLeft: '0.625rem', paddingRight: '0.5rem' }}
            aria-label="Quantity"
          />

          <button
            type="button"
            onClick={() => removeRow(idx)}
            aria-label="Remove connection"
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500">
          No connections yet. Add at least one inlet and one outlet.
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          onClick={addRow}
          className="btn-glass text-[13px]"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          Add Connection
        </button>
      </div>

      <input type="hidden" name="nozzlesJson" value={JSON.stringify(rows)} />
    </div>
  );
}
