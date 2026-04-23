import { formatFormula } from '@/lib/format';
import { computePricing, type PricingInputs } from '@/lib/pricing/pricing-engine';

/**
 * Builds the customer-facing plain-text email body. NO engineering JSON —
 * the customer sees scope + pricing + details only; the JSON is an
 * internal engineering-only artifact that stays inside the company.
 *
 * Pricing runs through the V0 engine so every surface (PDF, email, live
 * rail, quote detail) shows the same number.
 */
export function buildCustomerEmailBody(args: {
  quoteNumber: string;
  customerCompany: string;
  customerContact: string | null;
  siteAddress: string | null;
  projectName: string;
  chemical: string;
  designTempF?: number;
  specificGravity?: number;
  geometry: any;
  /** Service / certs / wallBuildup passed straight through to the engine. */
  service: PricingInputs['service'];
  certs: PricingInputs['certs'];
  wallBuildup: PricingInputs['wallBuildup'];
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
  const quantity = Math.max(1, Math.floor(Number(g.quantity) || 1));
  const vesselLineBase = g.orientation
    ? `${diameterFt}' ID × ${heightFt}' SS ${String(g.orientation).charAt(0).toUpperCase()}${String(g.orientation).slice(1)} FRP Tank`
    : 'FRP tank per specification';
  const vesselLine = quantity > 1 ? `(${quantity}×) ${vesselLineBase}` : vesselLineBase;

  // Pricing runs through the shared engine so PDF / email / live rail
  // never drift apart.
  const pricing = computePricing({
    geometry: g,
    service: args.service,
    certs: args.certs,
    wallBuildup: args.wallBuildup,
  });
  const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

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
    pricing.quantity > 1
      ? `Per vessel — materials, fabrication, labor   ${usd(pricing.unitPrice).padStart(10)}`
      : `Materials, fabrication, and labor            ${usd(pricing.unitPrice).padStart(10)}`,
    pricing.quantity > 1
      ? `Vessels (× ${pricing.quantity})                              ${usd(pricing.extendedPrice).padStart(10)}`
      : null,
    `Freight allowance                            ${usd(pricing.freight).padStart(10)}`,
    '                                         ──────────',
    `Quote Total                                  ${usd(pricing.totalDelivered).padStart(10)}`,
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
