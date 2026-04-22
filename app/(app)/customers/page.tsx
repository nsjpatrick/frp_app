import Link from 'next/link';
import { listCustomers } from '@/lib/actions/customers';
import { NewCustomerModal } from '@/components/NewCustomerModal';
import { formatPhone } from '@/lib/format';

export default async function Customers() {
  const customers = await listCustomers();

  return (
    // Fit the page inside the viewport so only the table scrolls.
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 8rem)' }}>
      <header className="flex items-end justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="text-[14px] text-slate-500 mt-0.5">
            All buyers with active or historical quotes.
          </p>
        </div>
        <NewCustomerModal />
      </header>

      {customers.length === 0 ? (
        <div className="glass p-12 text-center">
          <div className="text-4xl mb-3" aria-hidden>🏭</div>
          <div className="text-[16px] font-semibold text-slate-900">No Customers Yet</div>
          <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-md mx-auto">
            Add your first customer to start quoting.
          </p>
          <div className="mt-5 inline-flex">
            <NewCustomerModal />
          </div>
        </div>
      ) : (
        <div className="glass flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-[14px]">
              {/* Opaque sticky thead — avoids nested backdrop-filter in Safari. */}
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                  <th className="px-5 py-3 font-semibold">Company</th>
                  <th className="px-5 py-3 font-semibold">Primary Contact</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Projects</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const allContacts: any[] = Array.isArray((c as any).contacts)
                    ? (c as any).contacts
                    : c.contactName
                      ? [{ name: c.contactName, email: c.contactEmail, phone: c.contactPhone }]
                      : [];
                  const extraCount = Math.max(0, allContacts.length - 1);

                  return (
                    <tr
                      key={c.id}
                      className="border-t border-slate-200/40 hover:bg-white/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-medium text-slate-900 hover:text-amber-700"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-800">
                        {c.contactName ? (
                          c.contactEmail ? (
                            // Hyperlinked contact name → mailto using the contact's email.
                            <a
                              href={`mailto:${c.contactEmail}`}
                              className="text-amber-700 hover:text-amber-900 hover:underline underline-offset-2"
                            >
                              {c.contactName}
                            </a>
                          ) : (
                            <span>{c.contactName}</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {extraCount > 0 && (
                          <span className="ml-2 text-[11px] text-slate-500">
                            +{extraCount} more
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[13px]">
                        {c.contactEmail ? (
                          <a
                            href={`mailto:${c.contactEmail}`}
                            className="hover:text-amber-700"
                          >
                            {c.contactEmail}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[13px] font-mono tabular-nums">
                        {c.contactPhone ? (
                          formatPhone(c.contactPhone)
                        ) : (
                          <span className="text-slate-400 font-sans">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-[13px]">
                        {c.projects.length}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/customers/${c.id}`}
                          className="text-amber-700 hover:text-amber-900 text-[13px] font-medium whitespace-nowrap"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-200/60 bg-white/50">
            <div className="text-[13px] text-slate-500">
              <strong className="text-slate-800">{customers.length}</strong>
              {' '}customer{customers.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
