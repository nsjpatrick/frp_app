'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  CHEMICAL_FAMILIES,
  CHEMICAL_FAMILY_LABEL,
  SEED_RESINS,
  type SeedResin,
} from '@/lib/catalog/seed-data';
import type { ChemicalFamily } from '@/lib/catalog/seed-data';
import { lookupChemicalWithMeta } from '@/lib/chemistry/chemical-registry';

/**
 * Pick the most compatible resin for a given chemical family.
 *
 * Heuristic: among resins whose `compatible_chemical_families` contains
 * the target family, pick the *cheapest* — breaking ties on the widest
 * temperature envelope. This matches what PTI reps actually optimize for:
 * the lowest-cost resin that still does the job.
 *
 * Returns `null` when no resin in the V1 catalog is compatible with the
 * family — rare but possible for edge chemistries.
 */
function pickBestResin(family: ChemicalFamily | string | null | undefined): SeedResin | null {
  if (!family) return null;
  const compatible = SEED_RESINS.filter((r) =>
    r.compatible_chemical_families.includes(family as ChemicalFamily),
  );
  if (compatible.length === 0) return null;
  const sorted = [...compatible].sort(
    (a, b) =>
      a.price_per_lb - b.price_per_lb ||
      b.max_service_temp_F - a.max_service_temp_F,
  );
  return sorted[0];
}

/**
 * Client-side chemistry inputs.
 *
 * Why this is interactive: the resin-compatibility filter in Step 3 keys
 * off `chemicalFamily`, not the free-text `chemical` field. Reps reliably
 * type the chemical name ("HCl", "NaOCl", etc.) but leave the family
 * dropdown at its default, which silently mis-filters resins. This
 * component watches the chemical name + concentration and auto-selects
 * the correct family — without locking the rep out of a manual override.
 *
 * Mode tracking:
 *   - `auto`   → family is being driven by the chemical-registry lookup
 *   - `manual` → rep clicked the family dropdown; we stop auto-selecting
 *                until they clear the chemical field, in which case we
 *                re-enable auto.
 */
export function ChemistrySection({ initial }: {
  initial: {
    chemical: string;
    chemicalFamily: string;
    concentrationPct: string;   // raw string so empty stays empty
    specificGravity: string;
    postCure: boolean;
    resinId: string;            // '' when no prior selection
  };
}) {
  const [chemical, setChemical]       = useState(initial.chemical);
  const [concentration, setConcentration] = useState(initial.concentrationPct);
  const [family, setFamily]           = useState(initial.chemicalFamily);
  const [familyMode, setFamilyMode]   = useState<'auto' | 'manual'>(
    // If there's saved state with a known chemical, start in auto so we can
    // re-verify the saved family matches the registry. If the chemical
    // field is empty, there's nothing to drive auto-mode, so start manual.
    initial.chemical.trim() ? 'auto' : 'manual',
  );
  const [postCure, setPostCure]       = useState(initial.postCure);
  const [resinId, setResinId]         = useState(initial.resinId);
  const [resinMode, setResinMode]     = useState<'auto' | 'manual'>(
    // Same pattern as family: if a resin was previously saved, start in
    // auto so a re-computation can kick in when family changes. If nothing
    // was saved, auto-pick the best option on first render.
    initial.resinId ? 'auto' : 'auto',
  );

  const concentrationNum = (() => {
    const n = Number(concentration);
    return Number.isFinite(n) && concentration.trim() !== '' ? n : null;
  })();

  const { match, concentrationMatters } = useMemo(
    () => lookupChemicalWithMeta(chemical, concentrationNum),
    [chemical, concentrationNum],
  );

  // Drive the family dropdown from the registry match while we're in auto
  // mode. Intentionally skip when the rep has flipped to manual — respect
  // their override. Rep can re-enter auto by clearing the chemical field
  // (which clears match) and typing something else.
  useEffect(() => {
    if (familyMode !== 'auto') return;
    if (match && match.family !== family) {
      setFamily(match.family);
      // Mirror the registry's post-cure recommendation into the toggle so
      // the rep gets a sensible default for aggressive chemistries. Don't
      // stomp if they've already turned it on.
      if (match.recommendPostCure && !postCure) setPostCure(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, familyMode]);

  const autoActive = familyMode === 'auto' && !!match;
  const manualOverride = familyMode === 'manual' && !!match && match.family !== family;

  // ── Resin auto-pick ───────────────────────────────────────────────────
  // Group resins into "compatible with current family" vs the rest, so
  // the dropdown shows matches first but still lets the rep reach any
  // resin in the catalog. Re-evaluates whenever `family` changes.
  const resinGroups = useMemo(() => {
    const compatible: SeedResin[] = [];
    const other: SeedResin[] = [];
    for (const r of SEED_RESINS) {
      if (r.compatible_chemical_families.includes(family as ChemicalFamily)) {
        compatible.push(r);
      } else {
        other.push(r);
      }
    }
    compatible.sort(
      (a, b) =>
        a.price_per_lb - b.price_per_lb ||
        b.max_service_temp_F - a.max_service_temp_F,
    );
    other.sort((a, b) => a.name.localeCompare(b.name));
    return { compatible, other };
  }, [family]);

  // Drive the resin selection from the family while in auto mode. If the
  // rep picks a resin from the dropdown we flip to manual and stop
  // stomping their choice. They can revert via the "use suggested"
  // affordance below the dropdown.
  useEffect(() => {
    if (resinMode !== 'auto') return;
    const best = pickBestResin(family);
    if (best && best.id !== resinId) setResinId(best.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, resinMode]);

  const selectedResin = SEED_RESINS.find((r) => r.id === resinId) ?? null;
  const bestResin = pickBestResin(family);
  const resinManualOverride =
    resinMode === 'manual' && bestResin && bestResin.id !== resinId;
  const resinNotCompatible =
    selectedResin && family
      ? !selectedResin.compatible_chemical_families.includes(family as ChemicalFamily)
      : false;

  return (
    <section>
      <h3 className="section-head">Chemistry</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="glass-label" htmlFor="chemical">Chemical</label>
          <input
            id="chemical"
            name="chemical"
            value={chemical}
            onChange={(e) => {
              setChemical(e.target.value);
              // Re-enable auto whenever the rep retypes the chemical — the
              // previous manual override was tied to a specific chemical.
              if (familyMode === 'manual' && e.target.value.trim() === '') {
                setFamilyMode('auto');
              }
              // If they start editing the chemical, assume they want auto.
              if (familyMode === 'manual') setFamilyMode('auto');
            }}
            required
            placeholder="e.g. HCl, H₂SO₄, NaOCl, NaOH"
            className="glass-input"
          />
          {match && (
            <div className="mt-2 flex items-start gap-1.5 text-[12.5px] text-amber-700">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-none" strokeWidth={2} aria-hidden />
              <span>
                Recognized as <span className="font-semibold">{match.display}</span>. {match.note}
                {concentrationMatters && concentrationNum == null && (
                  <> <span className="text-amber-800/80">Add a concentration % for a sharper match.</span></>
                )}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="glass-label" htmlFor="chemicalFamily">
            Chemical family
            {autoActive && (
              <span className="label-badge label-badge-auto">Auto</span>
            )}
            {familyMode === 'manual' && (
              <span className="label-badge label-badge-manual">Manual</span>
            )}
          </label>
          <select
            id="chemicalFamily"
            name="chemicalFamily"
            value={family}
            onChange={(e) => {
              setFamily(e.target.value);
              setFamilyMode('manual');
            }}
            className="glass-input"
          >
            {CHEMICAL_FAMILIES.map((f) => (
              <option key={f} value={f}>{CHEMICAL_FAMILY_LABEL[f] ?? f}</option>
            ))}
          </select>
          {manualOverride && (
            <div className="mt-2 text-[12px] text-slate-500">
              Overriding suggested{' '}
              <button
                type="button"
                onClick={() => { setFamily(match!.family); setFamilyMode('auto'); }}
                className="text-amber-700 font-medium underline-offset-2 hover:underline"
              >
                {CHEMICAL_FAMILY_LABEL[match!.family]}
              </button>.
            </div>
          )}
        </div>

        <div>
          <label className="glass-label" htmlFor="concentrationPct">Concentration (%)</label>
          <input
            id="concentrationPct"
            type="number"
            step="any"
            name="concentrationPct"
            value={concentration}
            onChange={(e) => setConcentration(e.target.value)}
            placeholder="50"
            className="glass-input"
          />
        </div>
        <div>
          <label className="glass-label" htmlFor="specificGravity">Specific gravity</label>
          <input
            id="specificGravity"
            type="number"
            step="any"
            name="specificGravity"
            defaultValue={initial.specificGravity || '1.0'}
            required
            className="glass-input"
          />
        </div>

        {/* Resin auto-pick + override — spans both columns so the dropdown
            has room to show the supplier alongside the resin name. */}
        <div className="md:col-span-2">
          <label className="glass-label" htmlFor="resinId">
            Resin
            {resinMode === 'auto' && !!bestResin && (
              <span className="label-badge label-badge-auto">Auto</span>
            )}
            {resinMode === 'manual' && (
              <span className="label-badge label-badge-manual">Manual</span>
            )}
          </label>
          <select
            id="resinId"
            name="resinId"
            value={resinId}
            onChange={(e) => {
              setResinId(e.target.value);
              setResinMode('manual');
            }}
            required
            className="glass-input"
          >
            {resinGroups.compatible.length > 0 && (
              <optgroup label="Compatible with current chemistry">
                {resinGroups.compatible.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.supplier} · max {r.max_service_temp_F}°F
                  </option>
                ))}
              </optgroup>
            )}
            {resinGroups.other.length > 0 && (
              <optgroup label="Other resins (not typical for this chemistry)">
                {resinGroups.other.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.supplier} · max {r.max_service_temp_F}°F
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {selectedResin && !resinNotCompatible && resinMode === 'auto' && (
            <div className="mt-2 text-[12.5px] text-slate-500">
              Cheapest resin compatible with{' '}
              <span className="font-medium text-slate-700">
                {CHEMICAL_FAMILY_LABEL[family as ChemicalFamily] ?? family}
              </span>
              .
            </div>
          )}
          {resinManualOverride && bestResin && (
            <div className="mt-2 text-[12px] text-slate-500">
              Overriding suggested{' '}
              <button
                type="button"
                onClick={() => { setResinId(bestResin.id); setResinMode('auto'); }}
                className="text-amber-700 font-medium underline-offset-2 hover:underline"
              >
                {bestResin.name}
              </button>
              .
            </div>
          )}
          {resinNotCompatible && (
            <div className="mt-2 text-[12px] text-rose-700">
              {selectedResin!.name} is not rated for{' '}
              {CHEMICAL_FAMILY_LABEL[family as ChemicalFamily] ?? family}. Confirm with engineering before sending.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <label className="toggle-pill">
          <input
            type="checkbox"
            name="postCure"
            checked={postCure}
            onChange={(e) => setPostCure(e.target.checked)}
          />
          <span>Post-Cure</span>
        </label>
        <span className="text-[13px] text-slate-500">
          Heat cure after layup (typ. 180–220°F) to improve chemical and thermal performance.
        </span>
      </div>
    </section>
  );
}
