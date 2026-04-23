import path from 'node:path';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Path,
  Line,
  G,
} from '@react-pdf/renderer';
import type { QuotePdfData } from '@/lib/outputs/quote-pdf-data';

/**
 * Modernized Plas-Tanks quote PDF.
 *
 * Font: Inter (self-hosted via @fontsource/inter). Inter is the modern
 * successor to Helvetica for UI typography — optimized for screen +
 * print, wide language support, and strong contrast at body sizes. We
 * register Regular / Medium / SemiBold / Bold so the layout's hierarchy
 * reads at a glance without relying on size alone.
 *
 * Layout follows the reference quote's content structure but strips the
 * 1990s table grid in favor of a rhythm-driven, section-based design:
 * amber accent rules to echo the app's liquid-glass accent color,
 * generous gutters, and tabular numerics for pricing.
 */
const INTER_DIR = path.join(process.cwd(), 'node_modules/@fontsource/inter/files');

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(INTER_DIR, 'inter-latin-400-normal.woff'), fontWeight: 400 },
    { src: path.join(INTER_DIR, 'inter-latin-500-normal.woff'), fontWeight: 500 },
    { src: path.join(INTER_DIR, 'inter-latin-600-normal.woff'), fontWeight: 600 },
    { src: path.join(INTER_DIR, 'inter-latin-700-normal.woff'), fontWeight: 700 },
  ],
});

const C = {
  ink:     '#0F172A', // slate-900
  body:    '#1F2937', // slate-800
  soft:    '#475569', // slate-600
  muted:   '#64748B', // slate-500
  faint:   '#94A3B8', // slate-400
  hairline:'#E2E8F0', // slate-200
  amber:   '#B45309', // amber-700 (accent)
  amberBg: '#FEF3C7', // amber-100
  sheetBg: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 9.5,
    fontFamily: 'Inter',
    color: C.body,
    lineHeight: 1.55,
  },
  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: `1pt solid ${C.hairline}`,
    paddingBottom: 16,
    marginBottom: 22,
  },
  brandRow:    { flexDirection: 'row', alignItems: 'center' },
  brandText:   { marginLeft: 10 },
  brandTitle:  { fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: 0.2 },
  brandSub:    { fontSize: 8.5,  color: C.muted, marginTop: 1 },
  title:       { fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: -0.3 },
  titleKicker: {
    fontSize: 8.5,
    fontWeight: 600,
    color: C.amber,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  // ── Meta strip ──────────────────────────────────────────────────────────
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    borderLeft: `2pt solid ${C.amber}`,
    paddingLeft: 12,
  },
  metaCell: { width: '33.33%', paddingVertical: 4, paddingRight: 8 },
  metaLabel:{
    fontSize: 7.5,
    fontWeight: 600,
    color: C.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  metaValue:{ fontSize: 10, fontWeight: 500, color: C.ink },
  // ── Address block (recipient / sales rep) ──────────────────────────────
  addressRow:  { flexDirection: 'row', marginBottom: 20 },
  addressCol:  { flex: 1, paddingRight: 10 },
  addressEyebrow:{
    fontSize: 7.5,
    fontWeight: 600,
    color: C.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  addressCompany: { fontSize: 11.5, fontWeight: 600, color: C.ink },
  addressLine:    { fontSize: 9.5, color: C.body, marginTop: 1 },
  // ── Section ─────────────────────────────────────────────────────────────
  section:      { marginBottom: 16 },
  sectionHead:  {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.amber,
    marginBottom: 6,
  },
  sectionRule:  { height: 1, backgroundColor: C.hairline, marginBottom: 10 },
  para:         { fontSize: 9.5, color: C.body, marginBottom: 6 },
  paraLead:     { fontSize: 10, fontWeight: 500, color: C.ink, marginBottom: 8 },
  // ── Key/value grid ──────────────────────────────────────────────────────
  kvGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  kvCell:       { width: '50%', paddingVertical: 3, paddingRight: 12 },
  kvCellThird:  { width: '33.33%', paddingVertical: 3, paddingRight: 12 },
  kvLabel:      { fontSize: 7.5, color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 },
  kvValue:      { fontSize: 10, color: C.ink, fontWeight: 500, marginTop: 1 },
  // ── Accessory / clarification list ─────────────────────────────────────
  listRow:      { flexDirection: 'row', marginBottom: 3 },
  listDot:      { width: 10, color: C.amber, fontWeight: 700 },
  listItem:     { flex: 1, fontSize: 9.5, color: C.body },
  // ── Price callout ───────────────────────────────────────────────────────
  priceCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    border: `1pt solid ${C.hairline}`,
  },
  priceRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  priceLabel:     { fontSize: 9.5, color: C.soft },
  priceValue:     { fontSize: 10.5, fontWeight: 500, color: C.ink },
  priceTotalRow:  {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTop: `1pt solid ${C.hairline}`,
  },
  priceTotalLabel:{ fontSize: 10.5, fontWeight: 600, color: C.ink },
  priceTotalValue:{ fontSize: 14, fontWeight: 700, color: C.amber, letterSpacing: -0.3 },
  // ── Signature block ─────────────────────────────────────────────────────
  sigWrap: { marginTop: 28, flexDirection: 'row', gap: 24 },
  sigCol:  { flex: 1 },
  sigLine: { borderBottom: `1pt solid ${C.ink}`, height: 18, marginTop: 18 },
  sigLabel:{ fontSize: 8, color: C.muted, marginTop: 4, letterSpacing: 0.6, textTransform: 'uppercase' },
  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    borderTop: `1pt solid ${C.hairline}`,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: C.muted,
  },
  // ── Cert badges (header) ────────────────────────────────────────────────
  badgeRow:    { flexDirection: 'row', marginTop: 8 },
  badge: {
    fontSize: 7,
    fontWeight: 600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: C.amberBg,
    color: C.amber,
    marginLeft: 5,
    letterSpacing: 0.4,
  },
});

/** Inline SVG recreation of the PTI spiral mark. Matches public/icon-light.svg. */
function PtiMark({ size = 30 }: { size?: number }) {
  const s = size / 420;
  return (
    <Svg width={size} height={size * (420 / 420)} viewBox="20 20 400 420">
      <G fill="none" stroke={C.ink} strokeWidth={16} strokeLinecap="round">
        <Path d="M 100 420 L 100 200 A 150 150 0 1 1 250 350" />
        <Path d="M 130 420 L 130 200 A 120 120 0 1 1 250 320" />
        <Path d="M 160 420 L 160 200 A  90  90 0 1 1 250 290" />
        <Path d="M 190 420 L 190 200 A  60  60 0 1 1 250 260" />
        <Path d="M 220 420 L 220 200 A  30  30 0 1 1 250 230" />
        <Line x1={45} y1={350} x2={65} y2={350} />
        <Line x1={45} y1={320} x2={65} y2={320} />
        <Line x1={45} y1={290} x2={65} y2={290} />
        <Line x1={45} y1={260} x2={65} y2={260} />
        <Line x1={45} y1={230} x2={65} y2={230} />
      </G>
    </Svg>
  );
}

export function QuotePdfDocument({ data }: { data: QuotePdfData }) {
  const envSummary = [
    data.site.indoor ? 'Indoor installation' : 'Outdoor installation',
    `Wind: ${data.site.windSpeedMph}`,
    `Seismic: Ss ${data.site.seismicSs} / S1 ${data.site.seismicS1} / Site Class ${data.site.seismicSiteClass}`,
  ].join(' · ');

  const productParagraph =
    `The vessel is a ${data.vessel.orientation.toLowerCase()}, cylindrical ${data.product.familyLabel.toLowerCase()} ` +
    `fabricated by the ${data.product.astmLabel} method in accordance with ${data.product.astmSpec}. ` +
    `Primary dimensions: ${data.vessel.idFt} ID × ${data.vessel.ssHeightFt} straight-shell height, ` +
    `with a ${data.vessel.bottom.toLowerCase()} bottom and ${data.vessel.topHead.toLowerCase()}. ` +
    `Net shell capacity is approximately ${data.vessel.capacityGal}.`;

  return (
    <Document
      title={`Quote ${data.meta.quoteNumber}`}
      author="Plas-Tanks Industries, Inc."
      subject={`${data.product.familyLabel} for ${data.recipient.company}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            <PtiMark size={34} />
            <View style={styles.brandText}>
              <Text style={styles.brandTitle}>Plas-Tanks Industries, Inc.</Text>
              <Text style={styles.brandSub}>4400 Port Union Road · Fairfield, Ohio 45014</Text>
              <Text style={styles.brandSub}>513-874-5047 · plastanks.com</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.titleKicker}>Quotation</Text>
            <Text style={styles.title}>
              {data.meta.quoteNumber}
              <Text style={{ color: C.muted, fontWeight: 500 }}> · Rev {data.meta.revision}</Text>
            </Text>
            <View style={styles.badgeRow}>
              {data.certifications.asmeRtp1Class && (
                <Text style={styles.badge}>ASME RTP-1 CL {data.certifications.asmeRtp1Class}</Text>
              )}
              {data.certifications.nsfAnsi61 && <Text style={styles.badge}>NSF/ANSI 61</Text>}
              {data.certifications.nsfAnsi2  && <Text style={styles.badge}>NSF/ANSI 2</Text>}
            </View>
          </View>
        </View>

        {/* Meta strip */}
        <View style={styles.metaStrip}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date of Issue</Text>
            <Text style={styles.metaValue}>{data.meta.dateOfIssue}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Inquiry No.</Text>
            <Text style={styles.metaValue}>{data.meta.inquiryNumber}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Est. Completion</Text>
            <Text style={styles.metaValue}>{data.meta.estCompletion}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Terms</Text>
            <Text style={styles.metaValue}>{data.meta.terms}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>F.O.B.</Text>
            <Text style={styles.metaValue}>{data.meta.fob}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Quotation No.</Text>
            <Text style={styles.metaValue}>{data.meta.quoteNumber}</Text>
          </View>
        </View>

        {/* Address block */}
        <View style={styles.addressRow}>
          <View style={styles.addressCol}>
            <Text style={styles.addressEyebrow}>Prepared For</Text>
            <Text style={styles.addressCompany}>{data.recipient.company}</Text>
            {data.recipient.contactName ? <Text style={styles.addressLine}>{data.recipient.contactName}</Text> : null}
            {data.recipient.email        ? <Text style={styles.addressLine}>{data.recipient.email}</Text> : null}
            {data.recipient.phone        ? <Text style={styles.addressLine}>{data.recipient.phone}</Text> : null}
            {data.recipient.siteAddress  ? <Text style={[styles.addressLine, { marginTop: 4, color: C.muted }]}>Site: {data.recipient.siteAddress}</Text> : null}
          </View>
          <View style={styles.addressCol}>
            <Text style={styles.addressEyebrow}>Sales Engineer</Text>
            <Text style={styles.addressCompany}>{data.salesRep.name}</Text>
            <Text style={styles.addressLine}>{data.salesRep.email}</Text>
            <Text style={styles.addressLine}>{data.salesRep.phone}</Text>
          </View>
        </View>

        {/* Scope */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>Scope of Supply</Text>
          <View style={styles.sectionRule} />
          <Text style={styles.paraLead}>{productParagraph}</Text>
          <Text style={styles.para}>
            {data.resin.corrosionBarrier} Structural laminate sized for the service conditions below;
            exterior finished with a UV-resistant pigmented topcoat.
          </Text>
        </View>

        {/* Vessel specifics */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>Vessel</Text>
          <View style={styles.sectionRule} />
          <View style={styles.kvGrid}>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Orientation</Text>
              <Text style={styles.kvValue}>{data.vessel.orientation}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>ID × Height</Text>
              <Text style={styles.kvValue}>{data.vessel.idFt} × {data.vessel.ssHeightFt}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Capacity</Text>
              <Text style={styles.kvValue}>{data.vessel.capacityGal}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Bottom</Text>
              <Text style={styles.kvValue}>{data.vessel.bottom}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Top Head</Text>
              <Text style={styles.kvValue}>{data.vessel.topHead}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Resin System</Text>
              <Text style={styles.kvValue}>{data.resin.name}</Text>
            </View>
          </View>
        </View>

        {/* Design conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>Design Conditions</Text>
          <View style={styles.sectionRule} />
          <View style={styles.kvGrid}>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Service</Text>
              <Text style={styles.kvValue}>{data.service.chemical}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Specific Gravity</Text>
              <Text style={styles.kvValue}>{data.service.specificGravity}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Operating Temp</Text>
              <Text style={styles.kvValue}>{data.service.operatingTempF}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Design Temp</Text>
              <Text style={styles.kvValue}>{data.service.designTempF}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Pressure</Text>
              <Text style={styles.kvValue}>{data.service.operatingPressurePsig}</Text>
            </View>
            <View style={styles.kvCellThird}>
              <Text style={styles.kvLabel}>Vacuum</Text>
              <Text style={styles.kvValue}>{data.service.vacuumPsig}</Text>
            </View>
          </View>
          <Text style={[styles.para, { marginTop: 8, color: C.soft }]}>{envSummary}</Text>
        </View>

        {/* Accessories */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>Accessories Included</Text>
          <View style={styles.sectionRule} />
          {data.accessories.map((a, i) => (
            <View style={styles.listRow} key={i}>
              <Text style={styles.listDot}>·</Text>
              <Text style={styles.listItem}>{a}</Text>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>Investment</Text>
          <View style={styles.sectionRule} />
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Vessel — materials, fabrication &amp; quality plan</Text>
              <Text style={styles.priceValue}>{data.pricing.basePrice}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Freight allowance (F.O.B. Fairfield)</Text>
              <Text style={styles.priceValue}>{data.pricing.freight}</Text>
            </View>
            <View style={styles.priceTotalRow}>
              <Text style={styles.priceTotalLabel}>Total delivered</Text>
              <Text style={styles.priceTotalValue}>{data.pricing.totalDelivered}</Text>
            </View>
          </View>
        </View>

        {/* Clarifications */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>Clarifications &amp; Notes</Text>
          <View style={styles.sectionRule} />
          {data.clarifications.map((c, i) => (
            <View style={styles.listRow} key={i}>
              <Text style={styles.listDot}>·</Text>
              <Text style={styles.listItem}>{c}</Text>
            </View>
          ))}
        </View>

        {/* Signature */}
        <View style={styles.sigWrap}>
          <View style={styles.sigCol}>
            <Text style={[styles.addressEyebrow, { marginBottom: 0 }]}>Accepted for Plas-Tanks Industries, Inc.</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>{data.salesRep.name} · Sales Engineer</Text>
          </View>
          <View style={styles.sigCol}>
            <Text style={[styles.addressEyebrow, { marginBottom: 0 }]}>Accepted for {data.recipient.company}</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Authorized Signature &amp; Date</Text>
          </View>
        </View>

        {/* Footer (printed on every page) */}
        <View style={styles.footer} fixed>
          <Text>Plas-Tanks Industries · Quote {data.meta.quoteNumber} Rev {data.meta.revision}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
