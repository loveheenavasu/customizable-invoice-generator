import { describe, expect, it } from "vitest";
import type { InvoiceInput } from "@/lib/schema";
import { fromRow, isUuid, toRow, type InvoiceRow } from "@/lib/store/supabase-mapping";

const input: InvoiceInput = {
  number: "INV-1",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  business: { name: "Juniper & Pine", email: "", phone: "", address: "" },
  customer: { name: "Acme", email: "ap@acme.example", phone: "", address: "" },
  lineItems: [{ id: "a", description: "Table", quantity: 2, unitPriceCents: 5000 }],
  discountCents: 1000,
  taxRate: 8.875,
  notes: "Thanks",
  customFields: [{ id: "c", label: "PO", value: "1", visible: false }],
  accent: "indigo",
};

describe("supabase row mapping", () => {
  it("round-trips an invoice through a database row", () => {
    const row: InvoiceRow = {
      ...toRow(input),
      id: "6f1c1a8e-1b2c-4d3e-8f90-123456789abc",
      created_at: "2026-10-20T10:00:00+00:00",
      updated_at: "2026-10-20T11:00:00+00:00",
    };
    const back = fromRow(row);
    const { id, createdAt, updatedAt, ...rest } = back;
    expect(rest).toEqual(input);
    expect(id).toBe(row.id);
    expect(updatedAt).toBe(row.updated_at);
  });

  it("normalises numeric/bigint columns that arrive as strings", () => {
    const row = { ...toRow(input), discount_cents: "1000", tax_rate: "8.875" } as InvoiceRow;
    const inv = fromRow({ ...row, id: "x", created_at: "", updated_at: "" });
    expect(inv.discountCents).toBe(1000);
    expect(inv.taxRate).toBe(8.875);
  });

  it("recognises uuids", () => {
    expect(isUuid("6f1c1a8e-1b2c-4d3e-8f90-123456789abc")).toBe(true);
    expect(isUuid("nope")).toBe(false);
  });
});
