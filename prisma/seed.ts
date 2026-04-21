import { PrismaClient, QuoteStatus } from '@prisma/client';

const db = new PrismaClient();

// Sample data for generating realistic mock quotes.
const CUSTOMER_TEMPLATES = [
  { name: 'Acme Chem Co.',              city: 'Fairfield, OH',       contact: 'Jane Doe' },
  { name: 'Midwest Plating Works',      city: 'Cincinnati, OH',      contact: 'Mark Reilly' },
  { name: 'Prairie Water Authority',    city: 'Des Moines, IA',      contact: 'Lisa Chen' },
  { name: 'Gulf Coast Refining',        city: 'Baytown, TX',         contact: 'Ernesto Alvarez' },
  { name: 'Northland Processing',       city: 'Duluth, MN',          contact: 'Rachel Kim' },
  { name: 'Delta Semiconductor',        city: 'Portland, OR',        contact: 'Samir Patel' },
  { name: 'Evergreen Paper Mill',       city: 'Tacoma, WA',          contact: 'Bob McKay' },
  { name: 'Ozark Metal Finishing',      city: 'Springfield, MO',     contact: 'Denise Lott' },
  { name: 'Southern Dairy Processors',  city: 'Plant City, FL',      contact: 'Hector Alvarez' },
  { name: 'Rocky Mountain Brewing',     city: 'Fort Collins, CO',    contact: 'Tyler Nguyen' },
  { name: 'Highland Pharmaceuticals',   city: 'Morristown, NJ',      contact: 'Dr. Amir Khan' },
  { name: 'Lakeside Wastewater Dept.',  city: 'Erie, PA',            contact: 'Marlene Ortiz' },
  { name: 'Great Lakes Hypochlorite',   city: 'Toledo, OH',          contact: 'Greg Saari' },
  { name: 'Summit Battery Holdings',    city: 'Reno, NV',            contact: 'Priya Venkat' },
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

  // Idempotent — skip if the dataset already has plenty of quotes.
  const existing = await db.quote.count({
    where: { project: { customer: { tenantId: tenant.id } } },
  });
  if (existing >= 80) {
    console.log(`Seed: ${existing} quotes already present, skipping mock regeneration.`);
    console.log(`Seeded tenant ${tenant.id} and admin ${adminEmail}`);
    return;
  }

  console.log(`Seed: generating mock dataset (have ${existing} quotes, targeting 100)...`);

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
        contactPhone: '555-0' + (100 + i).toString(),
      },
    });

    // 1-3 projects per customer.
    const projectsForCustomer = 1 + Math.floor(rng() * 3);
    for (let p = 0; p < projectsForCustomer; p++) {
      const scenario = PROJECT_SCENARIOS[(i * 3 + p) % PROJECT_SCENARIOS.length];
      const projectId = `mock-proj-${i.toString().padStart(2, '0')}-${p}`;
      await db.project.upsert({
        where: { id: projectId },
        update: {},
        create: {
          id: projectId,
          customerId,
          name: scenario.name,
          siteAddress: `Plant ${p + 1}, ${c.city}`,
          endUse: scenario.endUse,
          needByDate: new Date(Date.now() + (30 + Math.floor(rng() * 180)) * 86400 * 1000),
        },
      });
    }
  }

  const projects = await db.project.findMany({
    where: { customer: { tenantId: tenant.id } },
    select: { id: true },
  });

  const target = 100;
  const toCreate = Math.max(0, target - existing);

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

    try {
      const quote = await db.quote.create({
        data: {
          projectId: proj.id,
          number: quoteNumber,
          status,
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
