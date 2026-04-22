/**
 * Contact-import parser. Accepts CSV, XLS, XLSX in a single API via SheetJS.
 * Runs client-side (modal dynamic-imports this module), so the user gets
 * instant feedback and the xlsx payload stays out of the main bundle.
 *
 * Input shape is forgiving — we look for common header names and ignore
 * everything else. Each returned row has `error` set when the row is
 * unusable (missing company or contact name) so the preview UI can
 * highlight bad rows without blocking the whole import.
 */
import * as XLSX from 'xlsx';

export type ParsedContactRow = {
  rowIndex: number;    // 1-based, matches the source file's row numbering
  company: string;
  name: string;
  email: string;
  phone: string;
  dial: string;        // country dial code, digits only (no "+")
  error?: string;
};

// Accept a handful of header spellings per column so a rep can drop in
// sheets from different CRM exports without re-formatting first.
const HEADER_ALIASES: Record<keyof Omit<ParsedContactRow, 'rowIndex' | 'error'>, string[]> = {
  company: ['company', 'company name', 'customer', 'customer name', 'account', 'organization', 'org'],
  name:    ['name', 'contact', 'contact name', 'full name', 'person'],
  email:   ['email', 'contact email', 'e-mail', 'mail'],
  phone:   ['phone', 'contact phone', 'phone number', 'tel', 'telephone', 'mobile', 'cell'],
  dial:    ['country code', 'dial', 'dial code', 'cc', 'country'],
};

function normalizeHeader(raw: string): keyof Omit<ParsedContactRow, 'rowIndex' | 'error'> | null {
  const h = raw.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return key as keyof Omit<ParsedContactRow, 'rowIndex' | 'error'>;
  }
  return null;
}

export async function parseContactsFile(file: File): Promise<{
  rows: ParsedContactRow[];
  error?: string;
}> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : 'Could not parse file.' };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], error: 'File has no sheets.' };
  const sheet = wb.Sheets[sheetName];

  // Raw 2D array — first row is the header.
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (raw.length < 1) return { rows: [], error: 'File is empty.' };

  const headers = (raw[0] as unknown[]).map((h) => String(h ?? ''));
  const columnMap: Partial<Record<keyof Omit<ParsedContactRow, 'rowIndex' | 'error'>, number>> = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key && columnMap[key] === undefined) columnMap[key] = i;
  });

  if (columnMap.company === undefined || columnMap.name === undefined) {
    return {
      rows: [],
      error: 'Header row must include a company column and a contact-name column.',
    };
  }

  const rows: ParsedContactRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    // Skip fully-blank rows (the trailing rows Excel pads into an export).
    if (r.every((cell) => String(cell ?? '').trim() === '')) continue;

    const cell = (key: keyof Omit<ParsedContactRow, 'rowIndex' | 'error'>) => {
      const idx = columnMap[key];
      return idx === undefined ? '' : String(r[idx] ?? '').trim();
    };

    const company = cell('company');
    const name    = cell('name');
    const email   = cell('email');
    const phoneRaw = cell('phone');
    const dialRaw  = cell('dial').replace(/\D/g, '');

    let error: string | undefined;
    if (!company) error = 'Missing company.';
    else if (!name) error = 'Missing contact name.';

    rows.push({
      rowIndex: i + 1,
      company,
      name,
      email,
      phone: phoneRaw,
      dial: dialRaw || '1',
      error,
    });
  }

  return { rows };
}
