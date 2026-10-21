import { calculateTotals, centsToInput, parseDecimal, parseMoney, type Totals } from "./money";
import { discountTooHigh, invoiceInputSchema, type InvoiceInput, type LineItem } from "./schema";

/**
 * Editor state. Numeric fields are kept as the raw strings the user typed so
 * "12." or an empty box can exist mid-edit; they are parsed on every render
 * for validation and the live preview.
 */
export interface DraftLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface DraftInvoice extends Omit<InvoiceInput, "lineItems" | "discountCents" | "taxRate"> {
  lineItems: DraftLine[];
  discount: string;
  taxRate: string;
}

/** Field path → message, e.g. "customer.email" or "lineItems.<id>.quantity". */
export type FieldErrors = Record<string, string>;

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyLine(): DraftLine {
  return { id: newId(), description: "", quantity: "1", unitPrice: "" };
}

export function invoiceToDraft(inv: InvoiceInput): DraftInvoice {
  const { lineItems, discountCents, taxRate, ...rest } = inv;
  return {
    ...rest,
    lineItems: lineItems.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: String(l.quantity),
      // A brand-new line shows an empty box (placeholder "0.00") rather than a real zero.
      unitPrice: l.unitPriceCents === 0 && !l.description ? "" : centsToInput(l.unitPriceCents),
    })),
    discount: centsToInput(discountCents),
    taxRate: String(taxRate),
  };
}

const QTY_OPTS = { max: 1_000_000, maxDecimals: 3 };
const TAX_OPTS = { max: 100, maxDecimals: 3 };

/**
 * Validate the draft. Returns the parsed input when valid plus a flat map of
 * field errors keyed by stable ids (not array indexes, which shift on delete).
 */
export function validateDraft(d: DraftInvoice): { input: InvoiceInput | null; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const lineItems: LineItem[] = d.lineItems.map((l) => {
    const qty = parseDecimal(l.quantity, "Quantity", QTY_OPTS);
    const price = parseMoney(l.unitPrice, "Price");
    if (!qty.ok) errors[`lineItems.${l.id}.quantity`] = qty.error;
    if (!price.ok) errors[`lineItems.${l.id}.unitPrice`] = price.error;
    return {
      id: l.id,
      description: l.description,
      quantity: qty.ok ? qty.value : NaN,
      unitPriceCents: price.ok ? price.value : NaN,
    };
  });
  const discount = parseMoney(d.discount, "Discount");
  const tax = parseDecimal(d.taxRate, "Tax rate", TAX_OPTS);
  if (!discount.ok) errors.discount = discount.error;
  if (!tax.ok) errors.taxRate = tax.error;

  // Unparseable numbers become NaN: the schema then skips cross-field checks
  // (like discount ≤ subtotal) and the specific parse error above wins.
  const { discount: _d, taxRate: _t, ...rest } = d;
  const candidate: InvoiceInput = {
    ...rest,
    lineItems,
    discountCents: discount.ok ? discount.value : NaN,
    taxRate: tax.ok ? tax.value : NaN,
  };

  const result = invoiceInputSchema.safeParse(candidate);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issueKey(issue.path, d);
      // Parse errors are more specific than schema errors for the same box.
      if (!(key in errors)) errors[key] = issue.message;
    }
  }

  // The schema skips the subtotal check while a line is incomplete (e.g. no price
  // yet). Still warn using the subtotal the preview currently shows — but not
  // when a line holds a wrong value, so one mistake doesn't produce two errors.
  const hasWrongLineValue = d.lineItems.some(
    (l) =>
      (errors[`lineItems.${l.id}.quantity`] && l.quantity.trim() !== "") ||
      (errors[`lineItems.${l.id}.unitPrice`] && l.unitPrice.trim() !== ""),
  );
  if (!errors.discount && discount.ok && !hasWrongLineValue) {
    const { subtotal } = draftTotals(d);
    if (discount.value > subtotal) errors.discount = discountTooHigh(subtotal);
  }

  const valid = result.success && Object.keys(errors).length === 0;
  return { input: valid ? result.data : null, errors };
}

function issueKey(path: (string | number)[], d: DraftInvoice): string {
  const [head, index, field] = path;
  if ((head === "lineItems" || head === "customFields") && typeof index === "number") {
    const id = d[head][index]?.id ?? index;
    const name = field === "unitPriceCents" ? "unitPrice" : field;
    return [head, id, name].filter((p) => p !== undefined).join(".");
  }
  if (head === "discountCents") return "discount";
  return path.join(".");
}

/** Totals for the live preview — unparseable numbers count as zero. */
export function draftTotals(d: DraftInvoice): Totals {
  const num = (r: ReturnType<typeof parseMoney>) => (r.ok ? r.value : 0);
  return calculateTotals({
    lineItems: d.lineItems.map((l) => ({
      quantity: num(parseDecimal(l.quantity, "Quantity", QTY_OPTS)),
      unitPriceCents: num(parseMoney(l.unitPrice)),
    })),
    discountCents: num(parseMoney(d.discount)),
    taxRate: num(parseDecimal(d.taxRate, "Tax rate", TAX_OPTS)),
  });
}

/** DOM id for a field key so validation can move focus to it. */
export function fieldId(key: string): string {
  return "f-" + key.replace(/[^a-zA-Z0-9_-]/g, "-");
}
