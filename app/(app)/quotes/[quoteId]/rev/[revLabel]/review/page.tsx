import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';
import { RULES_ENGINE_VERSION } from '@/lib/rules';
import { SEED_RESINS, CHEMICAL_FAMILY_LABEL } from '@/lib/catalog/seed-data';
import type { ChemicalFamily } from '@/lib/catalog/seed-data';
import { VEIL_OPTIONS } from '@/lib/pricing/jobcalc-catalog';
import { TANK_TYPE_BY_ID } from '@/lib/catalog/tank-types';
import { formatFormula } from '@/lib/format';
import { computeStepCompleteness, resolveGuardedStep } from '@/lib/revisions/completeness';
import { buildAccessoryDetail } from '@/lib/outputs/quote-pdf-data';
import { saveEngineeringNotes } from '@/lib/actions/revisions';

const RESIN_FAMILY_LABEL: Record<string, string> = {
  vinyl_ester: 'Vinyl Ester',
  bis_a_epoxy_ve: 'Bisphenol-A Epoxy VE',
  novolac_epoxy_ve: 'Novolac Epoxy VE',
  iso_polyester: 'Isophthalic Polyester',
  ortho_polyester: 'Orthophthalic Polyester',
  chlorendic_polyester: 'Chlorendic Polyester',
  bpa_fumarate: 'BPA Fumarate Polyester',
  elastomer_modified: 'Elastomer-Modified VE',
};

const TOP_LABEL: Record<string, string> = {
  flat: 'Flat',
  F_AND_D: 'Dished',
  conical: 'Conical',
  open_top_cover: 'Open w/ cover',
};
const BOTTOM_LABEL: Record<string, string> = {
  flat_ring_supported: 'Flat (ring-supported)',
  dished: 'Dished',
  conical_drain: 'Conical drain',
  sloped: 'Sloped',
};
const STAND_LABEL: Record<string, string> = {
  none: 'None (ring-supported)',
  frp: 'FRP',
  ss304: 'Stainless 304',
  ss316: 'Stainless 316',
  skirt: 'FRP Skirt',
};
const COLOR_LABEL: Record<string, string> = {
  wax: 'Wax (clear UV topcoat)',
  white: 'White gelcoat',
  grey: 'Grey gelcoat',
  other: 'Custom',
};

export default async function Review({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true, project: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const completeness = computeStepCompleteness({
    revision: rev,
    quote: { totalPrice: rev.quote.totalPrice ?? null },
  });
  const allowed = resolveGuardedStep('review', completeness);
  if (allowed !== 'review') redirect(`/quotes/${quoteId}/rev/${revLabel}/${allowed}`);

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );
  const sa = json.structural_analysis;

  const svc: any = rev.service ?? {};
  const certs: any = rev.certs ?? {};
  const geom: any = rev.geometry ?? {};
  const wall: any = rev.wallBuildup ?? {};
  const out:  any = rev.outputs   ?? {};

  const tankType = svc.tankType ? TANK_TYPE_BY_ID[svc.tankType] : null;
  const resin = wall.resinId ? SEED_RESINS.find((r) => r.id === wall.resinId) : null;
  const veil  = wall.veilId  ? VEIL_OPTIONS.find((v) => v.id === wall.veilId) : null;

  const idFt        = geom.idIn        != null ? +(geom.idIn        / 12).toFixed(2) : null;
  const ssHeightFt  = geom.ssHeightIn  != null ? +(geom.ssHeightIn  / 12).toFixed(2) : null;
  const freeboardFt = geom.freeboardIn != null ? +(geom.freeboardIn / 12).toFixed(2) : null;

  const standType =
    geom.standType ??
    (geom.stainlessStand
      ? (geom.stainlessGrade === 'SS316' || geom.stainlessGrade === 'SS316L' ? 'ss316' : 'ss304')
      : 'none');

  const accessoryDetail = buildAccessoryDetail(geom.accessories ?? null);
  const accessoriesByGroup = accessoryDetail.reduce<Record<string, typeof accessoryDetail>>((acc, row) => {
    (acc[row.group] ??= []).push(row);
    return acc;
  }, {});

  const nozzles: any[] = Array.isArray(geom.nozzles) ? geom.nozzles : [];

  const saveNotes = saveEngineeringNotes.bind(null, quoteId, revLabel);
  const existingNotes: string = typeof out.engineeringNotes === 'string' ? out.engineeringNotes : '';

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="review">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 3 of 4
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">
          Review &amp; Generate
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Final spec check before the recipient confirmation.
        </p>
      </header>

      <div className="banner-review mb-6">
        <span className="text-xl leading-none shrink-0" aria-hidden>⚠</span>
        <div>
          <strong className="font-semibold">Preliminary — Engineering Review Required.</strong>
          <p className="text-[13.5px] leading-relaxed mt-0.5 opacity-90">
            Calculations produced per ASCE 7-22, ASTM D3299/D4097, and RTP-1.
            A licensed PE must review before release for fabrication.
          </p>
        </div>
      </div>

      {/* ─── Step 1: Specifications, Service & Certifications ─── */}
      <Section label="Tank Type & Service">
        <Grid cols={3}>
          <KV label="Tank Type" value={tankType?.label ?? labelize(svc.tankType)} />
          <KV label="Chemical" value={formatFormula(svc.chemical) || '—'} />
          <KV label="Family" value={CHEMICAL_FAMILY_LABEL[svc.chemicalFamily as ChemicalFamily] ?? labelize(svc.chemicalFamily)} />
          <KV label="Concentration" value={svc.concentrationPct != null ? `${svc.concentrationPct}%` : '—'} />
          <KV label="Specific Gravity" value={svc.specificGravity ?? '—'} />
          <KV label="Post-Cure" value={svc.postCure ? 'Required' : 'Standard ambient cure'} />
        </Grid>
      </Section>

      <Section label="Design Conditions">
        <Grid cols={3}>
          <KV label="Orientation" value={labelize(geom.orientation)} />
          <KV label="Diameter" value={idFt != null ? `${idFt}'` : '—'} />
          <KV label="SS Height" value={ssHeightFt != null ? `${ssHeightFt}'` : '—'} />
          <KV label="Freeboard" value={freeboardFt != null ? `${freeboardFt}'` : '—'} />
          <KV label="Quantity" value={String(geom.quantity ?? 1)} />
          <KV label="Sidewall" value={geom.doubleWall ? 'Double-wall' : 'Single-wall'} />
          <KV label="Top Head" value={TOP_LABEL[geom.topHead] ?? labelize(geom.topHead)} />
          <KV label="Bottom" value={BOTTOM_LABEL[geom.bottom] ?? labelize(geom.bottom)} />
          <KV label="Operating Temp" value={svc.operatingTempF != null ? `${svc.operatingTempF}°F` : '—'} />
          <KV label="Design Temp" value={svc.designTempF != null ? `${svc.designTempF}°F` : '—'} />
          <KV label="Min Ambient" value={svc.minAmbientTempF != null ? `${svc.minAmbientTempF}°F` : '—'} />
          <KV label="Pressure" value={svc.operatingPressurePsig != null ? `${svc.operatingPressurePsig} psig` : 'Atmospheric'} />
          <KV label="Vacuum" value={svc.vacuumPsig != null ? `${svc.vacuumPsig} psig` : 'None'} />
          <KV label="Installation" value={labelize(svc.installationLocation)} />
          <KV label="Color" value={COLOR_LABEL[svc.tankColor] ?? labelize(svc.tankColor)} />
        </Grid>
      </Section>

      <Section label="Resin &amp; Veil">
        <Grid cols={2}>
          <KV label="Resin" value={resin ? `${resin.name} (${resin.supplier})` : 'Per specification'}
              hint={resin ? `${RESIN_FAMILY_LABEL[resin.family] ?? resin.family} · Max ${resin.max_service_temp_F}°F` : undefined} />
          <KV label="Surface Veil" value={veil?.label ?? '—'} hint={veil?.notes} />
        </Grid>
      </Section>

      <Section label="Certifications">
        <div className="flex flex-wrap gap-1.5">
          {certs.asmeRtp1Class && (
            <span className="glass-chip glass-tinted-slate">ASME RTP-1 Class {certs.asmeRtp1Class}</span>
          )}
          {certs.nsfAnsi61Required && <span className="glass-chip glass-tinted-emerald">NSF/ANSI 61</span>}
          {certs.nsfAnsi2Required  && <span className="glass-chip glass-tinted-emerald">NSF/ANSI 2</span>}
          {certs.astmD3299 && <span className="glass-chip">ASTM D-3299</span>}
          {certs.astmD4097 && <span className="glass-chip">ASTM D-4097</span>}
          {certs.astmD5685 && <span className="glass-chip">ASTM D-5685</span>}
          {certs.peStamp && <span className="glass-chip glass-tinted-amber">P.E. Stamp</span>}
          {certs.iccEsListed && <span className="glass-chip glass-tinted-amber">ICC-ES Listed</span>}
          {certs.thirdPartyInspector && certs.thirdPartyInspector !== 'NONE' && (
            <span className="glass-chip">Inspector: {certs.thirdPartyInspector}</span>
          )}
          {!certs.asmeRtp1Class &&
            !certs.nsfAnsi61Required &&
            !certs.nsfAnsi2Required &&
            !certs.astmD3299 &&
            !certs.astmD4097 &&
            !certs.astmD5685 &&
            !certs.peStamp &&
            !certs.iccEsListed && (
              <span className="text-[13px] text-slate-400">None selected</span>
            )}
        </div>
      </Section>

      {/* ─── Step 2: Fittings & Accessories ─── */}
      <Section label="Nozzles &amp; Connections">
        {nozzles.length > 0 ? (
          <ul className="divide-y divide-slate-200/80">
            {nozzles.map((n: any, idx: number) => (
              <li key={idx} className="flex items-center gap-3 py-2 text-[14px]">
                <span className="capitalize font-medium text-slate-900 flex-1">
                  {String(n.type).replace(/_/g, ' ')}
                </span>
                <span className="text-slate-600 font-mono tabular-nums text-[13px]">{n.sizeNps}</span>
                <span className="text-slate-500 font-mono tabular-nums text-[13px]">{n.rating}</span>
                <span className="text-slate-700 tabular-nums text-[13px]">× {n.quantity}</span>
              </li>
            ))}
            <li className="flex items-center justify-between pt-2 text-[12.5px] text-slate-500">
              <span>Total Connections</span>
              <span className="font-mono tabular-nums text-slate-700">
                {nozzles.reduce((sum: number, n: any) => sum + (Number(n.quantity) || 0), 0)}
              </span>
            </li>
          </ul>
        ) : (
          <div className="text-[13.5px] text-slate-500">No connections specified.</div>
        )}
      </Section>

      <Section label="Internals &amp; Support">
        <Grid cols={3}>
          <KV label="Baffles"
              value={geom.baffleCount && geom.baffleCount > 0
                ? `${geom.baffleCount} × ${labelize(geom.baffleType)}`
                : 'None'} />
          <KV label="Baffle Length"
              value={geom.baffleLengthFt && geom.baffleLengthFt > 0
                ? `${Number(geom.baffleLengthFt).toFixed(1)}'`
                : ssHeightFt != null
                  ? `${(ssHeightFt * 0.9).toFixed(1)}' (auto)`
                  : '—'} />
          <KV label="Stand"
              value={STAND_LABEL[standType] ?? labelize(standType)}
              hint={standType !== 'none' && geom.standHeightFt != null ? `${geom.standHeightFt}' tall` : undefined} />
        </Grid>
      </Section>

      <Section label="Accessories &amp; Configuration">
        {accessoryDetail.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(accessoriesByGroup).map(([group, rows]) => (
              <div key={group}>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-1.5">
                  {group}
                </div>
                <ul className="divide-y divide-slate-200/70">
                  {rows.map((row, i) => (
                    <li key={i} className="flex items-baseline gap-3 py-1.5 text-[13.5px]">
                      <span className="text-slate-500 w-40 shrink-0">{row.label}</span>
                      <span className="text-slate-900 flex-1">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13.5px] text-slate-500">No additional accessories specified.</div>
        )}
      </Section>

      {/* ─── Structural analysis (if available) ─── */}
      {sa && (
        <div className="bg-white/90 border border-slate-200/70 rounded-2xl p-6 mb-6"
             style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.7)' }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="section-head mb-0">Structural Analysis (Preliminary)</h3>
            <span className="glass-chip glass-tinted-amber text-[11px] shrink-0 whitespace-nowrap">
              Review Required
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Shell thickness" value={`${sa.wallThickness.shellThicknessIn}″`}
                    hint={`Governed by ${sa.wallThickness.governingRule.replace(/_/g, ' ')}`} />
            <Metric label="Head thickness" value={`${sa.wallThickness.headThicknessIn}″`} hint="1.15 × shell" />
            <Metric label="Wind base shear" value={`${sa.wind.baseShearLbf.toLocaleString()}`} suffix="lbf" />
            <Metric label="Seismic base shear" value={`${sa.seismic.baseShearLbf.toLocaleString()}`} suffix="lbf" />
            <Metric label="Governing case" value={sa.loadCombination.governingCase}
                    hint={`Uplift ${sa.loadCombination.governingUpliftLbf.toLocaleString()} lbf`} wide />
            <Metric label="Anchor" value={`${sa.anchor.qty} × ${sa.anchor.anchorDetailId}`}
                    hint={`${sa.anchor.selectedCapacityLbfEach.toLocaleString()} lbf each`} wide />
            <Metric label="Slosh freeboard" value={`${sa.seismic.requiredFreeboardIn}″ req`}
                    hint={`${json.geometry.freeboard_in}″ provided`} wide />
          </div>
        </div>
      )}

      {/* ─── Comments & Exceptions ─── */}
      <Section label="Comments &amp; Exceptions">
        <p className="text-[12.5px] text-slate-500 mb-3 -mt-1">
          Engineering-only notes. Captured in the Engineering JSON download but
          intentionally <strong className="text-slate-700">excluded</strong> from
          the customer-facing Quote PDF.
        </p>
        <form action={saveNotes} className="space-y-3">
          <textarea
            name="engineeringNotes"
            defaultValue={existingNotes}
            rows={5}
            maxLength={10_000}
            className="glass-input w-full resize-y"
            placeholder="Exceptions, RFIs, design intents, or any other notes for the engineering team…"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="text-[12.5px] font-medium text-slate-600 hover:text-amber-700 transition-colors px-3 py-1.5 rounded-md border border-slate-300/60 hover:border-amber-300/80 bg-white/60"
            >
              Save Notes
            </button>
          </div>
        </form>
      </Section>

      {/* ─── Action row ─── */}
      <div className="flex items-center justify-between gap-4 pt-6 mt-4 border-t border-slate-200">
        <div className="flex items-center gap-4">
          <a
            href={`/quotes/${quoteId}/rev/${revLabel}/quote.pdf?mode=inline`}
            target="_blank"
            rel="noopener"
            className="text-[13px] text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
          >
            Preview Quote PDF
          </a>
          <a
            href={`/quotes/${quoteId}/rev/${revLabel}/engineering.json`}
            className="text-[13px] text-slate-500 hover:text-slate-800 underline-offset-4 hover:underline"
          >
            Engineering JSON
          </a>
        </div>
        <Link
          href={`/quotes/${quoteId}/rev/${revLabel}/send`}
          className="btn-glass-prominent !px-3"
          aria-label="Next: confirm recipient"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </WizardShell>
  );
}

/* ── Layout primitives ───────────────────────────────────────────── */

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className="bg-white/85 border border-slate-200/60 rounded-2xl p-5 mb-4"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
        {label}
      </div>
      {children}
    </section>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  const cls = cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return <div className={`grid grid-cols-2 ${cls} gap-x-6 gap-y-3`}>{children}</div>;
}

function KV({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[14px] font-medium text-slate-900 mt-0.5">{value || '—'}</div>
      {hint && <div className="text-[11.5px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Metric({ label, value, hint, suffix, wide }: {
  label: string; value: string; hint?: string; suffix?: string; wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-2' : ''}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-[20px] font-semibold tracking-tight text-slate-900 leading-tight">
        {value}
        {suffix && <span className="text-[13px] font-normal text-slate-500 ml-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[12px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function labelize(value: string | null | undefined): string {
  if (!value) return '—';
  return value.toString().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
