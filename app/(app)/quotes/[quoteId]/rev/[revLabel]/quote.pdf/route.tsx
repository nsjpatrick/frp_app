import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildQuotePdfData } from '@/lib/outputs/quote-pdf-data';
import { QuotePdfDocument } from '@/lib/outputs/QuotePdfDocument';
import { renderToStream } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';

// react-pdf uses Node-only APIs (fs, path, Buffer). Turbopack/Edge would
// reject it — pin this route to the Node runtime.
export const runtime = 'nodejs';
// Prevent static optimization; the PDF is always a fresh render of live data.
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ quoteId: string; revLabel: string }> },
) {
  const { quoteId, revLabel } = await params;
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode'); // 'inline' opens in-browser, default downloads

  const session = await auth();
  const user = session.user;

  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true, project: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) {
    return new NextResponse('Not found', { status: 404 });
  }

  const data = buildQuotePdfData({
    quote: {
      number: rev.quote.number,
      totalPrice: rev.quote.totalPrice ?? null,
      createdAt: rev.quote.createdAt,
      customer: {
        name: rev.quote.customer.name,
        contactName: rev.quote.customer.contactName ?? null,
        contactEmail: rev.quote.customer.contactEmail ?? null,
        contactPhone: rev.quote.customer.contactPhone ?? null,
        addressLine1: rev.quote.customer.addressLine1 ?? null,
        addressLine2: rev.quote.customer.addressLine2 ?? null,
        city:         rev.quote.customer.city         ?? null,
        region:       rev.quote.customer.region       ?? null,
        postalCode:   rev.quote.customer.postalCode   ?? null,
        country:      rev.quote.customer.country      ?? null,
      },
      project: rev.quote.project
        ? {
            name: rev.quote.project.name,
            siteAddress: rev.quote.project.siteAddress ?? null,
            customerProjectNumber: rev.quote.project.customerProjectNumber ?? null,
          }
        : null,
    },
    revision: {
      label: rev.label,
      service: rev.service,
      site: rev.site,
      certs: rev.certs,
      geometry: rev.geometry,
      wallBuildup: rev.wallBuildup,
    },
    salesRep: {
      name: user.name ?? 'Sales, Plas-Tanks Industries',
      email: user.email,
      phone: '513-874-5047',
    },
  });

  // renderToStream returns a Node Readable. Convert to a Web ReadableStream
  // so NextResponse can pass it through without buffering the whole PDF in
  // memory on the server.
  const nodeStream = await renderToStream(<QuotePdfDocument data={data} />);
  const webStream = nodeToWebStream(nodeStream);

  const filename = `PTI-${rev.quote.number}-Rev${rev.label}.pdf`;
  const disposition = mode === 'inline' ? 'inline' : 'attachment';

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/pdf',
      // `filename*=UTF-8''…` is the RFC 5987 form modern browsers prefer
      // over the plain `filename=` fallback, so quote numbers with spaces
      // or non-ASCII characters save cleanly in every browser.
      'Content-Disposition': `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      // Safari (and some corporate proxies) occasionally sniff PDF bytes
      // and render inline in an iframe even when Content-Disposition says
      // attachment. `nosniff` forces the header to be respected verbatim.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function nodeToWebStream(node: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on('data', (chunk: Buffer | string) => {
        controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
      });
      node.on('end', () => controller.close());
      node.on('error', (err) => controller.error(err));
    },
    cancel() {
      (node as any).destroy?.();
    },
  });
}
