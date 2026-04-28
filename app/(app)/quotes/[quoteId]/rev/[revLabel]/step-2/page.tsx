import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveGeometryStep } from '@/lib/actions/revisions';
import { NozzleSchedule } from '@/components/wizard/NozzleSchedule';
import { LivePricingSync } from '@/components/wizard/LivePricingSync';
import { AccessoriesSection } from '@/components/wizard/AccessoriesSection';
import { TankTypeDefaultsApplier } from '@/components/wizard/TankTypeDefaultsApplier';
import { FormKeyGuard } from '@/components/wizard/FormKeyGuard';
import { computeStepCompleteness, resolveGuardedStep } from '@/lib/revisions/completeness';
import { accessoriesSchema } from '@/lib/validators/entities';
import { getDefaultsForTankType } from '@/lib/catalog/tank-type-defaults';

// Stand types — pared back to the four PTI offers in production: FRP,
// 304 SS, 316 SS, and an FRP skirt. `none` = vessel sits on its bottom
// flange / ring support, no discrete stand.
const STAND_LABEL: Array<[string, string]> = [
  ['none',  'None (ring-supported)'],
  ['frp',   'FRP'],
  ['ss304', 'Stainless 304'],
  ['ss316', 'Stainless 316'],
  ['skirt', 'FRP Skirt'],
];

// Pretty labels for the Step-1 top/bottom selections — used in the
// echo bar above so the rep sees real words ("Dished") instead of the
// schema's machine codes (`F_AND_D`).
const TOP_LABEL: Record<string, string> = {
  flat:           'Flat',
  F_AND_D:        'Dished',
  conical:        'Conical',
  open_top_cover: 'Open w/ cover',
};
const BOTTOM_LABEL: Record<string, string> = {
  flat_ring_supported: 'Flat',
  dished:              'Dished',
  conical_drain:       'Conical',
  sloped:              'Sloped',
};

export default async function Step2({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  // Don't let reps land on Step 2 with an unfinished Step 1 — catches
  // URL-manipulation, stale tabs, cloned-revision seed states. The guard
  // mirrors the client-side WizardShell nav lock so the two stay in sync.
  const completeness = computeStepCompleteness({
    revision: rev,
    quote: { totalPrice: rev.quote.totalPrice ?? null },
  });
  const allowed = resolveGuardedStep('step-2', completeness);
  if (allowed !== 'step-2') redirect(`/quotes/${quoteId}/rev/${revLabel}/${allowed}`);

  const g: any = rev.geometry ?? {};
  const s: any = rev.service ?? {};
  // Pre-populate the Accessories section with whatever the rev already
  // has, falling back to the tank-type-specific defaults so a fresh quote
  // (e.g. a Bryneer™ pick on Step 1) lands on Step 2 with everything
  // sensibly filled in.
  const accessoriesInitial = (() => {
    if (g.accessories) {
      const parsed = accessoriesSchema.safeParse(g.accessories);
      if (parsed.success) return parsed.data;
    }
    return getDefaultsForTankType(s.tankType).accessories;
  })();
  const save = saveGeometryStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-2">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 2 of 4
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Fittings &amp; Accessories</h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Nozzle schedule, baffles, stand, and the full accessory package. Vessel size + heads live on Step 1.
        </p>
      </header>

      <form action={save} className="space-y-8">
        <LivePricingSync />
        <TankTypeDefaultsApplier />
        <FormKeyGuard />

        {/* Compact echo of the Design Conditions already captured on
            Step 1 so the rep can confirm size + heads while configuring
            fittings — edit on Step 1 to change. Shown in feet (DB
            remains inches). Labels are Title Case to match the rest of
            the configurator's section heads. */}
        <section className="rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-3 text-[13px]">
          {/* `flex-nowrap` + `whitespace-nowrap` per item keeps the
              echo on a single line; "Orient." shortened from
              "Orientation" so the seven items fit at typical desktop
              widths without truncation. */}
          <div className="flex flex-nowrap items-baseline gap-x-5 text-slate-600 overflow-x-auto">
            <span className="whitespace-nowrap"><strong className="text-slate-800 capitalize">{g.orientation ?? '—'}</strong> Orient.</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">{g.idIn != null ? +(g.idIn / 12).toFixed(2) : '—'}'</strong> Diameter</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">{g.ssHeightIn != null ? +(g.ssHeightIn / 12).toFixed(2) : '—'}'</strong> SS Height</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">{g.freeboardIn != null ? +(g.freeboardIn / 12).toFixed(2) : '—'}'</strong> Freeboard</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">{TOP_LABEL[g.topHead ?? 'F_AND_D']}</strong> Top</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">{BOTTOM_LABEL[g.bottom ?? 'flat_ring_supported']}</strong> Bottom</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">{g.doubleWall ? 'Double' : 'Single'}</strong> Wall</span>
            <span className="whitespace-nowrap"><strong className="text-slate-800">×{g.quantity ?? 1}</strong> Vessel{(g.quantity ?? 1) > 1 ? 's' : ''}</span>
          </div>
        </section>

        {/* Step 1 owns top/bottom; we re-emit them as hidden inputs so
            the form continues to POST a complete `geometry` payload. */}
        <input type="hidden" name="topHead" value={g.topHead ?? 'F_AND_D'} />
        <input type="hidden" name="bottom"  value={g.bottom  ?? 'flat_ring_supported'} />

        <section>
          <h3 className="section-head">Nozzles &amp; Connections</h3>
          <p className="text-[13px] text-slate-500 mb-3 -mt-2">
            Inlets, outlets, manways, vents, and instrument ports.
          </p>
          <NozzleSchedule initial={Array.isArray(g.nozzles) ? g.nozzles : []} />
        </section>

        <section>
          <h3 className="section-head">Interior Baffles</h3>
          <p className="text-[12.5px] text-slate-500 -mt-2 mb-3">
            Set Number of Baffles to 0 to omit them. Length defaults to 90% of straight-side height.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="glass-label" htmlFor="baffleCount">Number of Baffles</label>
              <input
                id="baffleCount"
                type="number"
                min={0}
                step={1}
                name="baffleCount"
                defaultValue={g.baffleCount ?? 0}
                className="glass-input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="glass-label" htmlFor="baffleType">Type</label>
              <select
                id="baffleType"
                name="baffleType"
                defaultValue={g.baffleType ?? 'plate'}
                className="glass-input"
              >
                <option value="plate">Plate</option>
                <option value="wedge">Wedge</option>
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="baffleLengthFt">Length (ft)</label>
              <input
                id="baffleLengthFt"
                type="number"
                min={0}
                max={50}
                step="any"
                name="baffleLengthFt"
                defaultValue={
                  g.baffleLengthFt != null && g.baffleLengthFt > 0
                    ? Number(g.baffleLengthFt)
                    : g.ssHeightIn != null
                      ? Number(((g.ssHeightIn / 12) * 0.9).toFixed(2))
                      : ''
                }
                className="glass-input"
                placeholder="auto = 90% of SS height"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="section-head">Stands</h3>
          <p className="text-[12.5px] text-slate-500 -mt-2 mb-3">
            FRP or stainless leg-stand, or an FRP skirt. Choose <em>None</em> if the vessel sits on its bottom ring support.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="glass-label" htmlFor="standType">Type</label>
              <select
                id="standType"
                name="standType"
                defaultValue={(g.standType
                  ?? (g.stainlessStand
                    ? (g.stainlessGrade === 'SS316' || g.stainlessGrade === 'SS316L' ? 'ss316' : 'ss304')
                    : 'none')) as string}
                className="glass-input"
              >
                {STAND_LABEL.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="standHeightFt">Height (ft)</label>
              <input
                id="standHeightFt"
                name="standHeightFt"
                type="number"
                step="any"
                min={0}
                max={20}
                defaultValue={g.standHeightFt ?? 4}
                className="glass-input"
                placeholder="4"
              />
            </div>
          </div>
        </section>

        <AccessoriesSection initial={accessoriesInitial} />

        <div className="flex justify-end pt-4 border-t border-slate-200/60">
          <button className="btn-glass-prominent !px-3" aria-label="Next step">
            <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
