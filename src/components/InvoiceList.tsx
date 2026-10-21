"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate, isoToday } from "@/lib/format";
import { formatUSD } from "@/lib/money";
import type { InvoiceSummary } from "@/lib/schema";
import { ConfirmDialog } from "./ConfirmDialog";
import { FileTextIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "./icons";

export function InvoiceList({ initial }: { initial: InvoiceSummary[] }) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<InvoiceSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((i) => i.number.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q));
  }, [invoices, query]);

  const confirmDelete = async () => {
    const inv = pendingDelete;
    if (!inv) return;
    setDeleting(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Couldn't delete ${inv.number}. Try again.`);
      }
      setInvoices((list) => list.filter((i) => i.id !== inv.id));
      router.refresh(); // update the summary stats
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't delete ${inv.number}. Try again.`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="card empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          <FileTextIcon />
        </span>
        <h2>No invoices yet</h2>
        <p className="muted">Create your first invoice. It will show up here once saved.</p>
        <Link href="/invoices/new" className="btn btn--primary">
          <PlusIcon /> Create invoice
        </Link>
      </div>
    );
  }

  return (
    <section className="card table-card" aria-labelledby="all-invoices">
      <div className="table-card__head">
        <h2 id="all-invoices">All invoices</h2>
        <label className="search">
          <span className="sr-only">Search invoices</span>
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by number or customer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <table className="table">
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Customer</th>
            <th scope="col">Issued</th>
            <th scope="col">Due</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((inv) => (
            <tr key={inv.id}>
              <td data-label="Invoice">
                <Link href={`/invoices/${inv.id}`} className="table__link">
                  {inv.number}
                </Link>
              </td>
              <td data-label="Customer">
                <span className="avatar" aria-hidden="true">
                  {initials(inv.customerName)}
                </span>
                {inv.customerName}
              </td>
              <td data-label="Issued">{formatDate(inv.issueDate)}</td>
              <td data-label="Due">
                {formatDate(inv.dueDate)}
                <DueBadge due={inv.dueDate} />
              </td>
              <td data-label="Amount" className="num table__amount">
                {formatUSD(inv.totalCents)}
              </td>
              <td className="table__actions">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="icon-btn"
                  aria-label={`Edit invoice ${inv.number}`}
                  title="Edit"
                >
                  <PencilIcon />
                </Link>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => setPendingDelete(inv)}
                  aria-label={`Delete invoice ${inv.number}`}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="table-card__empty muted">No invoices match “{query}”.</p>}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete invoice ${pendingDelete?.number ?? ""}?`}
        message="This permanently removes the invoice. It can't be undone."
        confirmLabel="Delete invoice"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </section>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Relative due date. There's no "paid" status yet, so this is about the date only. */
function DueBadge({ due }: { due: string }) {
  const days = Math.round((Date.parse(due) - Date.parse(isoToday())) / 86_400_000);
  if (Number.isNaN(days)) return null;
  const [text, tone] =
    days < 0 ? [`${-days}d past due`, "warn"] : days === 0 ? ["Due today", "warn"] : [`in ${days}d`, "neutral"];
  return (
    <span className={`badge badge--${tone}`} suppressHydrationWarning>
      {text}
    </span>
  );
}
