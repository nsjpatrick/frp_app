'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { CHEMICAL_FAMILIES, CHEMICAL_FAMILY_LABEL } from '@/lib/catalog/seed-data';
import { lookupChemicalWithMeta } from '@/lib/chemistry/chemical-registry';

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
              <span className="ml-2 text-[10.5px] font-medium tracking-wide uppercase text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                Auto
              </span>
            )}
            {familyMode === 'manual' && (
              <span className="ml-2 text-[10.5px] font-medium tracking-wide uppercase text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                Manual
              </span>
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
