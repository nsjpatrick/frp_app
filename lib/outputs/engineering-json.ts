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
      project: {
        id: string;
        name: string;
        customer: { id: string; name: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null };
        siteAddress?: string | null;
        endUse?: string | null;
        needByDate?: Date | null;
      };
    };
    revision: {
      id: string;
      label: string;
      service: any;
      site: any;
      certs: any;
      geometry: any;
      wallBuildup: any;
    };
  },
  opts: EngineeringJsonOpts,
) {
  const rev = src.revision;
  const proj = src.quote.project;
  const cust = proj.customer;

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
    project: {
      name: proj.name,
      site_address: proj.siteAddress ?? null,
      end_use: proj.endUse ?? null,
      need_by_date: proj.needByDate ? proj.needByDate.toISOString() : null,
    },

    service: {
      chemical: rev.service.chemical,
      chemical_family: rev.service.chemicalFamily,
      concentration_pct: rev.service.concentrationPct ?? null,
      operating_temp_F: rev.service.operatingTempF,
      design_temp_F: rev.service.designTempF,
      specific_gravity: rev.service.specificGravity,
      operating_pressure_psig: rev.service.operatingPressurePsig,
      vacuum_psig: rev.service.vacuumPsig,
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
    },

    wall_buildup: {
      corrosion_barrier: {
        resin: rev.wallBuildup?.resinId ?? null,
      },
      structural: {
        total_thickness_in: null,
      },
    },

    structural_analysis: null,
    nozzles: [],
    accessories: [],
    anchorage: null,
    flags: [],
    pricing: null,

    checksum_sha256: null,
  };
}
