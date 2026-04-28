import { CHEMICAL_FAMILY_LABEL, SEED_RESINS } from '@/lib/catalog/seed-data';
import type { ChemicalFamily } from '@/lib/catalog/seed-data';
import { TANK_TYPE_BY_ID } from '@/lib/catalog/tank-types';
import { formatFormula, formatUSD } from '@/lib/format';
import { computePricing } from '@/lib/pricing/pricing-engine';
import { VEIL_OPTIONS } from '@/lib/pricing/jobcalc-catalog';

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
    freeboardFt: string;     // "1'-0\"" — empty space above liquid
    capacityGal: string;     // approximate, from cylinder volume
    topHead: string;         // "Open top" / "Closed, flanged & dished" / etc.
    bottom: string;          // "Flat" / "Dished" / "Conical"
    sidewall: string;        // "Single-wall" / "Double-wall"
    quantity: number;        // ≥ 1. Surfaces as a line item when > 1.
    color: string;           // "Wax" / "White gelcoat" / etc.
    installationLocation: string; // "Indoor" / "Outdoor"
  };
  service: {
    chemical: string;        // formula-subscripted
    chemicalFamily: string;  // "Dilute Acid" / "Caustic" / etc.
    concentrationPct: string;// "26%" or "—"
    specificGravity: string; // "1.22"
    operatingTempF: string;
    designTempF: string;
    minAmbientTempF: string;
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
    veil: string;             // surface-veil label ("1 ply C-glass" / "—")
    corrosionBarrier: string; // standard barrier text
  };
  certifications: {
    asmeRtp1Class: string | null;
    nsfAnsi61: boolean;
    nsfAnsi2: boolean;
    astmD3299: boolean;
    astmD4097: boolean;
    astmD5685: boolean;
    peStamp: boolean;
    iccEsListed: boolean;
    thirdPartyInspector: boolean;
  };
  baffles: {
    count: number;
    type: string;             // "Plate" / "Wedge"
    lengthFt: string;         // "10.8'"
  };
  stand: {
    type: string;             // "FRP" / "Stainless 304" / "FRP Skirt" / "None"
    heightFt: string;         // "4'"
  };
  nozzles: Array<{
    type: string;
    sizeNps: string;
    rating: string;
    quantity: number;
  }>;
  accessories: {
    summary: string[];        // bulleted high-level list (legacy "Accessories Included")
    detail: AccessoryDetailRow[]; // grouped row data for the full Accessories table
  };
  pricing: {
    /** The single bottom-line number the customer sees. Itemized line-
     *  items (per-vessel, freight, qty extension) are intentionally
     *  omitted from the PDF — internal pricing detail isn't shared with
     *  the customer. */
    totalDelivered: string;
    quantity: number;
  };
  clarifications: string[];
};

export type AccessoryDetailRow = {
  group: string;              // section header ("Access", "Indicators", …)
  label: string;              // field name ("Manway", "SmartBob", …)
  value: string;              // human-readable selection ("24″ side flanged")
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

const COLOR_LABEL: Record<string, string> = {
  wax:   'Wax (clear UV topcoat)',
  white: 'White gelcoat',
  grey:  'Grey gelcoat',
  other: 'Custom (per quote notes)',
};

const LOCATION_LABEL: Record<string, string> = {
  indoor:  'Indoor',
  outdoor: 'Outdoor',
};

const STAND_LABEL: Record<string, string> = {
  none:  'None (ring-supported)',
  frp:   'FRP',
  ss304: 'Stainless 304',
  ss316: 'Stainless 316',
  skirt: 'FRP Skirt',
};

const BAFFLE_TYPE_LABEL: Record<string, string> = {
  plate: 'Plate',
  wedge: 'Wedge',
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

  // High-level summary list (legacy "Accessories Included" bullets).
  const accessoriesSummary: string[] = [];
  const nozzles: Array<{ type: string; sizeNps?: string; rating?: string; quantity: number }> = Array.isArray(geom.nozzles) ? geom.nozzles : [];
  const byType: Record<string, number> = {};
  for (const n of nozzles) {
    byType[n.type] = (byType[n.type] ?? 0) + (Number(n.quantity) || 0);
  }
  for (const [type, qty] of Object.entries(byType)) {
    accessoriesSummary.push(`${qty} × ${type}${qty === 1 ? '' : 's'}`);
  }
  if (geom.manway) accessoriesSummary.push('24" manway with bolted, gasketed cover');
  if (geom.baffles) accessoriesSummary.push(`${geom.baffleCount ?? 4} internal baffles`);
  if (geom.stainlessStand) accessoriesSummary.push('Stainless steel support stand');
  if (geom.ladder) accessoriesSummary.push('Exterior access ladder');
  if (geom.liftingLugs) accessoriesSummary.push('Integral lifting lugs');
  if (accessoriesSummary.length === 0) accessoriesSummary.push('Per specification');

  const accessoryDetail = buildAccessoryDetail(geom.accessories ?? null);

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
  // Customer-facing PDF only shows the bottom-line total. Per-vessel /
  // freight / qty extension stay internal — they're surfaced in the
  // pricing rail and engineering JSON, never the quote.
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
      freeboardFt: inchesToFeetInches(geom.freeboardIn),
      capacityGal: gallonsFromCylinder(geom.idIn, geom.ssHeightIn),
      topHead: labelFromEnum(geom.topHead, TOP_LABEL),
      bottom: labelFromEnum(geom.bottom, BOTTOM_LABEL),
      sidewall: geom.doubleWall ? 'Double-wall (integral secondary containment)' : 'Single-wall',
      quantity,
      color: labelFromEnum(svc.tankColor, COLOR_LABEL),
      installationLocation: labelFromEnum(svc.installationLocation, LOCATION_LABEL),
    },
    service: {
      chemical: formatFormula(svc.chemical) || 'Per RFI',
      chemicalFamily: CHEMICAL_FAMILY_LABEL[svc.chemicalFamily as ChemicalFamily]
        ?? labelFromEnum(svc.chemicalFamily),
      concentrationPct: svc.concentrationPct != null ? `${svc.concentrationPct}%` : '—',
      specificGravity: svc.specificGravity != null ? String(svc.specificGravity) : '—',
      operatingTempF: svc.operatingTempF != null ? `${svc.operatingTempF}°F` : '—',
      designTempF: svc.designTempF != null ? `${svc.designTempF}°F` : '—',
      minAmbientTempF: svc.minAmbientTempF != null ? `${svc.minAmbientTempF}°F` : '—',
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
      veil: VEIL_OPTIONS.find((v) => v.id === wall.veilId)?.label ?? '—',
      corrosionBarrier:
        '100-mil nominal corrosion barrier: C-veil surface mat backed by two plies of chopped strand mat, wet-out with corrosion-grade resin.',
    },
    certifications: {
      asmeRtp1Class: certs.asmeRtp1Class ?? null,
      nsfAnsi61: !!certs.nsfAnsi61Required,
      nsfAnsi2: !!certs.nsfAnsi2Required,
      astmD3299: !!certs.astmD3299,
      astmD4097: !!certs.astmD4097,
      astmD5685: !!certs.astmD5685,
      peStamp: !!certs.peStamp,
      iccEsListed: !!certs.iccEsListed,
      thirdPartyInspector: !!certs.thirdPartyInspector,
    },
    baffles: {
      count: Number(geom.baffleCount ?? 0),
      type: labelFromEnum(geom.baffleType, BAFFLE_TYPE_LABEL),
      lengthFt: geom.baffleLengthFt != null && geom.baffleLengthFt > 0
        ? `${Number(geom.baffleLengthFt).toFixed(1)}'`
        : geom.ssHeightIn != null
          ? `${((geom.ssHeightIn / 12) * 0.9).toFixed(1)}' (auto)`
          : '—',
    },
    stand: {
      type: labelFromEnum(
        geom.standType ?? (geom.stainlessStand
          ? (geom.stainlessGrade === 'SS316' || geom.stainlessGrade === 'SS316L' ? 'ss316' : 'ss304')
          : 'none'),
        STAND_LABEL,
      ),
      heightFt: geom.standHeightFt != null ? `${geom.standHeightFt}'` : '—',
    },
    nozzles: nozzles.map((n) => ({
      type: labelFromEnum(n.type),
      sizeNps: n.sizeNps ?? '—',
      rating: n.rating ?? '—',
      quantity: Number(n.quantity) || 0,
    })),
    accessories: {
      summary: accessoriesSummary,
      detail: accessoryDetail,
    },
    pricing: {
      // Customer-facing PDF gets only the bottom-line delivered total.
      // Per-vessel × qty extension and freight are intentionally hidden.
      totalDelivered,
      quantity,
    },
    clarifications,
  };
}

/* ── Accessory detail flattener ──────────────────────────────────────
 * Walks the full Step-2 accessory bundle and produces a list of
 * group/label/value rows so the review tab and the PDF can both render
 * a complete table without re-implementing the labeling rules. Empty
 * rows (no toggle / "none") are dropped so the output stays tight.
 */
export function buildAccessoryDetail(a: any): AccessoryDetailRow[] {
  if (!a || typeof a !== 'object') return [];
  const rows: AccessoryDetailRow[] = [];
  const push = (group: string, label: string, value: string | null | undefined) => {
    if (value == null || value === '' || value === 'None' || value === 'none') return;
    rows.push({ group, label, value });
  };

  // ── Access ────────────────────────────────────────────────────
  if (a.manway && a.manway.type && a.manway.type !== 'none') {
    push('Access', 'Manway',
      `${a.manway.diameterIn ?? '—'}″ ${labelFromEnum(a.manway.type)}${a.manway.rtp1Style ? ', RTP-1 style' : ''}`);
  }
  if (a.ladder && a.ladder.type && a.ladder.type !== 'none') {
    const opts = [
      a.ladder.cage      ? 'cage'        : null,
      a.ladder.walkthru  ? 'walk-thru'   : null,
      a.ladder.roofturn  ? 'roof turn'   : null,
    ].filter(Boolean).join(', ');
    push('Access', 'Ladder',
      `${labelFromEnum(a.ladder.type)} (${labelFromEnum(a.ladder.location)}${opts ? '; ' + opts : ''})`);
  }
  if (a.handrail && a.handrail.type && a.handrail.type !== 'none') {
    push('Access', 'Handrail',
      `${labelFromEnum(a.handrail.type)} (${labelFromEnum(a.handrail.location)}${a.handrail.selfCloseGate ? ', self-closing gate' : ''})`);
  }
  if (a.restPlatform) push('Access', 'Rest Platform', 'Included');
  if (a.safTClimb && a.safTClimb !== 'none') {
    push('Access', 'Saf-T-Climb', labelFromEnum(a.safTClimb));
  }

  // ── Anchorage ─────────────────────────────────────────────────
  if (a.tieDownLugs?.enabled) {
    push('Anchorage', 'Tie-down lugs',
      `${a.tieDownLugs.quantity ?? '—'} × ${(a.tieDownLugs.ratingLb ?? 0).toLocaleString()} lb (${labelFromEnum(a.tieDownLugs.grade)})${a.tieDownLugs.encapsulated ? ', encapsulated' : ''}`);
  }
  if (a.liftingChannels?.enabled) {
    push('Anchorage', 'Lifting channels',
      `${a.liftingChannels.quantity ?? '—'} × ${labelFromEnum(a.liftingChannels.grade)}${a.liftingChannels.encapsulated ? ', encapsulated' : ''}`);
  }
  if (a.agitatorSupport?.enabled) {
    push('Anchorage', 'Agitator support',
      `Included${a.agitatorSupport.encapsulated ? ' (encapsulated)' : ''}`);
  }
  if (a.mixerPad) push('Anchorage', 'Mixer pad', 'Included');

  // ── Process fittings ──────────────────────────────────────────
  if (Array.isArray(a.vents)) {
    for (const v of a.vents) {
      push('Process', 'Vent',
        `${v.quantity ?? 1} × ${v.sizeIn ?? '—'}″ ${labelFromEnum(v.kind)}`);
    }
  }
  if (Array.isArray(a.dipPipes)) {
    for (const d of a.dipPipes) {
      push('Process', 'Dip pipe',
        `${d.diameterIn ?? '—'}″ Ø × ${d.lengthIn ?? '—'}″`);
    }
  }
  if (Array.isArray(a.blindFlanges)) {
    for (const b of a.blindFlanges) {
      push('Process', 'Blind flange',
        `${b.quantity ?? 1} × ${b.diameterIn ?? '—'}″ ${labelFromEnum(b.material)}`);
    }
  }
  if (a.sightGlass?.enabled) {
    push('Process', 'Sight glass', `${a.sightGlass.sizeIn ?? '—'}″`);
  }
  if (a.splitHingedTopCover) push('Process', 'Top cover', 'Split-hinged');

  // ── Insulation & Heat Trace ───────────────────────────────────
  if (a.insulation && a.insulation !== 'none') {
    push('Insulation', 'Foam insulation',
      a.insulation === '1_layer' ? '1″ layer' : '2″ layer');
  }
  if (a.plastatherm?.enabled) {
    push('Insulation', 'Heater Configurator',
      `${a.plastatherm.operatingVoltage}V — maintain ${a.plastatherm.maintainTempF}°F`);
    push('Insulation', 'HTD insulation',
      `${a.plastatherm.insulationThicknessIn}″ ${labelFromEnum(a.plastatherm.insulationType)}`);
    push('Insulation', 'Wind / safety factor',
      `${a.plastatherm.windSpeedMph} mph · ${Math.round((a.plastatherm.safetyFactor ?? 0) * 100)}%`);
    push('Insulation', 'Supports',
      `${a.plastatherm.numSupports ?? 0} × ${labelFromEnum(a.plastatherm.supportStyle)}`);
    if (a.plastatherm.manwayInsulated) push('Insulation', 'Manways insulated', 'Yes');
  }

  // ── Indicators / signage ──────────────────────────────────────
  if (a.smartBob && a.smartBob !== 'none') push('Indicators', 'SmartBob', labelFromEnum(a.smartBob));
  if (a.liquidLevelIndicator) push('Indicators', 'Liquid-level indicator', 'Included');
  if (a.nameplate) push('Indicators', 'Nameplate', 'Included');
  if (a.ventTags) push('Indicators', 'Vent tags', 'Included');
  if (a.pipeSupportClips && a.pipeSupportClips > 0) {
    push('Indicators', 'Pipe-support clips', `${a.pipeSupportClips}`);
  }

  // ── Documentation / QA ────────────────────────────────────────
  if (a.hydrotest) push('Documentation', 'Hydrotest', 'Included');
  if (a.oAndMManuals && a.oAndMManuals > 0) {
    push('Documentation', 'O&M manuals', `${a.oAndMManuals}`);
  }
  if (a.peCalcs) push('Documentation', 'PE calcs', 'Included');
  if (a.anchorBoltTemplates) push('Documentation', 'Anchor bolt templates', 'Included');

  // ── Bryneer package ───────────────────────────────────────────
  if (a.bryneerPackage?.enabled) {
    const inc: string[] = [];
    if (a.bryneerPackage.breatherBag)      inc.push('breather bag');
    if (a.bryneerPackage.kamlockCoupling)  inc.push('kamlock');
    if (a.bryneerPackage.solenoidValve)    inc.push('solenoid');
    if (a.bryneerPackage.flowValve)        inc.push('flow valve');
    if (a.bryneerPackage.saltPipeStandoff) inc.push('salt pipe');
    push('Bryneer', 'Bryneer™ package', inc.length > 0 ? inc.join(', ') : 'Included');
  }

  return rows;
}
