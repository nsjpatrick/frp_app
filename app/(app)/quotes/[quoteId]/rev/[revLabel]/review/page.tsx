import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { SendQuoteButton } from '@/components/SendQuoteButton';
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
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );
  const sa = json.structural_analysis;

  // Full resin record looked up from the catalog so we can render all the
  // detail a sales rep needs at review time.
  const resinId = json.wall_buildup.corrosion_barrier.resin;
  const resin = resinId ? SEED_RESINS.find((r) => r.id === resinId) : null;

  // Customer-facing email body — pricing + scope, NO engineering JSON.
  // Pricing numbers are mock for V1 (match the Live Summary preview);
  // Plan 3 wires real pricing-engine totals.
  const customerBody = buildCustomerEmailBody({
    quoteNumber: rev.quote.number,
    customerCompany: rev.quote.project.customer.name,
    customerContact: rev.quote.project.customer.contactName,
    siteAddress: rev.quote.project.siteAddress,
    projectName: rev.quote.project.name,
    chemical: rev.service && (rev.service as any).chemical ? (rev.service as any).chemical : '',
    designTempF: rev.service && (rev.service as any).designTempF,
    specificGravity: rev.service && (rev.service as any).specificGravity,
    geometry: rev.geometry as any,
    resinName: resin?.name,
  });

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="review">
      {/* Header — title block on a single line, no right-side button anymore. */}
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 5 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">
          Review &amp; Generate
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Final spec check before engineering handoff.
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
        <Card label="Customer / Project">
          <div className="text-[15px] font-medium">{json.customer.name}</div>
          <div className="text-slate-600">{formatFormula(json.project.name)}</div>
          <div className="text-slate-500 text-[13px] mt-1">{json.project.site_address ?? '—'}</div>
        </Card>

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
                  <span className="text-slate-700 tabular-nums text-[13px]">
                    × {n.quantity}
                  </span>
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

        <Card label="Resin" className="md:col-span-2">
          {resin ? (
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-[16px] font-semibold text-slate-900">{resin.name}</div>
                <div className="text-[13px] text-slate-500">{resin.supplier}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <span className="glass-chip">
                  {RESIN_FAMILY_LABEL[resin.family] ?? resin.family}
                </span>
                <span className="glass-chip">Max {resin.max_service_temp_F}°F</span>
                <span className="glass-chip">
                  {resin.density_lb_ft3} lb/ft³
                </span>
                <span className="glass-chip">${resin.price_per_lb.toFixed(2)}/lb</span>
                {resin.certifications.nsf_ansi_61.listed && (
                  <span className="glass-chip glass-tinted-emerald">
                    NSF 61 to {resin.certifications.nsf_ansi_61.max_temp_F}°F
                  </span>
                )}
                {resin.certifications.nsf_ansi_2.listed && (
                  <span className="glass-chip glass-tinted-emerald">NSF 2</span>
                )}
                {resin.certifications.asme_rtp1_class_eligibility.length > 0 && (
                  <span className="glass-chip glass-tinted-slate">
                    RTP-1 {resin.certifications.asme_rtp1_class_eligibility.join('/')}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-slate-500 mt-3">
                Compatible with: {resin.compatible_chemical_families.map((f) => f.replace(/_/g, ' ')).join(', ')}.
              </div>
            </>
          ) : (
            <div className="text-slate-400 font-normal">No resin selected</div>
          )}
        </Card>
      </div>

      {sa && (
        <div className="bg-white/90 border border-slate-200/70 rounded-2xl p-6 mb-6"
             style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.7)' }}>
          {/* Header wraps freely; the Review Required chip stays pinned to
              the top-right so it always aligns with the h3's first line. */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="section-head mb-0">
              Structural Analysis (Preliminary)
            </h3>
            <span className="glass-chip glass-tinted-amber text-[11px] shrink-0 whitespace-nowrap">
              Review Required
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric
              label="Shell thickness"
              value={`${sa.wallThickness.shellThicknessIn}″`}
              hint={`Governed by ${sa.wallThickness.governingRule.replace(/_/g, ' ')}`}
            />
            <Metric
              label="Head thickness"
              value={`${sa.wallThickness.headThicknessIn}″`}
              hint="1.15 × shell"
            />
            <Metric
              label="Wind base shear"
              value={`${sa.wind.baseShearLbf.toLocaleString()}`}
              suffix="lbf"
            />
            <Metric
              label="Seismic base shear"
              value={`${sa.seismic.baseShearLbf.toLocaleString()}`}
              suffix="lbf"
            />
            <Metric
              label="Governing case"
              value={sa.loadCombination.governingCase}
              hint={`Uplift ${sa.loadCombination.governingUpliftLbf.toLocaleString()} lbf`}
              wide
            />
            <Metric
              label="Anchor"
              value={`${sa.anchor.qty} × ${sa.anchor.anchorDetailId}`}
              hint={`${sa.anchor.selectedCapacityLbfEach.toLocaleString()} lbf each`}
              wide
            />
            <Metric
              label="Slosh freeboard"
              value={`${sa.seismic.requiredFreeboardIn}″ req`}
              hint={`${json.geometry.freeboard_in}″ provided`}
              wide
            />
          </div>
        </div>
      )}

      {/* Action row — primary CTA is now "Send Quote" (mailto with engineering
          JSON body). JSON preview removed; download link kept as a plain text
          fallback in case the user wants the raw file. */}
      <div className="flex items-center justify-between gap-3 pt-6 mt-4 border-t border-slate-200">
        <a
          href={`/quotes/${quoteId}/rev/${revLabel}/engineering.json`}
          className="text-[13px] text-slate-500 hover:text-slate-800 underline-offset-4 hover:underline"
        >
          Download Engineering JSON
        </a>
        <SendQuoteButton
          quoteNumber={rev.quote.number}
          customerCompany={rev.quote.project.customer.name}
          customerContact={rev.quote.project.customer.contactName}
          customerEmail={rev.quote.project.customer.contactEmail}
          customerBody={customerBody}
        />
      </div>
    </WizardShell>
  );
}

function Card({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white/85 border border-slate-200/60 rounded-2xl p-5 ${className ?? ''}`}
         style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}>
      <div className="glass-label mb-2">{label}</div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  suffix,
  wide,
}: {
  label: string;
  value: string;
  hint?: string;
  suffix?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-2' : ''}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-[20px] font-semibold tracking-tight text-slate-900 leading-tight">
        {value}
        {suffix && <span className="text-[13px] font-normal text-slate-500 ml-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[12px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/**
 * Builds the customer-facing plain-text email body. NO engineering JSON —
 * the customer sees scope + pricing + details only; the JSON is an
 * internal engineering-only artifact that stays inside the company.
 *
 * Pricing values are mock for V1 (match the Live Summary preview numbers).
 * Plan 3 wires the real pricing-engine output.
 */
function buildCustomerEmailBody(args: {
  quoteNumber: string;
  customerCompany: string;
  customerContact: string | null;
  siteAddress: string | null;
  projectName: string;
  chemical: string;
  designTempF?: number;
  specificGravity?: number;
  geometry: any;
  resinName?: string;
}): string {
  const f = formatFormula;
  const g = args.geometry ?? {};
  const nozzles = Array.isArray(g.nozzles) ? g.nozzles : [];
  const nozzleCounts: Record<string, number> = {};
  for (const n of nozzles) {
    nozzleCounts[n.type] = (nozzleCounts[n.type] ?? 0) + (Number(n.quantity) || 0);
  }
  const nozzleSummary = Object.entries(nozzleCounts)
    .map(([t, q]) => `${q} ${t}${q === 1 ? '' : 's'}`)
    .join(', ') || 'per specification';

  const diameterFt = g.idIn ? (g.idIn / 12).toFixed(1) : '—';
  const heightFt   = g.ssHeightIn ? (g.ssHeightIn / 12).toFixed(1) : '—';
  const vesselLine = g.orientation
    ? `${diameterFt}' ID × ${heightFt}' SS ${String(g.orientation).charAt(0).toUpperCase()}${String(g.orientation).slice(1)} FRP Tank`
    : 'FRP tank per specification';

  return [
    `Hi ${args.customerContact ?? args.customerCompany},`,
    '',
    `Thank you for the opportunity to quote the ${args.projectName} project for ${args.customerCompany}.`,
    '',
    `Quote ${args.quoteNumber} — Plas-Tanks Industries`,
    args.siteAddress ? `Site: ${args.siteAddress}` : null,
    '',
    '── Scope ───────────────────────────────────────────────',
    `Vessel:        ${vesselLine}`,
    `Service:       ${f(args.chemical) || 'per RFI'}${
      args.designTempF != null ? ` at ${args.designTempF}°F design` : ''
    }${args.specificGravity != null ? ` / SG ${args.specificGravity}` : ''}`,
    args.resinName ? `Resin:         ${args.resinName}` : null,
    `Connections:   ${nozzleSummary}`,
    '',
    '── Pricing (USD) ──────────────────────────────────────',
    'Materials, fabrication, and labor          $48,512',
    'Freight allowance                            $1,600',
    '                                         ──────────',
    'Quote Total                                $50,112',
    '',
    'Terms:         Net 30 from invoice date',
    'Validity:      30 days from this quote',
    'Lead Time:     10-12 weeks from order release',
    '',
    'Preliminary specifications reviewed by our engineering team prior',
    'to fabrication release. Please let me know if you have questions or',
    'would like to schedule a call to walk through the scope.',
    '',
    'Regards,',
    'Sales, Plas-Tanks Industries',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
