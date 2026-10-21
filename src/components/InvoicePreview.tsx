import type { CSSProperties } from "react";
import type { DraftInvoice } from "@/lib/draft";
import { formatUSD, parseMoney, type Totals } from "@/lib/money";
import { formatDate, formatQuantity } from "@/lib/format";
import { ACCENTS, DEFAULT_ACCENT } from "@/lib/schema";

/**
 * The invoice "paper". Pure render of the draft, so it updates on every
 * keystroke and is the only thing that shows up when printing.
 * Hidden custom fields are never rendered here.
 */
export function InvoicePreview({ draft, totals }: { draft: DraftInvoice; totals: Totals }) {
  const accent = ACCENTS[draft.accent]?.color ?? ACCENTS[DEFAULT_ACCENT].color;
  const visibleFields = draft.customFields.filter((f) => f.visible && f.label.trim());
  const { business, customer } = draft;
  const taxLabel = draft.taxRate.trim() ? `${draft.taxRate.trim()}%` : "0%";

  return (
    <article className="paper" style={{ "--inv-accent": accent } as CSSProperties} aria-label="Invoice preview">
      <header className="paper__head">
        <div className="paper__brand">
          <span className="paper__mono" aria-hidden="true">
            {monogram(business.name)}
          </span>
          <div>
            <p className="paper__biz">{business.name || "Your business"}</p>
            <Lines text={business.address} className="paper__sub" />
          </div>
        </div>
        <div className="paper__title">
          <h2>Invoice</h2>
          <p className="paper__number">
            <span className="sr-only">Number </span># {draft.number || "—"}
          </p>
        </div>
      </header>

      <section className="paper__info">
        <div className="paper__cell">
          <p className="paper__eyebrow">Billed to</p>
          <p className="paper__strong">{customer.name || <span className="paper__muted">Customer name</span>}</p>
          <Lines text={customer.address} />
          {customer.email && <p>{customer.email}</p>}
          {customer.phone && <p>{customer.phone}</p>}
        </div>
        <div className="paper__cell">
          <p className="paper__eyebrow">From</p>
          <p className="paper__strong">{business.name || "—"}</p>
          {business.email && <p>{business.email}</p>}
          {business.phone && <p>{business.phone}</p>}
        </div>
        <dl className="paper__cell paper__dates">
          <div>
            <dt className="paper__eyebrow">Issue date</dt>
            <dd>{formatDate(draft.issueDate)}</dd>
          </div>
          <div>
            <dt className="paper__eyebrow">Due date</dt>
            <dd>{formatDate(draft.dueDate)}</dd>
          </div>
        </dl>
      </section>

      {visibleFields.length > 0 && (
        <dl className="paper__fields">
          {visibleFields.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd>{f.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      <table className="paper__items">
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col" className="num">
              Qty
            </th>
            <th scope="col" className="num">
              Unit price
            </th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {draft.lineItems.map((l, i) => (
            <tr key={l.id}>
              <td>{l.description || <span className="paper__muted">Untitled item</span>}</td>
              <td className="num">{formatQuantity(l.quantity)}</td>
              <td className="num">{formatUSD(priceCents(l.unitPrice))}</td>
              <td className="num paper__amount">{formatUSD(totals.lineTotals[i] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="paper__bottom">
        <div className="paper__notes">
          {draft.notes.trim() && (
            <>
              <p className="paper__eyebrow">Notes</p>
              <Lines text={draft.notes} />
            </>
          )}
        </div>
        <dl className="paper__totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatUSD(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>−{formatUSD(totals.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Tax ({taxLabel})</dt>
            <dd>{formatUSD(totals.tax)}</dd>
          </div>
          <div className="paper__grand">
            <dt>Total due (USD)</dt>
            <dd>{formatUSD(totals.total)}</dd>
          </div>
        </dl>
      </div>

      <footer className="paper__foot">
        <span>Thank you for your business.</span>
        <span>{[business.name, business.email, business.phone].filter(Boolean).join("  ·  ")}</span>
      </footer>
    </article>
  );
}

function Lines({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <p className={className}>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "—"
  );
}

function priceCents(raw: string): number {
  const parsed = parseMoney(raw);
  return parsed.ok ? parsed.value : 0;
}
