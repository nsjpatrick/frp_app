import { PrismaClient, QuoteStatus } from '@prisma/client';

const db = new PrismaClient();

// Sample data for generating realistic mock quotes.
// `streets[]` gives each project a real geocodable US street address so the
// USGS seismic / wind lookup tools on step-2 have something to hit. Addresses
// are non-residential where practical (industrial parks, public works yards,
// university water plants) and cover a range of seismic risk from low (Erie
// PA, Duluth MN) to high (Reno NV, Portland OR) so demos show off the span.
const CUSTOMER_TEMPLATES = [
  { name: 'Acme Chem Co.',              city: 'Fairfield, OH',       contact: 'Jane Doe',
    streets: ['8460 Port Union Rd, Fairfield, OH 45014', '6600 Dixie Hwy, Fairfield, OH 45014', '5550 Hamilton Mason Rd, Fairfield, OH 45014'] },
  { name: 'Midwest Plating Works',      city: 'Cincinnati, OH',      contact: 'Mark Reilly',
    streets: ['4400 Millcreek Rd, Cincinnati, OH 45242', '3825 Edwards Rd, Cincinnati, OH 45209', '10100 Reading Rd, Cincinnati, OH 45241'] },
  { name: 'Prairie Water Authority',    city: 'Des Moines, IA',      contact: 'Lisa Chen',
    streets: ['2201 George Flagg Pkwy, Des Moines, IA 50321', '3000 Easton Blvd, Des Moines, IA 50317'] },
  { name: 'Gulf Coast Refining',        city: 'Baytown, TX',         contact: 'Ernesto Alvarez',
    streets: ['5000 Bayway Dr, Baytown, TX 77520', '2800 Decker Dr, Baytown, TX 77520', '1200 Thompson Rd, Baytown, TX 77523'] },
  { name: 'Northland Processing',       city: 'Duluth, MN',          contact: 'Rachel Kim',
    streets: ['4525 Ridgeview Rd, Duluth, MN 55804', '2930 Oakes Ave, Duluth, MN 55807'] },
  { name: 'Delta Semiconductor',        city: 'Portland, OR',        contact: 'Samir Patel',
    streets: ['2700 NW Front Ave, Portland, OR 97210', '5550 NW Front Ave, Portland, OR 97210', '11300 NE Evergreen Pkwy, Hillsboro, OR 97124'] },
  { name: 'Evergreen Paper Mill',       city: 'Tacoma, WA',          contact: 'Bob McKay',
    streets: ['1215 Thorne Rd, Tacoma, WA 98421', '2201 Lincoln Ave, Tacoma, WA 98421'] },
  { name: 'Ozark Metal Finishing',      city: 'Springfield, MO',     contact: 'Denise Lott',
    streets: ['2755 N Airport Plaza Ave, Springfield, MO 65802', '1801 W Chestnut Expy, Springfield, MO 65802'] },
  { name: 'Southern Dairy Processors',  city: 'Plant City, FL',      contact: 'Hector Alvarez',
    streets: ['1501 S Frontage Rd, Plant City, FL 33563', '3510 S Alexander St, Plant City, FL 33566'] },
  { name: 'Rocky Mountain Brewing',     city: 'Fort Collins, CO',    contact: 'Tyler Nguyen',
    streets: ['2351 Busch Dr, Fort Collins, CO 80524', '1900 Pine Tree Dr, Fort Collins, CO 80525'] },
  { name: 'Highland Pharmaceuticals',   city: 'Morristown, NJ',      contact: 'Dr. Amir Khan',
    streets: ['86 Morris Ave, Summit, NJ 07901', '200 Campus Dr, Morristown, NJ 07960'] },
  { name: 'Lakeside Wastewater Dept.',  city: 'Erie, PA',            contact: 'Marlene Ortiz',
    streets: ['68 W Bayfront Pkwy, Erie, PA 16507', '2135 West 22nd St, Erie, PA 16502'] },
  { name: 'Great Lakes Hypochlorite',   city: 'Toledo, OH',          contact: 'Greg Saari',
    streets: ['3900 Stickney Ave, Toledo, OH 43608', '1425 N Summit St, Toledo, OH 43604'] },
  { name: 'Summit Battery Holdings',    city: 'Reno, NV',            contact: 'Priya Venkat',
    streets: ['1900 S McCarran Blvd, Reno, NV 89502', '2825 Mill St, Reno, NV 89502', '9700 S Meadows Pkwy, Reno, NV 89521'] },
];

const PROJECT_SCENARIOS = [
  { name: '50% Sulfuric Day Tank',        endUse: '50% H2SO4 storage' },
  { name: 'Caustic Bulk Storage',         endUse: '50% NaOH bulk storage' },
  { name: 'Sodium Hypochlorite Day Tank', endUse: '12.5% NaOCl storage' },
  { name: 'FRP Pickle Line Rinse',        endUse: 'dilute HCl rinse' },
  { name: 'RO Permeate Storage',          endUse: 'Potable/RO water storage' },
  { name: 'Ferric Chloride Tote Tank',    endUse: '40% FeCl3 storage' },
  { name: 'Chromic Acid Plating Tank',    endUse: 'CrO3 bath' },
  { name: 'Citric Acid Dip Tank',         endUse: 'Food-contact citric clean' },
  { name: 'Hydrofluoric Acid Storage',    endUse: 'Dilute HF storage' },
  { name: 'Mixed Acid Rinse',             endUse: 'HNO3/HF passivation rinse' },
  { name: 'Alum Bulk Storage',            endUse: 'Aluminum sulfate coag' },
  { name: 'Brine Makeup Tank',            endUse: 'Softener brine' },
  { name: 'Polymer Solution Tank',        endUse: 'Cationic polymer storage' },
  { name: 'Carbon Slurry Tank',           endUse: 'Activated carbon slurry' },
];

// Weighted status distribution — more drafts + sent + engineering (active work)
// than won/lost (terminal). Building is rarer because it's a short window.
const STATUS_DISTRIBUTION: Array<[QuoteStatus, number]> = [
  ['DRAFT', 18],
  ['SENT', 22],
  ['ENGINEERING', 14],
  ['BUILDING', 9],
  ['WON', 11],
  ['LOST', 6],
];

function weightedStatus(rng: () => number): QuoteStatus {
  const total = STATUS_DISTRIBUTION.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [status, weight] of STATUS_DISTRIBUTION) {
    r -= weight;
    if (r <= 0) return status;
  }
  return 'DRAFT';
}

// Seeded PRNG so repeated seed runs produce the same mock dataset.
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

async function main() {
  const tenant = await db.tenant.upsert({
    where: { id: 'mock-plas-tanks' },
    update: {},
    create: { id: 'mock-plas-tanks', name: 'Plas-Tanks Industries (mock)' },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@frp-tank-quoter.local';
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Seed Admin',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  });

  // Idempotent — skip fresh generation when we already have a healthy set.
  // Backfill (at the bottom) still runs so new nullable columns get values.
  const existing = await db.quote.count({
    where: { project: { customer: { tenantId: tenant.id } } },
  });
  const skipGeneration = existing >= 80;
  if (skipGeneration) {
    console.log(`Seed: ${existing} quotes already present, skipping mock regeneration.`);
  } else {
    console.log(`Seed: generating mock dataset (have ${existing} quotes, targeting 100)...`);
  }

  const rng = makeRng(0xFEED);

  for (let i = 0; i < CUSTOMER_TEMPLATES.length; i++) {
    const c = CUSTOMER_TEMPLATES[i];
    const customerId = `mock-cust-${i.toString().padStart(2, '0')}`;
    await db.customer.upsert({
      where: { id: customerId },
      update: {},
      create: {
        id: customerId,
        tenantId: tenant.id,
        name: c.name,
        contactName: c.contact,
        contactEmail: c.contact.toLowerCase().replace(/[^a-z]/g, '.') + '@example.com',
        contactPhone: `+1-555-${String(100 + i).padStart(3, '0')}-${String(4000 + i * 13).padStart(4, '0')}`,
      },
    });

    // 1-3 projects per customer. Pick a distinct real street per project
    // (cycle the list if the customer has more projects than streets).
    const projectsForCustomer = 1 + Math.floor(rng() * 3);
    for (let p = 0; p < projectsForCustomer; p++) {
      const scenario = PROJECT_SCENARIOS[(i * 3 + p) % PROJECT_SCENARIOS.length];
      const projectId = `mock-proj-${i.toString().padStart(2, '0')}-${p}`;
      const street = c.streets[p % c.streets.length];
      await db.project.upsert({
        where: { id: projectId },
        update: {},
        create: {
          id: projectId,
          customerId,
          name: scenario.name,
          siteAddress: street,
          endUse: scenario.endUse,
          needByDate: new Date(Date.now() + (30 + Math.floor(rng() * 180)) * 86400 * 1000),
        },
      });
    }
  }

  const projects = await db.project.findMany({
    where: { customer: { tenantId: tenant.id } },
    select: { id: true, customerId: true },
  });

  const target = 100;
  const toCreate = skipGeneration ? 0 : Math.max(0, target - existing);

  for (let n = 0; n < toCreate; n++) {
    const proj = projects[Math.floor(rng() * projects.length)];
    const year = 2025 + Math.floor(rng() * 2);
    const seq = 1000 + Math.floor(rng() * 9000);
    const revSuffix = String.fromCharCode(65 + Math.floor(rng() * 6));
    const quoteNumber = `Q-${year}-${seq}${revSuffix}`;
    const status = weightedStatus(rng);
    const ageDays = Math.floor(rng() * 365);
    const updated = new Date(Date.now() - ageDays * 86400 * 1000);
    const created = new Date(updated.getTime() - Math.floor(rng() * 30) * 86400 * 1000);

    // Mock price: 40k–220k, biased toward mid-range. Applied to every quote
    // past DRAFT so the dashboard has values to show.
    const priceActive = status !== 'DRAFT';
    const totalPrice = priceActive
      ? Math.round((40000 + rng() * 180000) / 100) * 100
      : null;
    // WON rows also get a wonAt — biased toward the current year so the YTD
    // chart has signal. Fall back to `updated` when older than a year.
    const wonAt = status === 'WON' ? updated : null;

    try {
      const quote = await db.quote.create({
        data: {
          projectId: proj.id,
          customerId: proj.customerId,
          number: quoteNumber,
          status,
          totalPrice,
          wonAt,
          createdAt: created,
          updatedAt: updated,
        },
      });

      const revisionCount = 1 + Math.floor(rng() * 3);
      for (let r = 0; r < revisionCount; r++) {
        const label = String.fromCharCode(65 + r);
        await db.revision.create({
          data: {
            quoteId: quote.id,
            label,
            createdAt: new Date(created.getTime() + r * 86400 * 1000),
          },
        });
      }
    } catch (e) {
      // Number collision on @unique quote.number — skip and move on.
      continue;
    }
  }

  // Backfill totalPrice + wonAt for pre-existing rows that were seeded before
  // these columns existed. Deterministic-ish via the quote id so reruns stay
  // stable for the same database.
  const unpriced = await db.quote.findMany({
    where: {
      project: { customer: { tenantId: tenant.id } },
      totalPrice: null,
      status: { not: 'DRAFT' },
    },
    select: { id: true, status: true, updatedAt: true },
  });
  for (const q of unpriced) {
    const salt = Array.from(q.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const price = Math.round((40000 + (salt % 180000)) / 100) * 100;
    await db.quote.update({
      where: { id: q.id },
      data: {
        totalPrice: price,
        wonAt: q.status === 'WON' ? q.updatedAt : null,
      },
    });
  }

  const final = await db.quote.count({
    where: { project: { customer: { tenantId: tenant.id } } },
  });
  console.log(`Seed: ${final} quotes total for tenant ${tenant.id}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
