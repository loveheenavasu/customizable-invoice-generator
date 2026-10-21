import type { DraftInvoice } from "@/lib/draft";
import type { Invoice, InvoiceInput } from "@/lib/schema";

/** The brief's check: 2 × $50 − $10 discount + 10% tax = $99.00. */
export function validInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    number: "INV-2026-0001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-31",
    business: { name: "Juniper & Pine Woodworks", email: "hello@juniperpine.example", phone: "", address: "418 Alder Lane" },
    customer: { name: "Hollow Oak Café", email: "owner@hollowoak.example", phone: "", address: "" },
    lineItems: [{ id: "line-1", description: "Walnut bar stool", quantity: 2, unitPriceCents: 5000 }],
    discountCents: 1000,
    taxRate: 10,
    notes: "Thank you!",
    customFields: [
      { id: "cf-po", label: "PO number", value: "4471-B", visible: true },
      { id: "cf-internal", label: "Internal note", value: "Margin 40%", visible: false },
    ],
    accent: "ink",
    ...overrides,
  };
}

export function savedInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    ...validInput(),
    id: "6f1c1a8e-1b2c-4d3e-8f90-123456789abc",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

/** Same invoice as the editor holds it (numbers as typed strings). */
export function validDraft(): DraftInvoice {
  return {
    number: "INV-2026-0001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-31",
    business: { name: "Juniper & Pine", email: "", phone: "", address: "" },
    customer: { name: "Acme Co", email: "ap@acme.example", phone: "", address: "" },
    lineItems: [{ id: "a", description: "Table", quantity: "2", unitPrice: "50" }],
    discount: "10",
    taxRate: "10",
    notes: "",
    customFields: [{ id: "c1", label: "PO", value: "123", visible: false }],
    accent: "ink",
  };
}
