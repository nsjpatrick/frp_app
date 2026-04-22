'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { batchUploadContacts, type BatchUploadResult } from '@/lib/actions/batch-upload';
import type { ParsedContactRow } from '@/lib/upload/parse-contacts';

/**
 * BatchUploadContactsModal — drag-drop + file-picker intake for CSV / XLS /
 * XLSX contact lists. Parses client-side (xlsx is dynamic-imported so the
 * dep stays out of the main bundle), shows a preview with per-row errors
 * flagged, then submits valid rows to `batchUploadContacts`.
 *
 * Portaled + inline-styled overlay so the modal escapes any .glass-filtered
 * ancestor — same Safari-safe pattern as the other modals.
 */

const ACCEPTED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];
const ACCEPT_MIME = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

export function BatchUploadContactsModal() {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedContactRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchUploadResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  const reset = () => {
    setFilename(null);
    setRows([]);
    setDragOver(false);
    setParseError(null);
    setSubmitError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const close = () => { setOpen(false); reset(); };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setRows([]);
    setParseError(null);
    setResult(null);

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setParseError(`Unsupported file type: ${ext || '(no extension)'}. Use CSV, XLS, or XLSX.`);
      return;
    }

    // Dynamic import so xlsx only loads for users who actually open this flow.
    const { parseContactsFile } = await import('@/lib/upload/parse-contacts');
    const { rows: parsed, error } = await parseContactsFile(file);
    if (error) { setParseError(error); return; }
    setRows(parsed);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  const onPick = () => fileInputRef.current?.click();
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const validRows  = rows.filter((r) => !r.error);
  const errorRows  = rows.filter((r) =>  r.error);
  const canImport  = validRows.length > 0 && !pending;

  const onImport = () => {
    setSubmitError(null);
    const formData = new FormData();
    formData.set('rowsJson', JSON.stringify(validRows.map(({ error: _e, rowIndex: _i, ...r }) => r)));
    startTransition(async () => {
      try {
        const res = await batchUploadContacts(formData);
        setResult(res);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Could not import.');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-glass-secondary"
      >
        <Upload className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        Upload Contacts
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => !pending && close()}
            aria-hidden
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0, left: 0,
              zIndex: 60,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
            }}
          />
          <div
            className="flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-upload-title"
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0, left: 0,
              zIndex: 70,
            }}
          >
            <div
              className="pointer-events-auto relative bg-white rounded-3xl border border-slate-200 w-full max-w-2xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col"
              style={{
                boxShadow:
                  '0 30px 80px -20px rgba(15, 23, 42, 0.55), 0 4px 12px rgba(15, 23, 42, 0.10)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-200 shrink-0">
                <div>
                  <h3
                    id="batch-upload-title"
                    className="text-[17px] font-semibold tracking-tight text-slate-900"
                  >
                    Upload Contacts
                  </h3>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    CSV, XLS, or XLSX with columns for company and contact name.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={close}
                  disabled={pending}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
                {/* Success state */}
                {result ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 mb-3" strokeWidth={2} aria-hidden />
                    <div className="text-[17px] font-semibold text-slate-900">Import Complete</div>
                    <div className="text-[14px] text-slate-600 mt-3 space-y-1">
                      <div><strong className="text-slate-900">{result.customersCreated}</strong> new customers created</div>
                      <div><strong className="text-slate-900">{result.customersMatched}</strong> existing customers updated</div>
                      <div><strong className="text-slate-900">{result.contactsAppended}</strong> contacts added</div>
                      {result.skipped > 0 && (
                        <div className="text-slate-500">{result.skipped} skipped (duplicates)</div>
                      )}
                    </div>
                  </div>
                ) : filename && rows.length > 0 ? (
                  // Preview state
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[13.5px] text-slate-600">
                      <FileSpreadsheet className="w-4 h-4 text-slate-400" aria-hidden />
                      <span className="font-medium text-slate-800 truncate">{filename}</span>
                      <span className="text-slate-400">·</span>
                      <span>{rows.length} {rows.length === 1 ? 'row' : 'rows'} parsed</span>
                    </div>

                    {errorRows.length > 0 && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                        <span>
                          <strong className="font-semibold">{errorRows.length}</strong> row{errorRows.length === 1 ? '' : 's'} will be skipped — see preview below.
                        </span>
                      </div>
                    )}

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-auto max-h-[320px]">
                        <table className="w-full text-[13px]">
                          <thead className="sticky top-0 bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                              <th className="px-3 py-2 text-left font-semibold">Company</th>
                              <th className="px-3 py-2 text-left font-semibold">Contact</th>
                              <th className="px-3 py-2 text-left font-semibold">Email</th>
                              <th className="px-3 py-2 text-left font-semibold">Phone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 100).map((r) => (
                              <tr
                                key={r.rowIndex}
                                className={`border-t border-slate-100 ${r.error ? 'bg-rose-50/60' : 'hover:bg-white'}`}
                              >
                                <td className="px-3 py-2 text-slate-400 tabular-nums">{r.rowIndex}</td>
                                <td className="px-3 py-2 text-slate-800 truncate max-w-[160px]">{r.company || <em className="text-rose-600">missing</em>}</td>
                                <td className="px-3 py-2 text-slate-800 truncate max-w-[140px]">{r.name || <em className="text-rose-600">missing</em>}</td>
                                <td className="px-3 py-2 text-slate-500 truncate max-w-[180px]">{r.email || <span className="text-slate-300">—</span>}</td>
                                <td className="px-3 py-2 text-slate-500 font-mono tabular-nums">{r.phone ? `+${r.dial} ${r.phone}` : <span className="text-slate-300 font-sans">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {rows.length > 100 && (
                        <div className="px-3 py-2 text-[12px] text-slate-500 bg-slate-50 border-t border-slate-200">
                          Showing first 100 of {rows.length} rows. All valid rows will be imported.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Initial upload state
                  <>
                    <div
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onClick={onPick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick(); }}
                      className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all py-12 px-6 text-center ${
                        dragOver
                          ? 'border-amber-400 bg-amber-50/80'
                          : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400'
                      }`}
                    >
                      <Upload
                        className={`w-8 h-8 mx-auto mb-3 ${dragOver ? 'text-amber-600' : 'text-slate-400'}`}
                        strokeWidth={1.8}
                        aria-hidden
                      />
                      <div className="text-[15px] font-medium text-slate-900">
                        {dragOver ? 'Drop to upload' : 'Drag & drop your file here'}
                      </div>
                      <div className="text-[13px] text-slate-500 mt-1">
                        or <span className="text-amber-700 font-medium underline underline-offset-2">browse your computer</span>
                      </div>
                      <div className="text-[11.5px] text-slate-400 mt-3 font-mono">
                        Accepts .csv, .xls, .xlsx
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPT_MIME + ',' + ACCEPTED_EXTENSIONS.join(',')}
                        onChange={onFileInput}
                        className="hidden"
                      />
                    </div>

                    <div className="mt-5 text-[12.5px] text-slate-500 leading-relaxed">
                      <div className="font-semibold text-slate-700 mb-1">Expected columns</div>
                      <ul className="space-y-0.5 pl-1">
                        <li>· <strong>Company</strong> (required) — matches existing customers case-insensitively, or creates a new one</li>
                        <li>· <strong>Contact Name</strong> (required)</li>
                        <li>· <strong>Email</strong>, <strong>Phone</strong>, <strong>Country Code</strong> (optional)</li>
                      </ul>
                    </div>
                  </>
                )}

                {parseError && (
                  <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-900">
                    <span className="font-semibold">Couldn&apos;t read file.</span> {parseError}
                  </div>
                )}
                {submitError && (
                  <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-900">
                    <span className="font-semibold">Import failed.</span> {submitError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0">
                {result ? (
                  <button type="button" onClick={close} className="btn-glass-prominent">
                    Done
                  </button>
                ) : filename ? (
                  <>
                    <button type="button" onClick={reset} disabled={pending} className="btn-glass text-[13.5px]">
                      Choose Different File
                    </button>
                    <button type="button" onClick={onImport} disabled={!canImport} className="btn-glass-prominent">
                      {pending ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                          Importing…
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                          Import {validRows.length} {validRows.length === 1 ? 'Contact' : 'Contacts'}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={close} className="btn-glass text-[13.5px]">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
