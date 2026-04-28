'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Accessories } from '@/lib/validators/entities';
import {
  TIE_DOWN_LUG_RATINGS,
  LUG_GRADES,
  HANDRAIL_TYPES,
  LADDER_TYPES,
  LADDER_LOCATIONS,
  SAF_T_CLIMB,
  SMART_BOB,
  INSULATION,
  VENT_KINDS,
} from '@/lib/validators/entities';

/**
 * AccessoriesSection — full PTI accessory configurator.
 *
 * Lives at the bottom of the Geometry step (Step 2). Captures every option
 * surfaced in jobcalc12.2.99.xls (Quote2 sheet dropdowns + Accessories +
 * Raw Materials lookup tables). Each option group is a `<details>` panel
 * so the form stays compact for routine quotes; Bryneer or RTP-1 jobs
 * that touch many groups can pop them all open and configure in place.
 *
 * Persistence: serializes the entire `Accessories` object into a hidden
 * `accessoriesJson` input. The server action parses it through
 * `accessoriesSchema` in `lib/validators/entities.ts`, then merges into
 * the persisted geometry. The pricing engine consumes the same shape via
 * `JobCalcInputs.accessories`.
 *
 * Defaults sync: listens for `tank-type:apply-defaults` events broadcast
 * by `TankTypeDefaultsApplier`, replacing local state with the new
 * tank-type-specific accessory bundle (e.g. selecting "Bryneer™" auto-
 * fills SmartBob AO, kamlock, breather bag, etc.).
 */

const lugRatingOptions = TIE_DOWN_LUG_RATINGS as readonly number[];

const LUG_GRADE_LABEL: Record<(typeof LUG_GRADES)[number], string> = {
  zinc_plated_steel: 'Zinc-plated steel',
  ss304: '304 SS',
  ss316: '316 SS',
  titanium: 'Titanium',
};

const HANDRAIL_LABEL: Record<(typeof HANDRAIL_TYPES)[number], string> = {
  none: 'None',
  frp: 'FRP',
  frp_3rail: 'FRP 3-rail',
  aluminum: 'Aluminum',
  steel: 'Steel',
};

const LADDER_LABEL: Record<(typeof LADDER_TYPES)[number], string> = {
  none: 'None',
  frp: 'FRP',
  aluminum: 'Aluminum',
  galvanized_steel: 'Galvanized steel',
};

const SMART_BOB_LABEL: Record<(typeof SMART_BOB)[number], string> = {
  none: 'None',
  binmaster_ao: 'Binmaster SmartBob AO',
  binmaster_ao_heater: 'Binmaster AO + heater',
  binmaster_sbr_ii: 'Binmaster SBR II',
};

const INSULATION_LABEL: Record<(typeof INSULATION)[number], string> = {
  none: 'None',
  '1_layer': '1″ insulation',
  '2_layer': '2″ insulation',
};

const VENT_LABEL: Record<(typeof VENT_KINDS)[number], string> = {
  gooseneck: 'Gooseneck',
  mushroom: 'Mushroom',
  v: '“V” vent',
};

export function AccessoriesSection({ initial }: { initial: Accessories }) {
  const [a, setA] = useState<Accessories>(initial);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accessories?: Accessories }>).detail;
      if (detail?.accessories) setA(detail.accessories);
    };
    window.addEventListener('tank-type:apply-defaults', handler);
    return () => window.removeEventListener('tank-type:apply-defaults', handler);
  }, []);

  // Patch helper — keeps the merge depth predictable.
  const patch = <K extends keyof Accessories>(key: K, value: Partial<Accessories[K]> | Accessories[K]) => {
    setA((prev) => {
      const cur = prev[key];
      const merged = (typeof cur === 'object' && cur !== null && !Array.isArray(cur))
        ? { ...(cur as object), ...(value as object) }
        : value;
      return { ...prev, [key]: merged } as Accessories;
    });
  };

  return (
    <section>
      <h3 className="section-head">Accessories</h3>
      <p className="text-[13px] text-slate-500 -mt-2 mb-3">
        Process fittings, anchorage, access, indicators, insulation, documentation. Defaults match the selected
        tank type — refine before saving.
      </p>

      {/* The hidden field that the server action parses. Updated on every
          accessories change so the form is always submission-ready. */}
      <input type="hidden" name="accessoriesJson" value={JSON.stringify(a)} readOnly />

      <div className="space-y-3">
        {/* ─── Top access ─────────────────────────────────────────── */}
        <Group title="Top Access" hint="Manway type + size, optional split/hinged top cover.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="glass-label">Manway type</label>
              <select
                value={a.manway.type}
                onChange={(e) => patch('manway', { type: e.target.value as Accessories['manway']['type'] })}
                className="glass-input"
              >
                <option value="none">None</option>
                <option value="top_hinged">Top hinged</option>
                <option value="top_flanged">Top flanged</option>
                <option value="side_flanged">Side flanged</option>
              </select>
            </div>
            <div>
              <label className="glass-label">Diameter (in)</label>
              <select
                value={a.manway.diameterIn}
                onChange={(e) => patch('manway', { diameterIn: Number(e.target.value) })}
                className="glass-input"
                disabled={a.manway.type === 'none'}
              >
                {[18, 20, 22, 24, 30, 36].map((d) => (
                  <option key={d} value={d}>{d}″</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={a.splitHingedTopCover}
                onChange={(e) => patch('splitHingedTopCover', e.target.checked)}
              />
              <span>Split / hinged top cover</span>
            </label>
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={a.sightGlass.enabled}
                onChange={(e) => patch('sightGlass', { enabled: e.target.checked })}
              />
              <span>Sight glass</span>
            </label>
            {a.sightGlass.enabled && (
              <select
                value={a.sightGlass.sizeIn}
                onChange={(e) => patch('sightGlass', { sizeIn: Number(e.target.value) })}
                className="glass-input shrink-0"
                style={{ width: 100 }}
                aria-label="Sight glass size"
              >
                {[1, 2, 3].map((s) => <option key={s} value={s}>{s}″</option>)}
              </select>
            )}
          </div>
        </Group>

        {/* ─── Vents ──────────────────────────────────────────────── */}
        <Group title="Vents" hint="Gooseneck / mushroom / V-vent — adds or replaces nozzle vents.">
          <ListEditor<Accessories['vents'][number]>
            items={a.vents}
            empty={{ kind: 'gooseneck', sizeIn: 4, quantity: 1 }}
            onChange={(items) => setA((p) => ({ ...p, vents: items }))}
            columns={['1fr', '1fr', '80px', '36px']}
            headers={['Kind', 'Size (in)', 'Qty']}
            row={(v, update) => (
              <>
                <select value={v.kind} onChange={(e) => update({ kind: e.target.value as typeof v.kind })} className="glass-input">
                  {VENT_KINDS.map((k) => <option key={k} value={k}>{VENT_LABEL[k]}</option>)}
                </select>
                <select value={v.sizeIn} onChange={(e) => update({ sizeIn: Number(e.target.value) })} className="glass-input">
                  {[0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 10, 12, 18, 24].map((s) => <option key={s} value={s}>{s}″</option>)}
                </select>
                <input type="number" min={1} max={20} value={v.quantity} onChange={(e) => update({ quantity: Number(e.target.value) || 1 })} className="glass-input" />
              </>
            )}
          />
        </Group>

        {/* ─── Pipes / blind flanges ──────────────────────────────── */}
        <Group title="Internal Piping & Blinds" hint="Dip pipes for fluid distribution; blind flanges for unused nozzles.">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Dip pipes</div>
              <ListEditor<Accessories['dipPipes'][number]>
                items={a.dipPipes}
                empty={{ diameterIn: 2, lengthIn: 60 }}
                onChange={(items) => setA((p) => ({ ...p, dipPipes: items }))}
                columns={['1fr', '1fr', '36px']}
                headers={['Diameter (in)', 'Length (in)']}
                row={(v, update) => (
                  <>
                    <select value={v.diameterIn} onChange={(e) => update({ diameterIn: Number(e.target.value) })} className="glass-input">
                      {[1, 1.5, 2, 3, 4, 6].map((d) => <option key={d} value={d}>{d}″</option>)}
                    </select>
                    <input type="number" min={6} max={600} step={1} value={v.lengthIn} onChange={(e) => update({ lengthIn: Number(e.target.value) || 60 })} className="glass-input" />
                  </>
                )}
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Blind flanges</div>
              <ListEditor<Accessories['blindFlanges'][number]>
                items={a.blindFlanges}
                empty={{ diameterIn: 2, material: 'frp', quantity: 1 }}
                onChange={(items) => setA((p) => ({ ...p, blindFlanges: items }))}
                columns={['1fr', '1fr', '80px', '36px']}
                headers={['Diameter (in)', 'Material', 'Qty']}
                row={(v, update) => (
                  <>
                    <select value={v.diameterIn} onChange={(e) => update({ diameterIn: Number(e.target.value) })} className="glass-input">
                      {[0.5, 1, 2, 4, 6, 12, 18].map((d) => <option key={d} value={d}>{d}″</option>)}
                    </select>
                    <select value={v.material} onChange={(e) => update({ material: e.target.value as 'frp' | 'pvc' })} className="glass-input">
                      <option value="frp">FRP</option>
                      <option value="pvc">PVC</option>
                    </select>
                    <input type="number" min={1} max={20} value={v.quantity} onChange={(e) => update({ quantity: Number(e.target.value) || 1 })} className="glass-input" />
                  </>
                )}
              />
            </div>
          </div>
        </Group>

        {/* ─── Anchorage ──────────────────────────────────────────── */}
        <Group title="Anchorage" hint="Tie-down lugs, lifting channels, encapsulation.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tie-down lugs */}
            <div className="rounded-lg bg-slate-50/40 p-3 border border-slate-200/60">
              <label className="toggle-pill mb-2">
                <input
                  type="checkbox"
                  checked={a.tieDownLugs.enabled}
                  onChange={(e) => patch('tieDownLugs', { enabled: e.target.checked })}
                />
                <span>Tie-down lugs</span>
              </label>
              {a.tieDownLugs.enabled && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <select
                    value={a.tieDownLugs.ratingLb}
                    onChange={(e) => patch('tieDownLugs', { ratingLb: Number(e.target.value) })}
                    className="glass-input"
                  >
                    {lugRatingOptions.map((r) => <option key={r} value={r}>{r.toLocaleString()} lb</option>)}
                  </select>
                  <select
                    value={a.tieDownLugs.grade}
                    onChange={(e) => patch('tieDownLugs', { grade: e.target.value as (typeof LUG_GRADES)[number] })}
                    className="glass-input"
                  >
                    {LUG_GRADES.map((g) => <option key={g} value={g}>{LUG_GRADE_LABEL[g]}</option>)}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={a.tieDownLugs.quantity}
                    onChange={(e) => patch('tieDownLugs', { quantity: Number(e.target.value) || 0 })}
                    className="glass-input"
                    aria-label="Lug quantity"
                    placeholder="qty"
                  />
                  <label className="toggle-pill col-span-3 mt-1">
                    <input
                      type="checkbox"
                      checked={a.tieDownLugs.encapsulated}
                      onChange={(e) => patch('tieDownLugs', { encapsulated: e.target.checked })}
                    />
                    <span>Encapsulated</span>
                  </label>
                </div>
              )}
            </div>

            {/* Lifting channels */}
            <div className="rounded-lg bg-slate-50/40 p-3 border border-slate-200/60">
              <label className="toggle-pill mb-2">
                <input
                  type="checkbox"
                  checked={a.liftingChannels.enabled}
                  onChange={(e) => patch('liftingChannels', { enabled: e.target.checked })}
                />
                <span>Lifting channels</span>
              </label>
              {a.liftingChannels.enabled && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <select
                    value={a.liftingChannels.grade}
                    onChange={(e) => patch('liftingChannels', { grade: e.target.value as (typeof LUG_GRADES)[number] })}
                    className="glass-input col-span-2"
                  >
                    {LUG_GRADES.map((g) => <option key={g} value={g}>{LUG_GRADE_LABEL[g]}</option>)}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={a.liftingChannels.quantity}
                    onChange={(e) => patch('liftingChannels', { quantity: Number(e.target.value) || 0 })}
                    className="glass-input"
                    aria-label="Channel quantity"
                    placeholder="qty"
                  />
                  <label className="toggle-pill col-span-3 mt-1">
                    <input
                      type="checkbox"
                      checked={a.liftingChannels.encapsulated}
                      onChange={(e) => patch('liftingChannels', { encapsulated: e.target.checked })}
                    />
                    <span>Encapsulated</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </Group>

        {/* ─── Access & egress ─────────────────────────────────────── */}
        <Group title="Access & Egress" hint="Ladder, cage, handrail, platforms, Saf-T-Climb.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50/40 p-3 border border-slate-200/60 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Ladder</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={a.ladder.type}
                  onChange={(e) => {
                    const next = e.target.value as (typeof LADDER_TYPES)[number];
                    // Switching to "None" clears every dependent toggle so
                    // the saved revision can't carry stale `cage:true` /
                    // `walkthru:true` flags from a prior selection.
                    if (next === 'none') {
                      patch('ladder', { type: next, cage: false, walkthru: false, roofturn: false });
                    } else {
                      patch('ladder', { type: next });
                    }
                  }}
                  className="glass-input"
                >
                  {LADDER_TYPES.map((t) => <option key={t} value={t}>{LADDER_LABEL[t]}</option>)}
                </select>
                <select value={a.ladder.location} onChange={(e) => patch('ladder', { location: e.target.value as (typeof LADDER_LOCATIONS)[number] })} className="glass-input" disabled={a.ladder.type === 'none'}>
                  {LADDER_LOCATIONS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="toggle-pill"><input type="checkbox" checked={a.ladder.cage} onChange={(e) => patch('ladder', { cage: e.target.checked })} disabled={a.ladder.type === 'none'} /><span>Cage</span></label>
                <label className="toggle-pill"><input type="checkbox" checked={a.ladder.walkthru} onChange={(e) => patch('ladder', { walkthru: e.target.checked })} disabled={a.ladder.type === 'none'} /><span>Walk-thru</span></label>
                <label className="toggle-pill"><input type="checkbox" checked={a.ladder.roofturn} onChange={(e) => patch('ladder', { roofturn: e.target.checked })} disabled={a.ladder.type === 'none'} /><span>Roof-turn</span></label>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50/40 p-3 border border-slate-200/60 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Handrail</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={a.handrail.type}
                  onChange={(e) => {
                    const next = e.target.value as (typeof HANDRAIL_TYPES)[number];
                    // None clears the self-close-gate flag too.
                    if (next === 'none') {
                      patch('handrail', { type: next, selfCloseGate: false });
                    } else {
                      patch('handrail', { type: next });
                    }
                  }}
                  className="glass-input"
                >
                  {HANDRAIL_TYPES.map((t) => <option key={t} value={t}>{HANDRAIL_LABEL[t]}</option>)}
                </select>
                <select value={a.handrail.location} onChange={(e) => patch('handrail', { location: e.target.value as (typeof LADDER_LOCATIONS)[number] })} className="glass-input" disabled={a.handrail.type === 'none'}>
                  {LADDER_LOCATIONS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
              <label className="toggle-pill"><input type="checkbox" checked={a.handrail.selfCloseGate} onChange={(e) => patch('handrail', { selfCloseGate: e.target.checked })} disabled={a.handrail.type === 'none'} /><span>Self-close gate</span></label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="toggle-pill"><input type="checkbox" checked={a.restPlatform} onChange={(e) => patch('restPlatform', e.target.checked)} /><span>Rest platform</span></label>
            <select value={a.safTClimb} onChange={(e) => patch('safTClimb', e.target.value as (typeof SAF_T_CLIMB)[number])} className="glass-input shrink-0" style={{ width: 220 }} aria-label="Saf-T-Climb">
              <option value="none">No Saf-T-Climb</option>
              <option value="standard">Saf-T-Climb (standard)</option>
              <option value="with_cage">Saf-T-Climb + cage</option>
            </select>
          </div>
        </Group>

        {/* ─── Mixing / agitation ─────────────────────────────────── */}
        <Group title="Mixing & Agitation" hint="Agitator support, mixer pad. Baffle setup is in the section above.">
          <div className="flex flex-wrap gap-2">
            <label className="toggle-pill"><input type="checkbox" checked={a.agitatorSupport.enabled} onChange={(e) => patch('agitatorSupport', { enabled: e.target.checked })} /><span>Agitator support</span></label>
            <label className="toggle-pill"><input type="checkbox" checked={a.agitatorSupport.encapsulated} onChange={(e) => patch('agitatorSupport', { encapsulated: e.target.checked })} disabled={!a.agitatorSupport.enabled} /><span>Encapsulated</span></label>
            <label className="toggle-pill"><input type="checkbox" checked={a.mixerPad} onChange={(e) => patch('mixerPad', e.target.checked)} /><span>Mixer pad</span></label>
          </div>
        </Group>

        {/* ─── Insulation & heat trace ────────────────────────────── */}
        <Group title="Insulation & Heat Trace" hint="Foam insulation layers + Plastatherm electrical heat tracing.">
          {/* Insulation dropdown sits at the top; the Heater Configurator
              block (formerly "Plastatherm heat trace") drops below it so
              the rep reads top-down: choose insulation, then size the
              heater package against it. All fields bottom-justify so
              labels align even when adjacent helper rows differ. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="glass-label">Insulation</label>
              <select value={a.insulation} onChange={(e) => patch('insulation', e.target.value as (typeof INSULATION)[number])} className="glass-input">
                {INSULATION.map((k) => <option key={k} value={k}>{INSULATION_LABEL[k]}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50/40 p-3 border border-slate-200/60 space-y-3 mt-4">
            <label className="toggle-pill"><input type="checkbox" checked={a.plastatherm.enabled} onChange={(e) => patch('plastatherm', { enabled: e.target.checked })} /><span>Heater Configurator</span></label>
            {a.plastatherm.enabled && (
              <>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="glass-label">Voltage</label>
                    <select value={a.plastatherm.operatingVoltage} onChange={(e) => patch('plastatherm', { operatingVoltage: e.target.value as '120' | '240' | '480' })} className="glass-input">
                      <option value="120">120 V</option>
                      <option value="240">240 V</option>
                      <option value="480">480 V</option>
                    </select>
                  </div>
                  <div>
                    <label className="glass-label">Maintain (°F)</label>
                    <input type="number" min={0} max={300} value={a.plastatherm.maintainTempF} onChange={(e) => patch('plastatherm', { maintainTempF: Number(e.target.value) || 60 })} className="glass-input" />
                  </div>
                  <div>
                    <label className="glass-label">Min outdoor (°F)</label>
                    <input type="number" min={-50} max={120} value={a.plastatherm.minTempF} onChange={(e) => patch('plastatherm', { minTempF: Number(e.target.value) || 20 })} className="glass-input" />
                  </div>
                </div>
                {/* HTD insulation + support inputs — these flow into
                    `lib/pricing/htd-engine.ts` to size the heater
                    package (panels / controllers / tape) and price
                    it through the line-item engine. */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="glass-label">Insulation type</label>
                    <select
                      value={a.plastatherm.insulationType}
                      onChange={(e) => patch('plastatherm', { insulationType: e.target.value as Accessories['plastatherm']['insulationType'] })}
                      className="glass-input"
                    >
                      <option value="fiberglass">Fiberglass</option>
                      <option value="polyurethane">Polyurethane</option>
                      <option value="polyisocyanurate">Polyisocyanurate</option>
                      <option value="polystyrene">Polystyrene</option>
                      <option value="cellular_glass">Cellular glass</option>
                      <option value="calcium_silicate">Calcium silicate</option>
                    </select>
                  </div>
                  <div>
                    <label className="glass-label">Thickness (in)</label>
                    <select
                      value={String(a.plastatherm.insulationThicknessIn)}
                      onChange={(e) => patch('plastatherm', { insulationThicknessIn: Number(e.target.value) as Accessories['plastatherm']['insulationThicknessIn'] })}
                      className="glass-input"
                    >
                      {[1, 1.5, 2, 3, 4].map((t) => <option key={t} value={t}>{t}″</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="glass-label">Wind speed (mph)</label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={a.plastatherm.windSpeedMph}
                      onChange={(e) => patch('plastatherm', { windSpeedMph: Number(e.target.value) || 0 })}
                      className="glass-input"
                    />
                  </div>
                  <div>
                    <label className="glass-label">Safety factor</label>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={a.plastatherm.safetyFactor}
                      onChange={(e) => patch('plastatherm', { safetyFactor: Number(e.target.value) || 0 })}
                      className="glass-input"
                    />
                  </div>
                  <div>
                    <label className="glass-label">Support style</label>
                    <select
                      value={a.plastatherm.supportStyle}
                      onChange={(e) => patch('plastatherm', { supportStyle: e.target.value as Accessories['plastatherm']['supportStyle'] })}
                      className="glass-input"
                    >
                      <option value="concrete_pad">Concrete pad</option>
                      <option value="saddles">Saddles</option>
                      <option value="legs">Legs</option>
                      <option value="skirt">Skirt</option>
                    </select>
                  </div>
                  <div>
                    <label className="glass-label">No. of supports</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={a.plastatherm.numSupports}
                      onChange={(e) => patch('plastatherm', { numSupports: Number(e.target.value) || 0 })}
                      className="glass-input"
                    />
                  </div>
                </div>
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    checked={a.plastatherm.manwayInsulated}
                    onChange={(e) => patch('plastatherm', { manwayInsulated: e.target.checked })}
                  />
                  <span>Manways insulated</span>
                </label>
              </>
            )}
          </div>
        </Group>

        {/* ─── Indicators & signage ───────────────────────────────── */}
        <Group title="Indicators & Signage" hint="SmartBob / Binmaster, nameplate, vent tags, level indicator strip.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="glass-label">SmartBob (Binmaster)</label>
              <select value={a.smartBob} onChange={(e) => patch('smartBob', e.target.value as (typeof SMART_BOB)[number])} className="glass-input">
                {SMART_BOB.map((k) => <option key={k} value={k}>{SMART_BOB_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="glass-label">Pipe support clips (count)</label>
              <input type="number" min={0} max={40} value={a.pipeSupportClips} onChange={(e) => patch('pipeSupportClips', Number(e.target.value) || 0)} className="glass-input" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="toggle-pill"><input type="checkbox" checked={a.nameplate} onChange={(e) => patch('nameplate', e.target.checked)} /><span>Nameplate</span></label>
            <label className="toggle-pill"><input type="checkbox" checked={a.ventTags} onChange={(e) => patch('ventTags', e.target.checked)} /><span>Vent tags</span></label>
            <label className="toggle-pill"><input type="checkbox" checked={a.liquidLevelIndicator} onChange={(e) => patch('liquidLevelIndicator', e.target.checked)} /><span>Liquid-level indicator strip</span></label>
          </div>
        </Group>

        {/* ─── Documentation & QA ─────────────────────────────────── */}
        <Group title="Documentation & QA" hint="Hydrotest, P.E. calcs, anchor templates, O&amp;M manuals.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="glass-label">O&amp;M manuals (count)</label>
              <input type="number" min={0} max={10} value={a.oAndMManuals} onChange={(e) => patch('oAndMManuals', Number(e.target.value) || 0)} className="glass-input" />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="toggle-pill"><input type="checkbox" checked={a.hydrotest} onChange={(e) => patch('hydrotest', e.target.checked)} /><span>Hydrotest</span></label>
              <label className="toggle-pill"><input type="checkbox" checked={a.peCalcs} onChange={(e) => patch('peCalcs', e.target.checked)} /><span>P.E. calcs</span></label>
              <label className="toggle-pill"><input type="checkbox" checked={a.anchorBoltTemplates} onChange={(e) => patch('anchorBoltTemplates', e.target.checked)} /><span>Anchor templates</span></label>
            </div>
          </div>
        </Group>

        {/* ─── Bryneer™ branded package ───────────────────────────── */}
        <Group title="Bryneer™ Salt-Brine Package" hint="Auto-enables when tank type = Bryneer; un-toggle anything that doesn't apply.">
          <label className="toggle-pill">
            <input type="checkbox" checked={a.bryneerPackage.enabled} onChange={(e) => patch('bryneerPackage', { enabled: e.target.checked })} />
            <span>Bryneer™ package</span>
          </label>
          {a.bryneerPackage.enabled && (
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="toggle-pill"><input type="checkbox" checked={a.bryneerPackage.breatherBag} onChange={(e) => patch('bryneerPackage', { breatherBag: e.target.checked })} /><span>Breather bag</span></label>
              <label className="toggle-pill"><input type="checkbox" checked={a.bryneerPackage.kamlockCoupling} onChange={(e) => patch('bryneerPackage', { kamlockCoupling: e.target.checked })} /><span>Kamlock coupling</span></label>
              <label className="toggle-pill"><input type="checkbox" checked={a.bryneerPackage.solenoidValve} onChange={(e) => patch('bryneerPackage', { solenoidValve: e.target.checked })} /><span>Solenoid valve</span></label>
              <label className="toggle-pill"><input type="checkbox" checked={a.bryneerPackage.flowValve} onChange={(e) => patch('bryneerPackage', { flowValve: e.target.checked })} /><span>Dole flow valve</span></label>
              <label className="toggle-pill"><input type="checkbox" checked={a.bryneerPackage.saltPipeStandoff} onChange={(e) => patch('bryneerPackage', { saltPipeStandoff: e.target.checked })} /><span>Salt-pipe standoff</span></label>
            </div>
          )}
        </Group>
      </div>
    </section>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function Group({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none flex items-baseline justify-between">
        <div>
          <span className="font-semibold text-slate-800 text-[14px]">{title}</span>
          <span className="ml-2 text-[12px] text-slate-500">{hint}</span>
        </div>
        <span className="text-slate-400 group-open:rotate-90 transition-transform select-none">›</span>
      </summary>
      <div className="mt-3 pt-2 border-t border-slate-100">{children}</div>
    </details>
  );
}

/**
 * Generic add/remove list editor with header row + per-row delete. Matches
 * the visual language of `NozzleSchedule` so the geometry step reads as
 * one consistent form.
 */
function ListEditor<T>({
  items,
  empty,
  onChange,
  columns,
  headers,
  row,
}: {
  items: T[];
  empty: T;
  onChange: (next: T[]) => void;
  columns: string[];
  headers: string[];
  row: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const colCss = columns.join(' ');
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="grid gap-3 px-1 pb-1" style={{ gridTemplateColumns: colCss }}>
          {headers.map((h, i) => <span key={i} className="glass-label mb-0">{h}</span>)}
          <span />
        </div>
      )}
      {items.map((item, idx) => (
        <div
          key={idx}
          className="grid gap-3 items-center"
          style={{ gridTemplateColumns: colCss }}
        >
          {row(item, (p) => onChange(items.map((it, i) => (i === idx ? { ...it, ...p } : it))))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            aria-label="Remove row"
            className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...empty }])}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] text-slate-600 hover:text-slate-900 rounded-md border border-dashed border-slate-300 hover:border-slate-400 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add row
      </button>
    </div>
  );
}
