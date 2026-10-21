import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { getInvoice } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const invoice = await getInvoice((await params).id);
  return { title: invoice ? `${invoice.number} — Folio` : "Invoice not found — Folio" };
}

export default async function InvoicePage({ params }: Props) {
  const invoice = await getInvoice((await params).id);
  if (!invoice) notFound();
  const { id, createdAt: _c, updatedAt, ...input } = invoice;
  return <InvoiceEditor key={id} initial={input} invoiceId={id} updatedAt={updatedAt} />;
}
