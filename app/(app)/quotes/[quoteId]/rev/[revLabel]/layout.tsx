import type { Metadata } from 'next';
import { db } from '@/lib/db';

/**
 * Quote-configurator layout. Only responsibility right now: stamp the
 * browser tab title with the quote number (plus rev label) so a rep can
 * tell their open wizards apart in the tab list. Shared across every
 * step page so we don't duplicate `generateMetadata` five times.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ quoteId: string; revLabel: string }>;
}): Promise<Metadata> {
  const { quoteId, revLabel } = await params;
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { number: true },
  });
  return {
    title: quote
      ? `${quote.number} · Rev ${revLabel} | JobCalc Neo`
      : 'Quote | JobCalc Neo',
  };
}

export default function RevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
