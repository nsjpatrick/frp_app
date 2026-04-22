/**
 * One-shot: give every `mock-proj-XX-Y` project a real geocodable US street
 * address so the USGS seismic + wind lookup on step-2 has something valid
 * to send to census.gov. Idempotent — re-running overwrites with the same
 * addresses.
 *
 * Addresses match the expanded CUSTOMER_TEMPLATES in prisma/seed.ts. Only
 * mock rows are touched; user-created projects are left alone.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const ADDRESSES: Record<number, string[]> = {
  0:  ['8460 Port Union Rd, Fairfield, OH 45014', '6600 Dixie Hwy, Fairfield, OH 45014', '5550 Hamilton Mason Rd, Fairfield, OH 45014'],
  1:  ['4400 Millcreek Rd, Cincinnati, OH 45242', '3825 Edwards Rd, Cincinnati, OH 45209', '10100 Reading Rd, Cincinnati, OH 45241'],
  2:  ['2201 George Flagg Pkwy, Des Moines, IA 50321', '3000 Easton Blvd, Des Moines, IA 50317'],
  3:  ['5000 Bayway Dr, Baytown, TX 77520', '2800 Decker Dr, Baytown, TX 77520', '1200 Thompson Rd, Baytown, TX 77523'],
  4:  ['4525 Ridgeview Rd, Duluth, MN 55804', '2930 Oakes Ave, Duluth, MN 55807'],
  5:  ['2700 NW Front Ave, Portland, OR 97210', '5550 NW Front Ave, Portland, OR 97210', '11300 NE Evergreen Pkwy, Hillsboro, OR 97124'],
  6:  ['1215 Thorne Rd, Tacoma, WA 98421', '2201 Lincoln Ave, Tacoma, WA 98421'],
  7:  ['2755 N Airport Plaza Ave, Springfield, MO 65802', '1801 W Chestnut Expy, Springfield, MO 65802'],
  8:  ['1501 S Frontage Rd, Plant City, FL 33563', '3510 S Alexander St, Plant City, FL 33566'],
  9:  ['2351 Busch Dr, Fort Collins, CO 80524', '1900 Pine Tree Dr, Fort Collins, CO 80525'],
  10: ['86 Morris Ave, Summit, NJ 07901', '200 Campus Dr, Morristown, NJ 07960'],
  11: ['68 W Bayfront Pkwy, Erie, PA 16507', '2135 West 22nd St, Erie, PA 16502'],
  12: ['3900 Stickney Ave, Toledo, OH 43608', '1425 N Summit St, Toledo, OH 43604'],
  13: ['1900 S McCarran Blvd, Reno, NV 89502', '2825 Mill St, Reno, NV 89502', '9700 S Meadows Pkwy, Reno, NV 89521'],
};

async function main() {
  let updated = 0;
  for (const [custIdxStr, streets] of Object.entries(ADDRESSES)) {
    const custIdx = Number(custIdxStr);
    for (let p = 0; p < streets.length; p++) {
      const projectId = `mock-proj-${String(custIdx).padStart(2, '0')}-${p}`;
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (!project) continue;
      if (project.siteAddress === streets[p]) continue;
      await db.project.update({
        where: { id: projectId },
        data: { siteAddress: streets[p] },
      });
      updated++;
    }
  }
  console.log(`Backfilled siteAddress on ${updated} mock projects.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
