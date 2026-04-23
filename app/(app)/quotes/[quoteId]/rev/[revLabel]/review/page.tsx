import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';
import { RULES_ENGINE_VERSION } from '@/lib/rules';
import { SEED_RESINS, CHEMICAL_FAMILY_LABEL } from '@/lib/catalog/seed-data';
import type { ChemicalFamily } from '@/lib/catalog/seed-data';
import { formatFormula } from '@/lib/format';

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

export default async function Review({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true, project: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );
  const sa = json.structural_analysis;

  const resinId = json.wall_buildup.corrosion_barrier.resin;
  const resin = resinId ? SEED_RESINS.find((r) => r.id === resinId) : null;

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="review">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 4 of 5
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card label="Service">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <div className="text-[20px] font-semibold tracking-tight text-slate-900 leading-none">
              {formatFormula(json.service.chemical)}
            </div>
            {json.service.concentration_pct != null && (
              <div className="text-[14px] font-medium text-slate-600 leading-none">
                {json.service.concentration_pct}%
              </div>
            )}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">
            {CHEMICAL_FAMILY_LABEL[json.service.chemical_family as ChemicalFamily] ??
              json.service.chemical_family.replace(/_/g, ' ')}
          </div>
          <div className="text-slate-600 text-[13px] mt-2.5">
            Op {json.service.operating_temp_F}°F · Design {json.service.design_temp_F}°F · SG {json.service.specific_gravity}
          </div>
          {json.service.post_cure && (
            <div className="mt-2.5">
              <span className="glass-chip glass-tinted-amber">Post-Cure Required</span>
            </div>
          )}
        </Card>

        <Card label="Certifications">
          <div className="flex flex-wrap gap-1.5">
            {json.certifications.asme_rtp1 && (
              <span className="glass-chip glass-tinted-slate">
                RTP-1 Class {json.certifications.asme_rtp1.class}
              </span>
            )}
            {json.certifications.nsf_ansi_61.required && (
              <span className="glass-chip glass-tinted-emerald">NSF/ANSI 61</span>
            )}
            {json.certifications.nsf_ansi_2.required && (
              <span className="glass-chip glass-tinted-emerald">NSF/ANSI 2</span>
            )}
            {!json.certifications.asme_rtp1 &&
              !json.certifications.nsf_ansi_61.required &&
              !json.certifications.nsf_ansi_2.required && (
                <span className="text-[13px] text-slate-400">None selected</span>
              )}
            {json.certifications.third_party_inspector !== 'NONE' && (
              <span className="glass-chip">
                Inspector: {json.certifications.third_party_inspector}
              </span>
            )}
          </div>
        </Card>

        <Card label="Geometry">
          <div className="text-[15px] font-medium capitalize">{json.geometry.orientation}</div>
          <div className="text-slate-600 text-[13px] mt-1">
            {json.geometry.id_in}&quot; ID × {json.geometry.ss_height_in}&quot; SS<br/>
            Top {json.geometry.top_head.replace(/_/g, ' ')} · Bottom {json.geometry.bottom.replace(/_/g, ' ')}
          </div>
        </Card>

        <Card label="Resin">
          {resin ? (
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-[16px] font-semibold text-slate-900">{resin.name}</div>
                <div className="text-[13px] text-slate-500">{resin.supplier}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <span className="glass-chip">{RESIN_FAMILY_LABEL[resin.family] ?? resin.family}</span>
                <span className="glass-chip">Max {resin.max_service_temp_F}°F</span>
              </div>
            </>
          ) : (
            <div className="text-slate-400 font-normal">No resin selected</div>
          )}
        </Card>

        <Card label="Nozzles & Connections" className="md:col-span-2">
          {Array.isArray(json.nozzles) && json.nozzles.length > 0 ? (
            <ul className="divide-y divide-slate-200/80">
              {json.nozzles.map((n: any, idx: number) => (
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
                  {json.nozzles.reduce((sum: number, n: any) => sum + (Number(n.quantity) || 0), 0)}
                </span>
              </li>
            </ul>
          ) : (
            <div className="text-[13.5px] text-slate-500">No connections specified.</div>
          )}
        </Card>
      </div>

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

      {/* Action row — Next continues to the Customer & Project confirmation
          step, where the rep verifies recipient details before sending. */}
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

function Card({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/85 border border-slate-200/60 rounded-2xl p-5 ${className ?? ''}`}
         style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}>
      <div className="glass-label mb-2">{label}</div>
      {children}
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
