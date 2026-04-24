'use client';

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { saveRecipientForQuote } from '@/lib/actions/send';
import { formatPhone } from '@/lib/phone';

/**
 * RecipientForm — final step of the configurator. Editable recipient and
 * project info, pre-populated from the current Customer + Project records.
 *
 * On "Send Quote" the form:
 *   1. Calls the server action to persist any edits to Customer / Project.
 *   2. Opens the mail client with a pre-filled draft.
 *
 * The PDF is NOT attached — `mailto:` per RFC 6068 can't carry
 * attachments, and the download-then-attach-reminder workaround we used
 * to run was more noise than help. Reps download the PDF separately from
 * the quote detail page (or from the Review step's preview link) and
 * attach it to the draft themselves if they want to ship the formal
 * document. The mailto body is a plain-text summary that stands on its
 * own for quick sends.
 */

export type ProjectOption = {
  id: string;
  name: string;
  siteAddress: string | null;
};

export function RecipientForm({
  customerId,
  customerName,
  projectId,
  availableProjects,
  initial,
  quoteNumber,
  quoteId,
  revLabel,
  mailtoBody,
}: {
  customerId: string;
  customerName: string;
  projectId: string | null;
  /** Every project under this customer — feeds the "Attach to project" picker. */
  availableProjects: ProjectOption[];
  initial: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    projectName: string;
    siteAddress: string;
    description: string;
    // Company-wide address (billing / default), pre-loaded from Customer.
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  quoteNumber: string;
  quoteId: string;
  revLabel: string;
  mailtoBody: string;
}) {
  const [contactName,  setContactName]  = useState(initial.contactName);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [addressLine1, setAddressLine1] = useState(initial.addressLine1);
  const [addressLine2, setAddressLine2] = useState(initial.addressLine2);
  const [city,         setCity]         = useState(initial.city);
  const [region,       setRegion]       = useState(initial.region);
  const [postalCode,   setPostalCode]   = useState(initial.postalCode);
  const [country,      setCountry]      = useState(initial.country);
  const [projectName,  setProjectName]  = useState(initial.projectName);
  const [siteAddress,  setSiteAddress]  = useState(initial.siteAddress);
  const [description,  setDescription]  = useState(initial.description);

  // Project-linkage control. `keep` reuses the currently attached project
  // and lets the rep edit its fields in place. `attach` switches to a
  // different existing project. `create` spins up a new one inline.
  // `detach` drops the attachment for projectless quotes.
  type ProjectMode = 'keep' | 'attach' | 'create' | 'detach';
  const [projectMode, setProjectMode] = useState<ProjectMode>(
    projectId ? 'keep' : (availableProjects.length > 0 ? 'attach' : 'create'),
  );
  const [attachTargetId, setAttachTargetId] = useState<string>(
    availableProjects[0]?.id ?? '',
  );
  const [newProjectName,        setNewProjectName]        = useState('');
  const [newProjectSite,        setNewProjectSite]        = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);

    try {
      await saveRecipientForQuote(formData);
      setSaved(true);
      openMailto();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setPending(false);
    }
  };

  const canSubmit =
    contactEmail.trim().length > 0 &&
    !pending &&
    (projectMode !== 'create' || newProjectName.trim().length > 0) &&
    (projectMode !== 'attach' || attachTargetId.length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="projectMode" value={projectMode} />
      {projectMode === 'attach' && (
        <input type="hidden" name="projectId" value={attachTargetId} />
      )}

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

        {/* Company address (optional, loaded from Customer when present) */}
        <div className="mt-5">
          <div className="glass-label mb-2">Company Address <span className="text-slate-400 font-normal normal-case tracking-normal">· optional</span></div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              className="glass-input md:col-span-4"
              name="addressLine1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Street address"
              aria-label="Address line 1"
            />
            <input
              className="glass-input md:col-span-2"
              name="addressLine2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Suite / Unit"
              aria-label="Address line 2"
            />
            <input
              className="glass-input md:col-span-2"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              aria-label="City"
            />
            <input
              className="glass-input md:col-span-1"
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="State / Region"
              aria-label="State or region"
            />
            <input
              className="glass-input md:col-span-1"
              name="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="Postal"
              aria-label="Postal code"
            />
            <input
              className="glass-input md:col-span-2"
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              aria-label="Country"
            />
          </div>
        </div>
      </section>

      {/* Project */}
      <section>
        <h3 className="section-head">Project</h3>

        {/* Mode picker — radio-like pill row. Only shows the modes that
            make sense given the current quote state (no "Keep" if there's
            nothing to keep; no "Attach" if this customer has no projects). */}
        <div className="flex flex-wrap gap-2 mb-4">
          {projectId && (
            <ModePill
              active={projectMode === 'keep'}
              onClick={() => setProjectMode('keep')}
              label="Keep current project"
            />
          )}
          {availableProjects.length > 0 && (
            <ModePill
              active={projectMode === 'attach'}
              onClick={() => setProjectMode('attach')}
              label={projectId ? 'Attach to different project' : 'Attach to existing project'}
            />
          )}
          <ModePill
            active={projectMode === 'create'}
            onClick={() => setProjectMode('create')}
            label="Create new project"
          />
          <ModePill
            active={projectMode === 'detach'}
            onClick={() => setProjectMode('detach')}
            label="No project"
          />
        </div>

        {projectMode === 'keep' && projectId && (
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
        )}

        {projectMode === 'attach' && (
          <div>
            <label htmlFor="attachTargetId" className="glass-label">Existing Project</label>
            <select
              id="attachTargetId"
              value={attachTargetId}
              onChange={(e) => setAttachTargetId(e.target.value)}
              className="glass-input"
            >
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.siteAddress ? ` · ${p.siteAddress}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[12.5px] text-slate-500 mt-2">
              This quote will be reassigned to the selected project when you send.
            </p>
          </div>
        )}

        {projectMode === 'create' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label htmlFor="newProjectName" className="glass-label">Project Name</label>
              <input
                id="newProjectName"
                name="newProjectName"
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Plant 3 Upgrade"
                className="glass-input"
              />
            </div>
            <div>
              <label htmlFor="newProjectSite" className="glass-label">Site Address</label>
              <input
                id="newProjectSite"
                name="newProjectSite"
                value={newProjectSite}
                onChange={(e) => setNewProjectSite(e.target.value)}
                placeholder="123 Industrial Pkwy, Fairfield OH"
                className="glass-input"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="newProjectDescription" className="glass-label">Description</label>
              <textarea
                id="newProjectDescription"
                name="newProjectDescription"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                rows={2}
                placeholder="Short context — scope, drivers, relevant background."
                className="glass-input resize-none block"
                style={{ minHeight: '64px', lineHeight: 1.5 }}
              />
            </div>
          </div>
        )}

        {projectMode === 'detach' && (
          <p className="text-[13.5px] text-slate-500">
            This quote will be sent without a project attached. You can link one
            later from the quote detail page.
          </p>
        )}
      </section>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-900">
          <span className="font-semibold">Couldn&apos;t save.</span> {error}
        </div>
      )}
      {saved && !error && (
        <div className="flex items-start gap-2 text-[13px] text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" aria-hidden />
          <div>
            <div>Saved — mail draft opening in your default client.</div>
            <div className="text-emerald-800/80 text-[12.5px] mt-0.5">
              Need the formal PDF? Grab it from the quote detail page and attach it to the draft before sending.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button type="submit" className="btn-glass-prominent" disabled={!canSubmit}>
          {pending ? (
            <>
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              Send Quote
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/**
 * Pill-style toggle for the project-linkage mode picker. Visual parity
 * with the rest of the wizard's toggle-pill pattern, but renders as a
 * <button> so it can be in a form without stealing submit.
 */
function ModePill({
  active, onClick, label,
}: {
  active: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-amber-100 text-amber-800 border border-amber-300/60'
          : 'px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-white/70 text-slate-700 border border-slate-200/70 hover:bg-white'
      }
    >
      {label}
    </button>
  );
}
