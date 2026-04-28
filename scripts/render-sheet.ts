// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path') as typeof import('node:path');

const ROOT = path.resolve(process.cwd());
const FILE = path.resolve(ROOT, 'jobcalc12.2.99.xls');
const wb = XLSX.readFile(FILE, { cellFormula: true, cellNF: true, sheetStubs: true });

const sheetName = process.argv[2];
const startCol = process.argv[3] ? Number(process.argv[3]) : null;
const endCol = process.argv[4] ? Number(process.argv[4]) : null;
const startRow = process.argv[5] ? Number(process.argv[5]) : null;
const endRow = process.argv[6] ? Number(process.argv[6]) : null;

if (!sheetName || !wb.Sheets[sheetName]) {
  console.error('usage: render-sheet.ts <sheetName> [startCol] [endCol] [startRow] [endRow]');
  console.error('available:', wb.SheetNames.join(', '));
  process.exit(1);
}

const ws = wb.Sheets[sheetName];
const ref = ws['!ref'];
if (!ref) { console.log('(empty)'); process.exit(0); }
const range = XLSX.utils.decode_range(ref);

const sCol = startCol ?? range.s.c;
const eCol = endCol ?? range.e.c;
const sRow = startRow ?? range.s.r;
const eRow = endRow ?? range.e.r;

console.log(`# ${sheetName}  (${ref})`);
console.log(`viewport: cols ${sCol}-${eCol}  rows ${sRow}-${eRow}\n`);

// Column header row
const colLabels = ['row'];
for (let C = sCol; C <= eCol; C++) colLabels.push(XLSX.utils.encode_col(C));
console.log(colLabels.join('\t'));

for (let R = sRow; R <= eRow; R++) {
  const row: string[] = [String(R + 1)];
  let any = false;
  for (let C = sCol; C <= eCol; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
    if (!cell) { row.push(''); continue; }
    let v: string;
    if (cell.f) v = `=${cell.f}`;
    else if (cell.v === undefined || cell.v === null) v = '';
    else v = String(cell.v);
    if (v.length > 60) v = v.slice(0, 57) + '...';
    if (v) any = true;
    row.push(v);
  }
  if (any) console.log(row.join('\t'));
}
