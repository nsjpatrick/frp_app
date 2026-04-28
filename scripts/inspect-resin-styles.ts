// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path') as typeof import('node:path');

const FILE = path.resolve(process.cwd(), 'jobcalc12.2.99.xls');
// `cellStyles: true` enables font / strikethrough metadata via xlsx's
// internal style parser (works on .xls via cfb).
const wb = XLSX.readFile(FILE, { cellStyles: true, cellNF: true, sheetStubs: true });
const ws = wb.Sheets['Raw Materials'];

// Resin pricing block — Raw Materials!B4:H20 ("resin" named range)
for (let r = 4; r <= 20; r++) {
  const desc = ws[`B${r}`];
  const price = ws[`D${r}`];
  if (!desc) continue;
  // The xlsx package surfaces font properties on cell.s.font — strike: true
  // marks struck-through cells.
  const fontDesc: any = (desc as any).s?.font ?? {};
  const fontPrice: any = (price as any).s?.font ?? {};
  const struck = !!(fontDesc.strike || fontPrice.strike);
  console.log(
    String(r).padStart(3),
    String(desc.v ?? '').padEnd(35),
    `price=${String(price?.v ?? '').padEnd(10)}`,
    `descStrike=${!!fontDesc.strike}  priceStrike=${!!fontPrice.strike}`,
    struck ? '⟂STRIKE' : '',
  );
}
