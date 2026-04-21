'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * PerPage dropdown — navigates to the same page with ?perPage=X&page=1
 * so the server component re-queries with the new pagination. Resets to
 * page 1 because the current page index may not exist at the new size.
 */
export function PerPageSelect({ value }: { value: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    next.set('perPage', e.target.value);
    next.set('page', '1');
    start(() => router.push(`?${next.toString()}`));
  };

  return (
    <div className="inline-flex items-center gap-2 text-[13px] text-slate-600 whitespace-nowrap -ml-5">
      <label htmlFor="perPage">Show</label>
      <select
        id="perPage"
        // w-[80px]: narrow enough that "per page" stays on the same line in
        // the pagination row. The base rule for select.glass-input handles
        // the custom chevron + right padding consistently in Safari/Chrome/FF.
        className="glass-input py-1 pl-3 text-[13px] w-[80px]"
        value={value}
        onChange={onChange}
        disabled={pending}
      >
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <span>per page</span>
    </div>
  );
}
