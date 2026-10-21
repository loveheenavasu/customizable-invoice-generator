import Link from "next/link";
import { InvoiceList } from "@/components/InvoiceList";
import { SavedToast } from "@/components/Toast";
import { PlusIcon } from "@/components/icons";
import { formatUSD } from "@/lib/money";
import { listInvoices } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const invoices = await listInvoices();
  const total = invoices.reduce((sum, i) => sum + i.totalCents, 0);
  const average = invoices.length ? Math.round(total / invoices.length) : 0;
  const customers = new Set(invoices.map((i) => i.customerName.trim().toLowerCase())).size;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Create, save, print and email invoices.</p>
        </div>
        <Link href="/invoices/new" className="btn btn--primary">
          <PlusIcon /> New invoice
        </Link>
      </header>

      <section className="stats" aria-label="Summary">
        <Stat label="Total invoiced" value={formatUSD(total)} />
        <Stat label="Invoices" value={String(invoices.length)} />
        <Stat label="Average invoice" value={formatUSD(average)} />
        <Stat label="Customers" value={String(customers)} />
      </section>

      <InvoiceList initial={invoices} />
      <SavedToast invoiceNumber={saved ?? null} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
    </div>
  );
}
