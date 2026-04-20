# FRP Tank Quoting Tool — Design Spec

- **Date:** 2026-04-20
- **Status:** Approved — awaiting implementation plan
- **Scope:** V1, single-tenant; architected for multi-tenant V2

## 1. Purpose

A web application that enables a sales representative at a fiberglass reinforced plastic (FRP) tank fabricator (e.g., Plas-Tanks Industries, Fairfield OH) to generate priced quotes for chemical-storage vessels directly from a customer Request for Information (RFI). The tool:

1. Guides the sales rep through a configurator that captures service conditions, geometry, materials, nozzles, and accessories.
2. Applies embedded engineering rules (resin chemical compatibility, ASTM D3299 / D4097 / RTP-1 wall thickness, ASCE 7 seismic and wind loads) to produce a firm price for typical jobs and flag unusual jobs for engineering review.
3. Emits three linked artifacts per quote revision: a customer-facing PDF quote, a machine-readable engineering JSON spec, and a human-readable engineering PDF datasheet.
4. Maintains a quote-centric CRM-lite with customer, project, and revision history — forming the audit trail required by ISO 9001:2015 §8.3.

## 2. Scope

### In scope (V1)

- Single-tenant deployment (mock Plas-Tanks as the reference fabricator)
- Quote lifecycle: draft → sent → won / lost, with versioned revisions
- Configurator wizard (7 steps) with live quote summary
- Rules engine: resin compatibility, wall buildup per ASTM D3299 / D4097 / RTP-1, ASCE 7 seismic + wind, anchor sizing, certification-driven filtering (ASME RTP-1 class, ANSI standards, NSF/ANSI 61 & 2)
- Pricing engine: materials, labor, overhead, margin, with catalog version snapshotting
- Catalog management: resins, reinforcements, nozzles, accessories, labor standards, anchor details
- Price-feed subsystem: monthly cron pulling supplier price updates via pluggable adapters (email, CSV/XLSX, index-based, API), staged for admin approval
- Outputs: customer quote PDF, engineering JSON spec (schema v1.0.0), engineering PDF datasheet
- ISO 9001 audit records: append-only audit log, controlled document checksums, revision history
- Role-based access: sales, engineer, admin
- Auth via email magic link

### Out of scope (deferred)

- Multi-tenant onboarding, tenant admin UI (V2)
- CAD integration / parametric model generation (V2)
- In-app 2D drawing generation (V3)
- Third-party CRM integration — Salesforce, HubSpot (V2+)
- Customer-facing self-service portal (V2+)
- Direct supplier procurement API integrations beyond a generic adapter pattern (opt-in per supplier, deferred)
- FEA or dynamic sloshing analysis — tool uses ASCE 7 simplified methods; complex cases are flagged for engineering

## 3. Architecture

### Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript | Unified SSR + API routes; strong typing for pricing/rules code |
| Backend | Next.js API routes + TypeScript | Co-located with frontend; pricing math is algebra + lookup, not heavy compute |
| ORM | Prisma | Schema-as-code, migrations auditable |
| Database | Postgres | ACID required for pricing integrity; JSONB for flexible schema fields |
| Storage | S3 (or equivalent) | Versioned bucket for PDFs, supplier price sheets |
| PDF | React-PDF (engineering spec) + Puppeteer (customer quote) | Deterministic output for eng; rich branding for customer |
| Auth | NextAuth (email magic link) | Zero SSO setup friction for sales |
| Hosting | Vercel + Neon (or AWS RDS) | Cost-effective for V1 traffic |
| Queue | Vercel Cron + DB-backed job table (or BullMQ/Redis later) | Monthly price-feed jobs, async PDF rendering |

### High-level flow

```
Customer RFI → Sales Configurator (7 steps)
                    ↓
            Rules Engine (compat / thickness / seismic / wind)
                    ↓
            Cost Calculator (materials + labor + overhead + margin)
                    ↓
            PricingSnapshot (catalog version locked)
                    ↓
            Output Generators → Customer PDF
                              → Engineering JSON
                              → Engineering PDF Datasheet
                    ↓
            AuditLog entry (who/what/when/why)
```

### Core domain modules

1. **RFI Intake** — captures customer, project, service, site environment
2. **Resin Selection** — chemical + temperature → eligible resin set from compatibility matrix
3. **Geometry & Wall Buildup** — diameter/height/orientation → shell + head thickness per governing code
4. **Structural Analysis** — ASCE 7 seismic + wind; governing load case drives structural laminate
5. **Nozzles & Accessories** — schedule validation, reinforcement, pricing
6. **Pricing Engine** — deterministic calculator against catalog snapshot
7. **Output Generator** — three artifacts + checksum
8. **Catalog & Price Feeds** — versioned catalog; monthly updates via adapters
9. **Audit / ISO Records** — append-only log, controlled revision history

## 4. Data Model

```
Tenant (single row in V1; schema ready for V2 multi-tenant)
  └── User (role: sales | engineer | admin)
  └── Customer
        └── Project (site_address, end_use)
              └── Quote (status: draft | sent | won | lost, reason_lost)
                    └── Revision (label: A, B, C, ...)
                          ├── ServiceConditions
                          │     ├── chemical, concentration_pct, secondary_chemicals
                          │     ├── operating_temp_F, design_temp_F, specific_gravity
                          │     ├── operating_pressure_psig, vacuum_psig
                          │     ├── cycle_type, service_life_yr
                          │     ├── SeismicParameters (site_class, Ss, S1, Ie, risk_category)
                          │     └── WindParameters (V, exposure, Kzt, risk_category)
                          ├── Geometry (orientation, id_in, ss_height_in, top_head, bottom, freeboard_in)
                          ├── DesignCode (governing_std, inspection_requirements, hydro_test)
                          ├── CertificationRequirements
                          │     ├── asme_rtp1_class (none | I | II | III)
                          │     ├── asme_rtp1_std_revision (e.g., "RTP-1:2019")
                          │     ├── ansi_standards[] (code, revision, scope)  // e.g., AWWA D120, B16.5
                          │     ├── nsf_ansi_61 (bool) + target_end_use_temp_F
                          │     ├── nsf_ansi_2 (bool)
                          │     ├── third_party_inspector (TUV | Lloyds | Intertek | none)
                          │     └── required_documents[] (UDS, MDR, MTR, ITP, hydrotest_cert)
                          ├── WallBuildup
                          │     ├── CorrosionBarrier (veil, resin_rich_in, resin_id)
                          │     └── Structural (layer_sequence, total_thickness_in)
                          ├── StructuralAnalysis
                          │     ├── seismic_base_shear, seismic_overturning_moment
                          │     ├── wind_design_pressure, wind_overturning_moment
                          │     ├── governing_load_case
                          │     ├── anchor_uplift_force
                          │     └── freeboard_required_in
                          ├── NozzleSchedule (list of Nozzle)
                          ├── Accessories (list of AccessoryItem)
                          ├── Anchorage (foundation_type, anchor_detail_id, qty)
                          ├── Commercial (terms, freight_mode, lead_time_wk, margin_pct)
                          ├── PricingSnapshot
                          │     ├── catalog_version_id
                          │     ├── line_items[] (source, qty, unit, unit_price, extended)
                          │     ├── materials_total, labor_total, overhead, margin, freight
                          │     └── quote_total
                          ├── OutputArtifacts
                          │     ├── customer_pdf_url, customer_pdf_sha256
                          │     ├── engineering_json_url, engineering_json_sha256
                          │     └── engineering_pdf_url, engineering_pdf_sha256
                          └── Flags (list of RuleFlag: routed_to_engineering, reason, rule_id)

AuditLog (append-only; DB trigger prevents UPDATE/DELETE)
  ├── entity_type, entity_id, revision_id
  ├── actor_user_id, action (create | update | send | win | lose)
  ├── diff_json
  └── timestamp

Catalog (versioned; a Revision always references a specific catalog_version_id)
  ├── CatalogVersion (id, created_at, activated_at, notes)
  ├── Resin (name, supplier, family, max_service_temp_F, density_lb_ft3, price_per_lb, version_id)
  │     └── certifications (nsf_ansi_61: {listed, max_temp_F, listing_ref},
  │                         nsf_ansi_2: {listed, listing_ref},
  │                         asme_rtp1_class_eligibility[])
  ├── Reinforcement (type: CSM | WR | veil, weight_oz_yd2, price_per_lb, version_id)
  ├── NozzleType (size_nps, rating, flange_std, face_type, unit_price, version_id)
  ├── Accessory (category, spec, unit_price, labor_hrs, version_id)
  ├── LaborStandard (operation, hrs_per_unit, hourly_rate, version_id)
  └── AnchorDetail (bolt_size, material, embedment_in, capacity_lb, unit_price, version_id)

ChemicalCompatibility (resin_id × chemical_family × max_temp_F → allowed | caution | prohibited + citation)

PriceFeed (configured per supplier)
  ├── supplier_name, adapter_type (email | csv | index | api)
  ├── schedule (cron expression)
  ├── credentials_ref (KMS-encrypted)
  └── last_run_at, last_run_status, last_error

PriceUpdate (staged; admin-reviewed before applying)
  ├── feed_id, catalog_item_type, catalog_item_id
  ├── old_price, new_price, delta_pct
  ├── source_document_url (the PDF/CSV/email archive reference)
  ├── effective_date
  ├── status (pending_review | approved | rejected)
  └── reviewed_by, reviewed_at, review_notes
```

**Invariants**

- A Revision's PricingSnapshot is immutable once the Quote is `sent`. Edits produce a new Revision.
- OutputArtifacts store SHA256 checksums; a re-render must produce identical bytes for the same Revision.
- AuditLog is append-only; the DB role used by the app has INSERT only on that table.
- Catalog prices are referenced by `version_id`; historical quotes never change price retroactively.
- PriceUpdates never auto-apply; admin approval bumps the catalog version.

## 5. Configurator Wizard (UX)

Seven-step flow with sticky left nav and right-rail live quote summary:

1. **Customer & Project** — existing customer lookup or new; project name, site address, need-by date
2. **Service Conditions & Certifications** — chemicals, temps, SG, pressure/vacuum, site class, Ss/S1, wind V, exposure (site fields auto-populated from address via USGS + ASCE hazard tool lookups, user-overridable); multi-select flags for ASME RTP-1 (with class I/II/III), ANSI standards applicable (free-add with code + revision), NSF/ANSI 61, NSF/ANSI 2, and third-party inspector
3. **Geometry & Orientation** — orientation, working volume, ID, SS height, head types, freeboard
4. **Resin & Wall Buildup** — tool filters catalog resins to those compatible with Step 2 inputs; user picks; tool computes corrosion barrier + structural laminate thickness
5. **Nozzle Schedule** — add/edit nozzles (tag, size, rating, flange std, face type, elevation, clock position); validation for spacing and ring-support intersection
6. **Accessories** — manways, ladders/platforms, lifting lugs, heat trace, insulation prep, agitator mount, instrumentation ports, nameplate
7. **Review & Generate** — complete spec on one page, pricing breakdown, engineering-review flags, action buttons to generate artifacts

Each step validates before advancing. Flagged conditions (e.g., chemistry outside compatibility matrix, diameter exceeding shop capability, design temp within 25°F of resin HDT) surface inline; any flag routes the final quote through engineering review before it can be marked `sent`.

## 6. Rules Engine (Layer 1)

Pure functions, no DB writes, fully unit-tested. Each rule references the standard it implements.

- **Resin compatibility** — `(chemical, concentration, max_temp) → [eligible_resins]` from ChemicalCompatibility table (seeded from published supplier guides: Ashland Derakane Chemical Resistance Guide, Hetron, AOC — each entry cites source document + revision)
- **Wall thickness** — `(diameter, SG, liquid_head, design_temp, resin_props) → shell_thickness, head_thickness` per ASTM D3299 (filament-wound) or D4097 (contact-molded / hand layup), checked against RTP-1 minimums
- **Nozzle reinforcement** — per RTP-1 Section 3A local reinforcement rules
- **Seismic analysis** (ASCE 7-22 Ch. 15 for tanks)
  - impulsive + convective mass components
  - base shear `V_base = C_s × W_eff`
  - overturning moment combining impulsive and convective per 15.4.2
  - required freeboard for slosh
  - flag if convective period outside validated envelope → engineering review
- **Wind analysis** (ASCE 7-22 Ch. 27 MWFRS + Ch. 29 components-and-cladding)
  - design pressure `q_z = 0.00256 × K_z × K_zt × K_d × V² × I_w`
  - shell hoop compression check for vacuum + wind combined
  - overturning moment integrated over height
- **Combined load cases** — ASCE 7 combinations (0.6D + W, 0.9D + 1.0E, etc.); governing case drives anchor design
- **Anchor sizing** — selects from AnchorDetail catalog meeting governing uplift with appropriate safety factor
- **Certification filter** — narrows eligible resins further based on `CertificationRequirements`:
  - if `nsf_ansi_61 = true`, only resins with `nsf_ansi_61.listed = true` AND `max_temp_F >= design_temp_F` survive
  - if `nsf_ansi_2 = true`, only resins with `nsf_ansi_2.listed = true` survive
  - if `asme_rtp1_class` set, resin must declare matching `asme_rtp1_class_eligibility`
  - empty result set after filter → engineering-review flag with explanation of which constraint eliminated all candidates
- **Flag generators** — exotic chemistry, oversize for shipping, design temp near resin HDT, vacuum without ring stiffeners, extreme L/D, missing certification-required documents, ASME RTP-1 class mismatch with vessel size, etc.

Rules engine version is stamped on every Revision's output so a later re-run produces the same result or is explicitly detected as differing.

## 7. Pricing Engine (Layer 2)

Deterministic, reads frozen catalog snapshot for the revision:

```
materials_cost = Σ (resin_lbs × $/lb)
               + Σ (glass_lbs × $/lb)
               + Σ (nozzle.unit_price × qty)
               + Σ (accessory.unit_price × qty)
               + Σ (anchor.unit_price × qty)

labor_cost     = Σ (operation.hrs_per_unit × qty × $/hr)

shop_overhead  = (materials + labor) × overhead_pct

subtotal       = materials + labor + shop_overhead

margin         = subtotal × margin_pct
freight        = freight_allowance or calculated

quote_total    = subtotal + margin + freight
```

Regression fixture bank: ~20 historical jobs as frozen test cases that must produce identical totals on every build.

## 8. Output Artifacts

Every Revision `generate` action produces three linked artifacts:

1. **Customer Quote PDF** — branded, priced scope, terms, validity period; no engineering detail. Puppeteer-rendered from a templated HTML page.
2. **Engineering JSON Spec** — schema v1.0.0. Contains every input, every calculated value, governing load cases, catalog snapshot id, rule-engine version, and a SHA256 checksum. Deterministic serialization (sorted keys, fixed decimal precision).
3. **Engineering PDF Datasheet** — human-readable rendering of the JSON (same checksum reference). React-PDF, single-template for consistency.

All three are stored in versioned S3 under `s3://bucket/tenant/{tenant_id}/quote/{quote_id}/revision/{rev_label}/`. Regeneration of the same revision must yield byte-identical outputs.

### Engineering JSON schema (top-level)

```json
{
  "schema_version": "1.0.0",
  "quote_id": "Q-YYYY-NNNN",
  "revision": "A",
  "generated_at": "2026-04-20T12:00:00Z",
  "rules_engine_version": "1.0.0",
  "catalog_snapshot_id": "cat-v42",
  "customer": { /* ... */ },
  "project": { /* ... */ },
  "service": { /* ServiceConditions */ },
  "site": { /* seismic + wind */ },
  "geometry": { /* ... */ },
  "design_code": { /* ... */ },
  "certifications": {
    "asme_rtp1": { "class": "II", "std_revision": "RTP-1:2019" },
    "ansi_standards": [
      { "code": "AWWA D120", "revision": "2022", "scope": "flanged nozzles" }
    ],
    "nsf_ansi_61": { "required": true, "target_end_use_temp_F": 140 },
    "nsf_ansi_2": { "required": false },
    "third_party_inspector": "TUV",
    "required_documents": ["UDS", "MDR", "MTR", "hydrotest_cert"]
  },
  "wall_buildup": { /* corrosion barrier + structural */ },
  "structural_analysis": { /* governing case, all calcs */ },
  "nozzles": [ /* schedule */ ],
  "accessories": [ /* ... */ ],
  "anchorage": { /* detail + qty + uplift demand */ },
  "flags": [ /* routed_to_engineering reasons */ ],
  "pricing": { /* snapshot: line items + totals */ },
  "checksum_sha256": "…"
}
```

## 9. Price Feed Subsystem

Monthly cron (default 1st of month, 06:00 local) iterates configured `PriceFeed` rows. Each feed has an adapter:

- **Email** — suppliers email monthly price sheets to `prices+<feed_id>@tenant.app`; adapter parses PDF/XLSX, matches SKUs, creates `PriceUpdate` records
- **CSV/XLSX** — admin drops a file in S3 inbox or uploads via admin UI
- **Index-based** — pulls styrene / epoxy feedstock indices; applies a per-SKU contracted formula (e.g., `new_price = base × styrene_index / base_index`)
- **Supplier API** — opt-in per supplier where a portal/API exists; not assumed for any specific vendor

All updates land in the `PriceUpdate` review queue. Admin approves / rejects / edits individual rows. Approved rows stay in a staging state until the admin explicitly clicks "Publish catalog version", which atomically creates a new `CatalogVersion`, applies all approved PriceUpdates to it, and marks it active. In-flight quote revisions keep their snapshot; only new revisions reference the new version. Unpublished approvals can still be edited or reverted.

Why admin review: ISO 9001 §8.3.6 requires design-change traceability; a silent price jump flowing into active quotes is an audit finding and a commercial risk.

## 10. ISO 9001:2015 Compliance Support

The tool does not certify the manufacturer — the registrar does. It produces the records a registrar wants to see:

- **§8.3.3 Design inputs** — ServiceConditions, SeismicParameters, WindParameters persisted as controlled records
- **§8.3.4 Design controls** — Rules engine version + catalog snapshot stamped on every revision
- **§8.3.5 Design outputs** — JSON + PDF artifacts with checksums, immutable once sent
- **§8.3.6 Design changes** — Revision history with diff view; every change attributed to a user with timestamp and reason
- **§7.5 Documented information** — AuditLog append-only; PDF storage in versioned bucket; catalog versions retained indefinitely

## 11. Auth & Roles

- **Sales** — create customers, projects, quotes; generate drafts; cannot mark `sent` on a flagged quote
- **Engineer** — everything Sales can, plus approve flagged quotes, view full engineering output, annotate revisions
- **Admin** — catalog management, price-feed configuration, user management, margin overrides

Auth via NextAuth email magic link. Session tied to a single Tenant in V1 (field always evaluates to `tenant_id = 1`, but query filter pattern is in place for V2).

## 12. Non-Functional Requirements

- **Determinism** — same inputs + same catalog version must yield same outputs + identical checksums
- **Auditability** — every write to a Revision is logged with actor + diff
- **Latency** — wizard step transitions < 500 ms; output generation < 10 s (acceptable for engineering-grade output)
- **Data retention** — quotes and revisions retained indefinitely; `CatalogVersion` never hard-deleted
- **Precision** — dimensions displayed in feet-inches-sixteenths for US customary primary; metric secondary; pricing to the cent

## 13. Component Inventory (for planning)

Named units with clear boundaries:

- `rfi-intake` — forms + validation for Steps 1–2
- `geometry-form` — Step 3
- `resin-selector` — Step 4 UI + `rules/compatibility` service call
- `nozzle-schedule-editor` — Step 5
- `accessories-picker` — Step 6
- `review-generator` — Step 7 and artifact dispatch
- `rules/compatibility` — chemical × resin × temp lookup
- `rules/wall-thickness` — ASTM D3299 / D4097 / RTP-1 calcs
- `rules/structural-analysis` — ASCE 7 seismic + wind + combinations
- `rules/anchor-sizing` — selects from catalog
- `pricing/calculator` — deterministic totaling
- `outputs/customer-pdf` — Puppeteer template
- `outputs/engineering-json` — schema-v1.0.0 serializer + SHA256
- `outputs/engineering-pdf` — React-PDF template
- `catalog/*` — CRUD + versioning
- `price-feeds/*` — adapters + scheduler + review queue
- `audit-log` — writer + query API
- `auth` — NextAuth + role middleware

## 14. Inputs Required from Sales to Generate a Quote (complete list)

The original question asked what inputs the tool needs to capture:

**Customer & Project** — customer company, contact, project name, customer project number, site address, end-use description, unit count, need-by date.

**Service Conditions** — stored chemical + concentration, secondary chemicals (CIP), operating temp (normal + upset), design temp, specific gravity, operating pressure (atm/+/vacuum), cycle type, service life target.

**Site & Environmental** — indoor/outdoor, climate range, seismic (site class, Ss, S1, risk category — auto-lookup from address, overridable), wind (V, exposure B/C/D, Kzt, risk category), snow load if outdoor, installation accessibility.

**Geometry** — orientation, working volume (tool back-computes dimensions or accepts them), inside diameter, straight-side height, top head type, bottom type, freeboard requirement.

**Design Code & Certifications** — governing standard (ASTM D3299, D4097, RTP-1 Class), ASME RTP-1 stamp class (I/II/III), ANSI standards applicable (code + revision, multi-select), NSF/ANSI 61 required (+ target end-use temp), NSF/ANSI 2 required, third-party inspector (TUV/Lloyd's/Intertek/none), required document deliverables (User's Design Spec, Manufacturer's Design Report, Material Test Reports, Inspection & Test Plan, hydrotest cert), hydrostatic test spec.

**Resin & Wall Buildup** — resin family (suggested), specific resin product, corrosion barrier (veil + thickness), structural laminate spec, external UV gelcoat flag.

**Nozzle Schedule** — per nozzle: tag ID, service, size, rating, flange standard, face type, reinforcement, elevation, clock orientation, connection type.

**Accessories** — manways, ladders, platforms, handrails, lifting lugs, heat trace prep, insulation support, agitator mount prep, vent/overflow details, level indication ports, sample ports, thermowells, nameplate.

**Anchorage & Supports** — foundation type, anchor detail (sized by rules engine), leg/skirt/pad for horizontal or elevated.

**Commercial** — terms, freight mode, lead time, margin, approval chain overrides.

## 15. Open Questions (for writing-plans)

- Exact seed list of resins for V1 catalog (recommend Derakane 411-350, 441-400, 470-300; Hetron 922; vinyl ester general-purpose) — confirm with reference fabricator
- Nozzle catalog seed (assume 1" NPS through 24" NPS, 150# and 300# ratings, ANSI B16.5)
- Which US regional address geocoder for USGS seismic lookup
- Branding assets for customer PDF template
- Approval chain defaults (which roles must sign off at each status transition)

## 16. Glossary

- **FRP** — Fiberglass Reinforced Plastic
- **NSF** — National Sanitation Foundation (NSF International); certifications jointly published with ANSI as NSF/ANSI standards
- **NSF/ANSI 61** — Drinking Water System Components — Health Effects (restricts materials in potable water contact)
- **NSF/ANSI 2** — Food Equipment materials standard
- **ASME RTP-1** — Reinforced Thermoset Plastic Corrosion Resistant Equipment (design + fabrication + certification standard); class I/II/III relates to design rigor and inspection level
- **UDS** — User's Design Specification (buyer-provided inputs per RTP-1)
- **MDR** — Manufacturer's Design Report (fabricator's design calcs per RTP-1)
- **MTR** — Material Test Report
- **ITP** — Inspection & Test Plan
- **RFI** — Request for Information (customer's initial inquiry)
- **RTP-1** — ASME standard for reinforced thermoset plastic corrosion-resistant equipment
- **ASTM D3299** — Standard for filament-wound FRP corrosion-resistant tanks
- **ASTM D4097** — Standard for contact-molded (hand-layup) FRP corrosion-resistant tanks
- **ASCE 7** — Minimum Design Loads for Buildings and Other Structures
- **HDT** — Heat Deflection Temperature
- **CSM** — Chopped Strand Mat
- **WR** — Woven Roving
- **F&D** — Flanged and Dished head
- **SG** — Specific Gravity
- **MWFRS** — Main Wind Force Resisting System
