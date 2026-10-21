import { InvoiceEditor } from "@/components/InvoiceEditor";
import { newInvoiceInput, nextInvoiceNumber } from "@/lib/defaults";
import { getLatestInvoice, listInvoices } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "New invoice — Folio" };

export default async function NewInvoicePage() {
  const [previous, all] = await Promise.all([getLatestInvoice(), listInvoices()]);
  const number = nextInvoiceNumber(all.map((i) => i.number));
  return <InvoiceEditor initial={newInvoiceInput({ previous, number })} invoiceId={null} updatedAt={null} />;
}
