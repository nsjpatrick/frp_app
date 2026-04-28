export type EngineeringJsonOpts = {
  rulesEngineVersion: string;
  catalogSnapshotId: string;
  generatedAt?: string;
};

export type EngineeringJson = ReturnType<typeof buildEngineeringJson>;

export function buildEngineeringJson(
  src: {
    quote: {
      id: string;
      number: string;
      customer: { id: string; name: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null };
      project: {
        id: string;
        name: string;
        siteAddress?: string | null;
        endUse?: string | null;
        needByDate?: Date | null;
      } | null;
    };
    revision: {
      id: string;
      label: string;
      service: any;
      site: any;
      certs: any;
      geometry: any;
      wallBuildup: any;
      outputs?: any;
    };
  },
  opts: EngineeringJsonOpts,
) {
  const rev = src.revision;
  const proj = src.quote.project;
  const cust = src.quote.customer;

  return {
    schema_version: '1.0.0',
    quote_id: src.quote.number,
    revision: rev.label,
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    rules_engine_version: opts.rulesEngineVersion,
    catalog_snapshot_id: opts.catalogSnapshotId,

    customer: {
      name: cust.name,
      contact_name: cust.contactName ?? null,
      contact_email: cust.contactEmail ?? null,
      contact_phone: cust.contactPhone ?? null,
    },
    project: proj
      ? {
          name: proj.name,
          site_address: proj.siteAddress ?? null,
          end_use: proj.endUse ?? null,
          need_by_date: proj.needByDate ? proj.needByDate.toISOString() : null,
        }
      : null,

    service: {
      tank_type: rev.service.tankType ?? null,
      chemical: rev.service.chemical,
      chemical_family: rev.service.chemicalFamily,
      concentration_pct: rev.service.concentrationPct ?? null,
      operating_temp_F: rev.service.operatingTempF,
      design_temp_F: rev.service.designTempF,
      min_ambient_temp_F: rev.service.minAmbientTempF ?? null,
      specific_gravity: rev.service.specificGravity,
      operating_pressure_psig: rev.service.operatingPressurePsig,
      vacuum_psig: rev.service.vacuumPsig,
      post_cure: !!rev.service.postCure,
      installation_location: rev.service.installationLocation ?? null,
      tank_color: rev.service.tankColor ?? null,
    },

    site: {
      indoor: rev.site.indoor,
      seismic: rev.site.seismic,
      wind: rev.site.wind,
    },

    certifications: {
      asme_rtp1: rev.certs.asmeRtp1Class
        ? { class: rev.certs.asmeRtp1Class, std_revision: rev.certs.asmeRtp1StdRevision ?? 'RTP-1:2019' }
        : null,
      ansi_standards: rev.certs.ansiStandards,
      nsf_ansi_61: rev.certs.nsfAnsi61Required
        ? { required: true, target_end_use_temp_F: rev.certs.nsfAnsi61TargetTempF ?? rev.service.designTempF }
        : { required: false },
      nsf_ansi_2: { required: rev.certs.nsfAnsi2Required },
      astm_d3299: !!rev.certs.astmD3299,
      astm_d4097: !!rev.certs.astmD4097,
      astm_d5685: !!rev.certs.astmD5685,
      pe_stamp: !!rev.certs.peStamp,
      icc_es_listed: !!rev.certs.iccEsListed,
      third_party_inspector: rev.certs.thirdPartyInspector,
      required_documents: rev.certs.requiredDocuments,
    },

    geometry: {
      orientation: rev.geometry.orientation,
      id_in: rev.geometry.idIn,
      ss_height_in: rev.geometry.ssHeightIn,
      top_head: rev.geometry.topHead,
      bottom: rev.geometry.bottom,
      freeboard_in: rev.geometry.freeboardIn,
      quantity: rev.geometry.quantity ?? 1,
      double_wall: !!rev.geometry.doubleWall,
      baffles: {
        count: rev.geometry.baffleCount ?? 0,
        type: rev.geometry.baffleType ?? null,
        length_ft: rev.geometry.baffleLengthFt ?? null,
      },
      stand: {
        type: rev.geometry.standType ?? (rev.geometry.stainlessStand
          ? (rev.geometry.stainlessGrade === 'SS316' || rev.geometry.stainlessGrade === 'SS316L' ? 'ss316' : 'ss304')
          : 'none'),
        height_ft: rev.geometry.standHeightFt ?? null,
      },
    },

    wall_buildup: {
      corrosion_barrier: {
        resin: rev.wallBuildup?.resinId ?? null,
        veil:  rev.wallBuildup?.veilId  ?? null,
      },
      structural: {
        total_thickness_in: null,
      },
    },

    structural_analysis: rev.outputs?.structuralAnalysis ?? null,
    nozzles: Array.isArray(rev.geometry?.nozzles) ? rev.geometry.nozzles : [],
    // Full Step-2 accessory bundle — every toggle, count, and option
    // captured verbatim so engineering can replay the exact configuration.
    accessories: rev.geometry?.accessories ?? null,
    anchorage: null,
    flags: [],
    pricing: null,
    /** Free-form notes captured on the Review page. The customer-facing
     *  Quote PDF intentionally ignores this field; engineering, ops, and
     *  the JSON download are the only consumers. */
    engineering_notes: rev.outputs?.engineeringNotes ?? null,
    /** PTI Sales Engineer assigned to this quote, picked on the Send step.
     *  Drives the customer-facing PDF "Sales Engineer" block. */
    sales_engineer: rev.outputs?.salesEngineerId ?? null,

    checksum_sha256: null,
  };
}
