'use client';

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { saveRecipientForQuote } from '@/lib/actions/send';
import { formatPhone } from '@/lib/phone';

/**
 * RecipientForm — final step of the configurator. Editable recipient and
 * project info, pre-populated from the current Customer + Project records.
 *
 * On "Save & Send Quote" the form:
 *   1. Calls the server action to persist any edits to Customer / Project.
 *   2. Kicks off the quote PDF download. Server replies with
 *      `Content-Disposition: attachment`, which tells every modern browser
 *      to save rather than navigate — so the current page stays put.
 *   3. Opens the mail client with a pre-filled draft (with a timed delay
 *      after the download fires — see `openMailto` comments).
 *
 * `mailto:` per RFC 6068 cannot carry attachments, so the PDF has to ride
 * along as a downloaded file the rep attaches manually. The body includes
 * a reminder line above the signature so that step isn't forgotten.
 */

/**
 * Kick off a PDF download that works in Chrome, Firefox, and Safari —
 * including after async work (server actions) has consumed the user-
 * gesture activation window.
 *
 * Two techniques in parallel:
 *  1. Programmatic anchor click with `download` attribute.
 *     Primary path. Works everywhere the server sends
 *     `Content-Disposition: attachment`. Does NOT navigate the current
 *     document — the response is saved to disk directly.
 *  2. Hidden iframe pointing at the same URL.
 *     Safari fallback. Older WebKit ignores `download` on programmatic
 *     clicks that happen outside the immediate user-gesture window, but
 *     it always honors `Content-Disposition: attachment` on an iframe
 *     navigation. Modern browsers coalesce the request and only a single
 *     download surfaces to the user.
 *
 * The iframe is removed after the download has had time to commit — too
 * early and Safari cancels before the file finishes landing.
 */
function triggerPdfDownload(url: string, filename: string) {
  // 1. Anchor click. Element must be in the DOM for Safari to honor it.
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // 2. Iframe fallback. Offscreen, zero-dim, src set last so the load
  //    starts only after it's attached.
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  document.body.appendChild(iframe);
  iframe.src = url;
  setTimeout(() => iframe.remove(), 15_000);
}

export function RecipientForm({
  customerId,
  customerName,
  projectId,
  initial,
  quoteNumber,
  quoteId,
  revLabel,
  mailtoBody,
}: {
  customerId: string;
  customerName: string;
  projectId: string | null;
  initial: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    projectName: string;
    siteAddress: string;
    description: string;
  };
  quoteNumber: string;
  quoteId: string;
  revLabel: string;
  mailtoBody: string;
}) {
  const [contactName,  setContactName]  = useState(initial.contactName);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [projectName,  setProjectName]  = useState(initial.projectName);
  const [siteAddress,  setSiteAddress]  = useState(initial.siteAddress);
  const [description,  setDescription]  = useState(initial.description);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const openMailto = () => {
    const subject = `Quote ${quoteNumber} – ${customerName}`;
    const attachReminder =
      `Please find the attached quote PDF (PTI-${quoteNumber}-Rev${revLabel}.pdf). ` +
      `If it didn't auto-attach, it's saved in your Downloads folder.`;
    const body = mailtoBody
      .replace(/^Hi [^,]+,/m, `Hi ${contactName || customerName},`)
      .replace(/^Site: .*$/m, siteAddress ? `Site: ${siteAddress}` : '')
      .replace(/Thank you for the opportunity to quote the [^]+? project/m,
               `Thank you for the opportunity to quote the ${projectName || '(your)'} project`)
      // Insert the attach-reminder above the "Regards," signature block so
      // the rep sees it while reviewing the draft.
      .replace(/\n\nRegards,/m, `\n\n${attachReminder}\n\nRegards,`);
    const url = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);

    // We intentionally do NOT wrap this in React's `useTransition` — the
    // transition scheduler defers follow-up work outside the current task,
    // which in Safari causes the download-trigger click to lose its
    // user-gesture activation and silently no-op. Plain async/await keeps
    // the microtask chain tight enough for WebKit's transient-activation
    // window (≈5s) to cover save → download → mailto.
    try {
      await saveRecipientForQuote(formData);

      const pdfUrl = `/quotes/${quoteId}/rev/${revLabel}/quote.pdf`;
      const filename = `PTI-${quoteNumber}-Rev${revLabel}.pdf`;
      triggerPdfDownload(pdfUrl, filename);

      setSaved(true);

      // Hold the mailto until the download response has had a moment to
      // commit. `window.location.href = 'mailto:…'` is treated as an
      // external-protocol navigation and can cancel still-pending same-
      // origin fetches. 800ms is a safe floor — cold-start PDF renders
      // measure ~1.5s the first time, but the browser's fetch has already
      // been dispatched well before that.
      setTimeout(openMailto, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setPending(false);
    }
  };

  const canSubmit = contactEmail.trim().length > 0 && !pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="customerId" value={customerId} />
      {projectId && <input type="hidden" name="projectId" value={projectId} />}

      {/* Recipient */}
      <section>
        <h3 className="section-head">Recipient</h3>
        <div className="mb-4 text-[13px] text-slate-500">
          Customer: <span className="font-medium text-slate-800">{customerName}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contactName" className="glass-label">Contact Name</label>
            <input
              id="contactName"
              name="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jane Doe"
              className="glass-input"
            />
          </div>
          <div>
            <label htmlFor="contactEmail" className="glass-label">Contact Email</label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="jane@acme.com"
              className="glass-input"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="contactPhone" className="glass-label">Contact Phone</label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              onBlur={(e) => setContactPhone(formatPhone(e.target.value))}
              placeholder="+1-555-123-4567"
              className="glass-input font-mono tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Project */}
      {projectId ? (
        <section>
          <h3 className="section-head">Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label htmlFor="projectName" className="glass-label">Project Name</label>
              <input
                id="projectName"
                name="projectName"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="glass-input"
              />
            </div>
            <div>
              <label htmlFor="siteAddress" className="glass-label">Site Address</label>
              <input
                id="siteAddress"
                name="siteAddress"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                placeholder="123 Industrial Pkwy, Fairfield OH"
                className="glass-input"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="glass-label">Description</label>
              <textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Short context — scope, drivers, relevant background."
                className="glass-input resize-none block"
                style={{ minHeight: '64px', lineHeight: 1.5 }}
              />
            </div>
          </div>
        </section>
      ) : (
        <section>
          <h3 className="section-head">Project</h3>
          <p className="text-[13.5px] text-slate-500">
            This quote isn&apos;t attached to a project. You can still send it as-is,
            or attach a project later from the quote detail page.
          </p>
        </section>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-900">
          <span className="font-semibold">Couldn&apos;t save.</span> {error}
        </div>
      )}
      {saved && !error && (
        <div className="flex items-start gap-2 text-[13px] text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" aria-hidden />
          <div>
            <div>Saved — quote PDF downloaded to your Downloads folder.</div>
            <div className="text-emerald-800/80 text-[12.5px] mt-0.5">
              Your mail client should now be open with the draft ready. Attach the PDF before sending — <code className="text-[11.5px]">mailto:</code> links cannot carry attachments.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button type="submit" className="btn-glass-prominent" disabled={!canSubmit}>
          {pending ? (
            <>
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              Save &amp; Send Quote
            </>
          )}
        </button>
      </div>
    </form>
  );
}
