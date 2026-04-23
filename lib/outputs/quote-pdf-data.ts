import { SEED_RESINS } from '@/lib/catalog/seed-data';
import { TANK_TYPE_BY_ID } from '@/lib/catalog/tank-types';
import { formatFormula, formatUSD } from '@/lib/format';
import { computePricing } from '@/lib/pricing/pricing-engine';

/**
 * Shape the Quote PDF renders from. Flat, serializable, and derived from
 * the live Revision JSON blobs so every configurator output has a single
 * path into the document. Keeping this flat also makes it trivial to unit-
 * test the mapping without spinning up react-pdf.
 */
export type QuotePdfData = {
  meta: {
    quoteNumber: string;
    revision: string;
    dateOfIssue: string;     // M/D/YYYY
    inquiryNumber: string;   // customer's project number, "—" if absent
    terms: string;
    fob: string;
    estCompletion: string;   // lead-time text
  };
  recipient: {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    siteAddress: string;
    // Optional multi-line company address for the "Prepared For" block.
    // Each entry is already a formatted line; consumers render as-is.
    companyAddressLines: string[];
  };
  salesRep: {
    name: string;
    email: string;
    phone: string;
  };
  product: {
    familyLabel: string;     // e.g. "FRP Vessel" / "Bryneer™ Brine System"
    astmSpec: string;        // "ASTM D-3299-18" or "ASTM D-4097-19"
    astmLabel: string;       // "filament wound" / "contact molded"
  };
  vessel: {
    orientation: string;     // "Vertical" / "Horizontal"
    idIn: number | null;
    ssHeightIn: number | null;
    idFt: string;            // "6'-0\""
    ssHeightFt: string;
    capacityGal: string;     // approximate, from cylinder volume
    topHead: string;         // "Open top" / "Closed, flanged & dished" / etc.
    bottom: string;          // "Flat" / "Dished" / "Conical"
    quantity: number;        // ≥ 1. Surfaces as a line item when > 1.
  };
  service: {
    chemical: string;        // formula-subscripted
    specificGravity: string; // "1.22"
    operatingTempF: string;
    designTempF: string;
    operatingPressurePsig: string;
    vacuumPsig: string;
    postCure: boolean;
  };
  site: {
    indoor: boolean;
    windSpeedMph: string;
    seismicSs: string;
    seismicS1: string;
    seismicSiteClass: string;
  };
  resin: {
    name: string;
    supplier: string;
    corrosionBarrier: string; // standard barrier text
  };
  certifications: {
    asmeRtp1Class: string | null;
    nsfAnsi61: boolean;
    nsfAnsi2: boolean;
    thirdPartyInspector: boolean;
  };
  accessories: string[];     // bulleted list — nozzles + manway + stand + etc.
  pricing: {
    unitPrice: string;              // Per-vessel price ("$48,512")
    quantity: number;               // Mirrored here so the renderer only reaches one object.
    lineExtended: string;           // unitPrice × quantity
    freight: string;                // "$1,600"
    totalDelivered: string;         // lineExtended + freight
  };
  clarifications: string[];
};

const CAP_PER_CYL_IN3 = Math.PI; // unit helper — placeholder so we can inline the volume formula below.

function inchesToFeetInches(inches: number | null | undefined): string {
  if (inches == null || !Number.isFinite(inches)) return '—';
  const feet = Math.floor(inches / 12);
  const leftover = Math.round(inches - feet * 12);
  return leftover === 0 ? `${feet}'-0"` : `${feet}'-${leftover}"`;
}

function gallonsFromCylinder(idIn: number | null, ssHeightIn: number | null): string {
  if (!idIn || !ssHeightIn) return '—';
  // Cylindrical volume (straight shell only). 1 US gal = 231 in³.
  const volInCubed = CAP_PER_CYL_IN3 * (idIn / 2) ** 2 * ssHeightIn;
  const gal = Math.round(volInCubed / 231);
  return `${gal.toLocaleString('en-US')} gal`;
}

/**
 * Format a Customer's optional address columns into display lines.
 *   Line 1: street + suite
 *   Line 2: "City, Region PostalCode"
 *   Line 3: Country
 * Any line with no content is dropped. Returns an empty array if no
 * address fields are present — caller can check `.length` to decide
 * whether to render the block at all.
 */
function buildAddressLines(c: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
}): string[] {
  const lines: string[] = [];
  const street = [c.addressLine1, c.addressLine2].filter(Boolean).join(', ');
  if (street) lines.push(street);
  const cityLine = [
    c.city,
    [c.region, c.postalCode].filter(Boolean).join(' '),
  ].filter((s) => s && s.trim()).join(', ');
  if (cityLine) lines.push(cityLine);
  if (c.country) lines.push(c.country);
  return lines;
}

function labelFromEnum(value: string | null | undefined, map: Record<string, string> = {}): string {
  if (!value) return '—';
  if (map[value]) return map[value];
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const BOTTOM_LABEL: Record<string, string> = {
  flat: 'Flat',
  dished: '2:1 Semi-Elliptical Dished',
  conical: 'Conical',
  cone: 'Conical',
};

const TOP_LABEL: Record<string, string> = {
  open: 'Open top',
  dished: 'Flanged & dished, closed',
  flat: 'Flat, bolted',
  cone: 'Conical, closed',
};

const ORIENTATION_LABEL: Record<string, string> = {
  vertical: 'Vertical',
  horizontal: 'Horizontal',
};

/**
 * Map Revision + Quote JSON onto the flat PDF view-model. Everything the
 * PDF renders flows through here, so if a new configurator field should
 * surface in the document this is the one place to wire it.
 */
export function buildQuotePdfData(args: {
  quote: {
    number: string;
    totalPrice: number | null;
    createdAt: Date;
    customer: {
      name: string;
      contactName: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      region: string | null;
      postalCode: string | null;
      country: string | null;
    };
    project: {
      name: string;
      siteAddress: string | null;
      customerProjectNumber: string | null;
    } | null;
  };
  revision: {
    label: string;
    service: any;
    site: any;
    certs: any;
    geometry: any;
    wallBuildup: any;
  };
  salesRep: {
    name: string;
    email: string;
    phone: string;
  };
}): QuotePdfData {
  const { quote, revision, salesRep } = args;
  const svc: any = revision.service ?? {};
  const site: any = revision.site ?? {};
  const certs: any = revision.certs ?? {};
  const geom: any = revision.geometry ?? {};
  const wall: any = revision.wallBuildup ?? {};

  const tankType = svc.tankType ? TANK_TYPE_BY_ID[svc.tankType] : null;
  const resin = wall.resinId ? SEED_RESINS.find((r) => r.id === wall.resinId) : null;

  // ASTM classification branches on whether the vessel is filament wound or
  // contact molded. V1 uses diameter as the proxy — ≥ 18" ID is almost
  // always filament wound at PTI. If the configurator adds an explicit
  // fabrication-method field later, switch to that.
  const isFilamentWound = (geom.idIn ?? 0) >= 18;
  const astmSpec  = isFilamentWound ? 'ASTM D-3299-18' : 'ASTM D-4097-19';
  const astmLabel = isFilamentWound ? 'filament-wound' : 'contact-molded';

  // Accessories list. Nozzles aggregate by type; manway + stand add from
  // geometry flags.
  const accessories: string[] = [];
  const nozzles: Array<{ type: string; quantity: number; size?: string }> = Array.isArray(geom.nozzles) ? geom.nozzles : [];
  const byType: Record<string, number> = {};
  for (const n of nozzles) {
    byType[n.type] = (byType[n.type] ?? 0) + (Number(n.quantity) || 0);
  }
  for (const [type, qty] of Object.entries(byType)) {
    accessories.push(`${qty} × ${type}${qty === 1 ? '' : 's'}`);
  }
  if (geom.manway) accessories.push('24" manway with bolted, gasketed cover');
  if (geom.baffles) accessories.push(`${geom.baffleCount ?? 4} internal baffles`);
  if (geom.stainlessStand) accessories.push('Stainless steel support stand');
  if (geom.ladder) accessories.push('Exterior access ladder');
  if (geom.liftingLugs) accessories.push('Integral lifting lugs');
  if (accessories.length === 0) accessories.push('Per specification');

  // Pricing flows through the V0 engine so every surface (PDF, email,
  // live rail, quote detail) reads one number. Engine reacts to quantity
  // + vessel size + cert stack + resin + accessories; swap the engine
  // body when the real pricing engine lands.
  const pricing = computePricing({
    geometry: geom,
    service: svc,
    certs,
    wallBuildup: wall,
  });
  const quantity = pricing.quantity;
  const unitPrice = formatUSD(pricing.unitPrice);
  const lineExtended = formatUSD(pricing.extendedPrice);
  const freight = formatUSD(pricing.freight);
  const totalDelivered = formatUSD(pricing.totalDelivered);

  const clarifications: string[] = [
    `Fabrication per ${astmSpec} using ${resin?.name ?? 'customer-approved'} resin as the corrosion barrier.`,
    svc.postCure
      ? 'Post-cure per resin manufacturer recommendation prior to shipment.'
      : 'Ambient cure per standard PTI quality plan.',
    certs.asmeRtp1Class
      ? `ASME RTP-1 Class ${certs.asmeRtp1Class} — includes third-party inspection and stamped U-1A data report.`
      : 'Non-code construction; certificate of conformance provided with shipment.',
    certs.nsfAnsi61Required
      ? 'NSF/ANSI 61 listed materials for potable-water contact surfaces.'
      : null,
    'Pricing is valid for 30 days. Lead time is quoted from order release and approved drawings.',
  ].filter((x): x is string => x !== null);

  return {
    meta: {
      quoteNumber: quote.number,
      revision: revision.label,
      dateOfIssue: quote.createdAt.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      }),
      inquiryNumber: quote.project?.customerProjectNumber ?? '—',
      terms: 'Net 30 days, upon approved credit',
      fob: 'F.O.B. Fairfield, Ohio',
      estCompletion: '10–12 weeks from order release',
    },
    recipient: {
      company: quote.customer.name,
      contactName: quote.customer.contactName ?? '',
      email: quote.customer.contactEmail ?? '',
      phone: quote.customer.contactPhone ?? '',
      siteAddress: quote.project?.siteAddress ?? '',
      companyAddressLines: buildAddressLines(quote.customer),
    },
    salesRep,
    product: {
      familyLabel: tankType?.label ?? 'FRP Vessel',
      astmSpec,
      astmLabel,
    },
    vessel: {
      orientation: labelFromEnum(geom.orientation, ORIENTATION_LABEL),
      idIn: geom.idIn ?? null,
      ssHeightIn: geom.ssHeightIn ?? null,
      idFt: inchesToFeetInches(geom.idIn),
      ssHeightFt: inchesToFeetInches(geom.ssHeightIn),
      capacityGal: gallonsFromCylinder(geom.idIn, geom.ssHeightIn),
      topHead: labelFromEnum(geom.topHead, TOP_LABEL),
      bottom: labelFromEnum(geom.bottom, BOTTOM_LABEL),
      quantity,
    },
    service: {
      chemical: formatFormula(svc.chemical) || 'Per RFI',
      specificGravity: svc.specificGravity != null ? String(svc.specificGravity) : '—',
      operatingTempF: svc.operatingTempF != null ? `${svc.operatingTempF}°F` : '—',
      designTempF: svc.designTempF != null ? `${svc.designTempF}°F` : '—',
      operatingPressurePsig: svc.operatingPressurePsig != null ? `${svc.operatingPressurePsig} psig` : 'Atmospheric',
      vacuumPsig: svc.vacuumPsig != null ? `${svc.vacuumPsig} psig` : 'None',
      postCure: !!svc.postCure,
    },
    site: {
      indoor: !!site.indoor,
      windSpeedMph: site.wind?.V != null ? `${site.wind.V} mph` : '—',
      seismicSs: site.seismic?.Ss != null ? String(site.seismic.Ss) : '—',
      seismicS1: site.seismic?.S1 != null ? String(site.seismic.S1) : '—',
      seismicSiteClass: site.seismic?.siteClass ?? '—',
    },
    resin: {
      name: resin?.name ?? 'Per specification',
      supplier: resin?.supplier ?? '—',
      corrosionBarrier:
        '100-mil nominal corrosion barrier: C-veil surface mat backed by two plies of chopped strand mat, wet-out with corrosion-grade resin.',
    },
    certifications: {
      asmeRtp1Class: certs.asmeRtp1Class ?? null,
      nsfAnsi61: !!certs.nsfAnsi61Required,
      nsfAnsi2: !!certs.nsfAnsi2Required,
      thirdPartyInspector: !!certs.thirdPartyInspector,
    },
    accessories,
    pricing: {
      unitPrice,
      quantity,
      lineExtended,
      freight,
      totalDelivered,
    },
    clarifications,
  };
}
