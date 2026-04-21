import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, User as UserIcon, FolderPlus } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { NewProjectModal } from '@/components/NewProjectModal';
import { AddContactModal } from '@/components/AddContactModal';
import { formatFormula } from '@/lib/format';

const STATUS_STYLE: Record<string, string> = {
  DRAFT:        'glass-chip',
  SENT:         'glass-chip glass-tinted-slate',
  ENGINEERING:  'glass-chip glass-tinted-amber',
  BUILDING:     'glass-chip bg-sky-100/70 text-sky-900 border-sky-300/50',
  WON:          'glass-chip glass-tinted-emerald',
  LOST:         'glass-chip bg-rose-100/70 text-rose-900 border-rose-300/50',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ENGINEERING: 'Engineering',
  BUILDING: 'Building',
  WON: 'Won',
  LOST: 'Lost',
};

type Contact = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as any;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: 'desc' },
        include: {
          quotes: {
            orderBy: { updatedAt: 'desc' },
            include: {
              revisions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { label: true },
              },
            },
          },
        },
      },
    },
  });
  if (!customer || customer.tenantId !== user.tenantId) notFound();

  // Normalize contacts: prefer the JSON `contacts` array, fall back to legacy
  // primary-contact fields so older rows still render.
  const rawContacts = Array.isArray((customer as any).contacts)
    ? ((customer as any).contacts as Contact[])
    : [];
  const contacts: Contact[] = rawContacts.length > 0
    ? rawContacts
    : customer.contactName
      ? [{
          name: customer.contactName,
          email: customer.contactEmail,
          phone: customer.contactPhone,
        }]
      : [];

  const totalQuotes = customer.projects.reduce((sum, p) => sum + p.quotes.length, 0);

  return (
    <div className="space-y-8">
      {/* Back + title header */}
      <header>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to Customers
        </Link>

        <div className="flex items-end justify-between gap-4 flex-wrap mt-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
              {customer.name}
            </h1>
            <p className="text-[14px] text-slate-500 mt-1">
              <strong className="text-slate-700">{contacts.length}</strong>
              {' '}contact{contacts.length === 1 ? '' : 's'}{' · '}
              <strong className="text-slate-700">{customer.projects.length}</strong>
              {' '}project{customer.projects.length === 1 ? '' : 's'}{' · '}
              <strong className="text-slate-700">{totalQuotes}</strong>
              {' '}quote{totalQuotes === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <AddContactModal customerId={customer.id} customerName={customer.name} />
            <NewProjectModal customerId={customer.id} customerName={customer.name} />
          </div>
        </div>
      </header>

      {/* Contacts */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-slate-500 mb-3">
          Contacts
        </h2>
        {contacts.length === 0 ? (
          <div className="bg-white/85 border border-slate-200/60 rounded-2xl p-6 text-[13.5px] text-slate-500 text-center"
               style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}>
            No contacts on file.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((c, idx) => (
              <ContactCard key={idx} contact={c} primary={idx === 0} />
            ))}
          </div>
        )}
      </section>

      {/* Projects */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-slate-500 mb-3">
          Projects
        </h2>
        {customer.projects.length === 0 ? (
          <div className="bg-white/85 border border-slate-200/60 rounded-2xl p-8 text-center"
               style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}>
            <FolderPlus className="w-7 h-7 text-slate-400 mx-auto mb-3" aria-hidden />
            <div className="text-[15px] font-semibold text-slate-900">No Projects Yet</div>
            <p className="text-[13px] text-slate-500 mt-1 mb-4">
              Start with the first project for {customer.name}.
            </p>
            <div className="inline-flex">
              <NewProjectModal customerId={customer.id} customerName={customer.name} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customer.projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={{
                  id: p.id,
                  name: p.name,
                  siteAddress: p.siteAddress,
                  endUse: p.endUse,
                  needByDate: p.needByDate,
                  createdAt: p.createdAt,
                  quotes: p.quotes.map((q) => ({
                    id: q.id,
                    number: q.number,
                    status: q.status,
                    revLabel: q.revisions[0]?.label ?? null,
                  })),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Small contact card — name, email (mailto), phone (tel), primary badge. */
function ContactCard({ contact, primary }: { contact: Contact; primary: boolean }) {
  return (
    <div
      className="bg-white/90 border border-slate-200/70 rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.04), 0 10px 30px -16px rgba(15,23,42,0.15)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <UserIcon className="w-5 h-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-semibold text-slate-900 truncate">
              {contact.name}
            </div>
            {primary && (
              <span className="glass-chip glass-tinted-amber text-[10.5px]">Primary</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[13px]">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-slate-600 hover:text-amber-700 transition-colors group"
          >
            <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" aria-hidden />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Mail className="w-3.5 h-3.5" aria-hidden />
            <span>No email</span>
          </div>
        )}
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-slate-600 hover:text-amber-700 transition-colors group"
          >
            <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" aria-hidden />
            <span className="font-mono tabular-nums">{contact.phone}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Phone className="w-3.5 h-3.5" aria-hidden />
            <span>No phone</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Project card — summary + up to 3 quotes inline + "Open Project" action. */
function ProjectCard({
  project,
}: {
  project: {
    id: string;
    name: string;
    siteAddress: string | null;
    endUse: string | null;
    needByDate: Date | null;
    createdAt: Date;
    quotes: Array<{ id: string; number: string; status: string; revLabel: string | null }>;
  };
}) {
  const MAX_QUOTES = 3;
  const visible = project.quotes.slice(0, MAX_QUOTES);
  const remaining = Math.max(0, project.quotes.length - MAX_QUOTES);

  return (
    <div
      className="bg-white/90 border border-slate-200/70 rounded-2xl p-5 flex flex-col transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.04), 0 10px 30px -16px rgba(15,23,42,0.15)' }}
    >
      <Link
        href={`/projects/${project.id}`}
        className="block"
      >
        <div className="text-[15.5px] font-semibold text-slate-900 hover:text-amber-700 transition-colors">
          {formatFormula(project.name)}
        </div>
      </Link>

      <div className="mt-2 space-y-1 text-[12.5px] text-slate-500">
        {project.siteAddress && (
          <div className="truncate" title={project.siteAddress}>
            <span className="font-semibold text-slate-600">Site:</span> {project.siteAddress}
          </div>
        )}
        {project.endUse && (
          <div className="truncate" title={project.endUse}>
            <span className="font-semibold text-slate-600">End use:</span> {formatFormula(project.endUse)}
          </div>
        )}
        {project.needByDate && (
          <div>
            <span className="font-semibold text-slate-600">Need by:</span>{' '}
            {new Date(project.needByDate).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-1.5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10.5px] font-semibold tracking-widest uppercase text-slate-500">
            Quotes
          </span>
          <span className="text-[11px] text-slate-400">
            {project.quotes.length === 0 ? '—' : `${project.quotes.length} total`}
          </span>
        </div>
        {project.quotes.length === 0 ? (
          <div className="text-[12.5px] text-slate-400">No quotes yet.</div>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3">
                {q.revLabel ? (
                  <Link
                    href={`/quotes/${q.id}/rev/${q.revLabel}/review`}
                    className="font-mono tabular-nums text-[12.5px] text-slate-700 hover:text-amber-700 truncate"
                  >
                    {q.number}
                  </Link>
                ) : (
                  <span className="font-mono tabular-nums text-[12.5px] text-slate-700 truncate">
                    {q.number}
                  </span>
                )}
                <span className={`${STATUS_STYLE[q.status] ?? 'glass-chip'} text-[10.5px] shrink-0`}>
                  {STATUS_LABEL[q.status] ?? q.status}
                </span>
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-[11.5px] text-slate-400 pt-1">
                +{remaining} more
              </li>
            )}
          </ul>
        )}
      </div>

      {/* mt-auto pushes the Open Project row to the bottom of the card so
          footers line up across the grid regardless of metadata/quote counts. */}
      <div className="mt-auto pt-4 border-t border-slate-200/80">
        <Link
          href={`/projects/${project.id}`}
          className="text-[13px] font-medium text-amber-700 hover:text-amber-900"
        >
          Open Project →
        </Link>
      </div>
    </div>
  );
}
