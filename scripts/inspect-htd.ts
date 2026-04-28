// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path') as typeof import('node:path');

const ROOT = path.resolve(process.cwd());
const FILE = path.resolve(ROOT, 'HTD Tank Heat Loss Program_ver 5_PlasTanks (8-15-24).xlsx');
const wb = XLSX.readFile(FILE, { cellFormula: true, cellNF: true, sheetStubs: true });

const out: any = {
  sheetNames: wb.SheetNames,
  defined: (wb.Workbook?.Names ?? []).map((n: any) => ({ Name: n.Name, Ref: n.Ref })),
  sheets: {},
};

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  if (!ws) continue;
  const ref = ws['!ref'];
  const range = ref ? XLSX.utils.decode_range(ref) : null;
  const cells: any[] = [];
  if (range) {
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        if (cell.v === undefined && !cell.f) continue;
        cells.push({ a: addr, t: cell.t, v: cell.v, f: cell.f, w: cell.w });
      }
    }
  }
  out.sheets[name] = { ref, cellCount: cells.length, cells };
}

const outDir = path.resolve(ROOT, 'scripts', 'htd-dump');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'workbook-overview.json'), JSON.stringify({
  sheetNames: out.sheetNames,
  defined: out.defined,
  sheetCellCounts: Object.fromEntries(Object.entries(out.sheets).map(([k, v]: any) => [k, v.cellCount])),
}, null, 2));

for (const [name, sheet] of Object.entries(out.sheets) as any) {
  const safe = name.replace(/[^a-z0-9_-]+/gi, '_');
  fs.writeFileSync(path.join(outDir, `sheet-${safe}.json`), JSON.stringify(sheet, null, 2));
}
console.log('sheets:', wb.SheetNames.length, '→', outDir);
