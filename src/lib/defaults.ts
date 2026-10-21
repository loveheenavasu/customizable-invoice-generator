import { emptyLine, newId } from "./draft";
import { isoToday } from "./format";
import { DEFAULT_ACCENT, type InvoiceInput, type Party } from "./schema";

/** Fictional demo business used until the first invoice is saved. */
export const DEMO_BUSINESS: Party = {
  name: "Juniper & Pine Woodworks",
  email: "hello@juniperpine.example",
  phone: "(555) 014-2290",
  address: "418 Alder Lane\nPortland, OR 97214",
};

/**
 * A fresh invoice. Business details carry over from the most
 * recent invoice so the owner doesn't retype them every time.
 */
/**
 * Next invoice number for this year: one higher than the highest existing
 * INV-<year>-NNNN. Using the highest (not the count) means deleting an
 * invoice never causes a number to be reused.
 */
export function nextInvoiceNumber(existing: string[], year = isoToday().slice(0, 4)): string {
  const prefix = `INV-${year}-`;
  const highest = existing.reduce((max, n) => {
    const m = n.startsWith(prefix) ? /^(\d+)$/.exec(n.slice(prefix.length)) : null;
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export function newInvoiceInput(opts: { previous: InvoiceInput | null; number: string }): InvoiceInput {
  const { previous, number } = opts;
  const line = emptyLine();
  return {
    number,
    issueDate: isoToday(),
    dueDate: isoToday(30),
    business: previous?.business ?? DEMO_BUSINESS,
    customer: { name: "", email: "", phone: "", address: "" },
    lineItems: [{ id: line.id, description: "", quantity: 1, unitPriceCents: 0 }],
    discountCents: 0,
    taxRate: 0,
    notes: previous?.notes ?? "Payment due within 30 days by bank transfer or card.\nThank you for your business!",
    customFields: (previous?.customFields ?? [])
      .filter((f) => f.label === "Payment terms" || f.label === "Tax ID")
      .map((f) => ({ ...f, id: newId() })),
    accent: DEFAULT_ACCENT,
  };
}
