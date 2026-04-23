import { SEED_RESINS } from '@/lib/catalog/seed-data';
import { TANK_TYPE_BY_ID } from '@/lib/catalog/tank-types';
import { formatFormula, formatUSD } from '@/lib/format';

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
    basePrice: string;       // "$48,512"
    freight: string;         // "$1,600"
    totalDelivered: string;  // sum
    priceRaw: number | null; // for "subject to pricing" branch
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

  // Pricing. V1 mirrors the customer email's mock totals when the live
  // pricing engine hasn't filled in `totalPrice` yet. Once the engine lands
  // we just drop the fallback.
  const priceRaw = quote.totalPrice ?? null;
  const basePrice = priceRaw != null ? formatUSD(priceRaw) : '$48,512';
  const freight   = '$1,600';
  const totalDeliveredNum = (priceRaw ?? 48512) + 1600;
  const totalDelivered = formatUSD(totalDeliveredNum);

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
      basePrice,
      freight,
      totalDelivered,
      priceRaw,
    },
    clarifications,
  };
}
