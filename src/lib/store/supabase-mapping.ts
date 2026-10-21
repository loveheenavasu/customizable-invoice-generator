import type { CustomField, Invoice, InvoiceInput, LineItem, Party } from "../schema";

/**
 * Row shape of `public.invoices` (see supabase/migrations). Kept separate
 * from the client so it can be unit-tested without the server-only guard.
 */
export interface InvoiceRow {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  business: Party;
  customer: Party;
  line_items: LineItem[];
  discount_cents: number | string;
  tax_rate: number | string;
  notes: string;
  custom_fields: CustomField[];
  accent: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceRowInput = Omit<InvoiceRow, "id" | "created_at" | "updated_at">;

export function toRow(input: InvoiceInput): InvoiceRowInput {
  return {
    number: input.number,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    business: input.business,
    customer: input.customer,
    line_items: input.lineItems,
    discount_cents: input.discountCents,
    tax_rate: input.taxRate,
    notes: input.notes,
    custom_fields: input.customFields,
    accent: input.accent,
  };
}

export function fromRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    business: row.business,
    customer: row.customer,
    lineItems: row.line_items ?? [],
    // bigint/numeric may arrive as strings depending on size — normalise.
    discountCents: Number(row.discount_cents),
    taxRate: Number(row.tax_rate),
    notes: row.notes ?? "",
    customFields: row.custom_fields ?? [],
    accent: row.accent as Invoice["accent"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects malformed uuids with an error; treat them as "not found" instead. */
export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}
