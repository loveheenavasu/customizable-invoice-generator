import { calculateTotals } from "../money";
import type { Invoice, InvoiceInput, InvoiceSummary } from "../schema";

/**
 * The storage API the app depends on. Two implementations exist:
 * Supabase (Postgres) for real use, and a local JSON file for zero-setup dev.
 */
export interface InvoiceStore {
  list(): Promise<InvoiceSummary[]>;
  get(id: string): Promise<Invoice | null>;
  /** Most recently edited invoice — used to prefill business details. */
  latest(): Promise<Invoice | null>;
  count(): Promise<number>;
  create(input: InvoiceInput): Promise<Invoice>;
  update(id: string, input: InvoiceInput): Promise<Invoice | null>;
  remove(id: string): Promise<boolean>;
}

/** Storage failed in a way the user should hear about (unreachable, unreadable or unwritable). */
export class StorageError extends Error {}

export function toSummary(inv: Invoice): InvoiceSummary {
  return {
    id: inv.id,
    number: inv.number,
    customerName: inv.customer.name,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    totalCents: calculateTotals(inv).total,
    updatedAt: inv.updatedAt,
  };
}
