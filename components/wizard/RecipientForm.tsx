'use client';

import { useState, useTransition } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { saveRecipientForQuote } from '@/lib/actions/send';
import { formatPhone } from '@/lib/phone';

/**
 * RecipientForm — final step of the configurator. Editable recipient and
 * project info, pre-populated from the current Customer + Project records.
 *
 * On "Save & Send Quote" the form first calls the server action to persist
 * any edits to Customer / Project, then opens the mail client with a
 * pre-filled draft (same body the SendQuoteButton used to build). Keeping
 * the mailto client-side means no emails leave the app without the rep
 * explicitly choosing to send.
 */

export function RecipientForm({
  customerId,
  customerName,
  projectId,
  initial,
  quoteNumber,
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
  const [pending, startTransition] = useTransition();

  const openMailto = () => {
    const subject = `Quote ${quoteNumber} – ${customerName}`;
    const body = mailtoBody
      .replace(/^Hi [^,]+,/m, `Hi ${contactName || customerName},`)
      .replace(/^Site: .*$/m, siteAddress ? `Site: ${siteAddress}` : '')
      .replace(/Thank you for the opportunity to quote the [^]+? project/m,
               `Thank you for the opportunity to quote the ${projectName || '(your)'} project`);
    const url = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await saveRecipientForQuote(formData);
        setSaved(true);
        openMailto();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save.');
      }
    });
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
        <div className="flex items-center gap-2 text-[13px] text-emerald-700">
          <CheckCircle2 className="w-4 h-4" aria-hidden />
          Saved — draft opening in your mail client.
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
