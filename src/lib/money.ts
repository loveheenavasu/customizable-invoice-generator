/**
 * Money math. All amounts are integer cents so we never add floats together.
 *
 * Order of operations (from the brief):
 *   1. round each line (qty × unit price) to cents
 *   2. sum the rounded lines → subtotal
 *   3. subtract the fixed discount
 *   4. calculate tax on the discounted amount and round it to cents
 *   5. grand total = discounted subtotal + tax
 */

/**
 * Round half away from zero to a whole number. `toPrecision` first strips
 * binary noise such as 1.15 * 100 = 114.99999999999999.
 */
export function roundCents(value: number): number {
  const cleaned = Number(value.toPrecision(15));
  return Math.sign(cleaned) * Math.round(Math.abs(cleaned));
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  return roundCents(quantity * unitPriceCents);
}

export interface TotalsInput {
  lineItems: { quantity: number; unitPriceCents: number }[];
  discountCents: number;
  /** Percentage, e.g. 10 for 10 %. */
  taxRate: number;
}

export interface Totals {
  lineTotals: number[];
  subtotal: number;
  /** Discount actually applied (never more than the subtotal). */
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

export function calculateTotals({ lineItems, discountCents, taxRate }: TotalsInput): Totals {
  const lineTotals = lineItems.map((l) => lineTotalCents(l.quantity, l.unitPriceCents));
  const subtotal = lineTotals.reduce((sum, t) => sum + t, 0);
  // Validation rejects discount > subtotal; clamping here keeps the live
  // preview sensible while the user is mid-edit.
  const discount = Math.min(Math.max(discountCents, 0), subtotal);
  const taxable = subtotal - discount;
  const tax = roundCents((taxable * Math.max(taxRate, 0)) / 100);
  return { lineTotals, subtotal, discount, taxable, tax, total: taxable + tax };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatUSD(cents: number): string {
  return usd.format(cents / 100);
}

/** Cents → plain editable string, e.g. 1050 → "10.50". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

const MONEY_RE = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;

/**
 * Parse a dollar string into integer cents without going through floats,
 * so "1.15" is exactly 115 rather than 114.99999….
 */
export function parseMoney(raw: string, label = "Amount"): ParseResult {
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (s === "") return { ok: false, error: `Enter ${article(label)} ${label.toLowerCase()}` };
  if (s.startsWith("-")) return { ok: false, error: `${label} can't be negative` };
  if (!MONEY_RE.test(s)) {
    return /^\d*\.\d{3,}$/.test(s)
      ? { ok: false, error: "Use at most 2 decimal places" }
      : { ok: false, error: `${label} must be a number, e.g. 49.99` };
  }
  const [whole = "0", frac = ""] = s.split(".");
  return { ok: true, value: Number(whole || "0") * 100 + Number(frac.padEnd(2, "0")) };
}

const DECIMAL_RE = /^(\d+(\.\d*)?|\.\d+)$/;

export function parseDecimal(
  raw: string,
  label: string,
  { max, maxDecimals }: { max?: number; maxDecimals?: number } = {},
): ParseResult {
  const s = raw.trim();
  if (s === "") return { ok: false, error: `Enter ${article(label)} ${label.toLowerCase()}` };
  if (s.startsWith("-")) return { ok: false, error: `${label} can't be negative` };
  if (!DECIMAL_RE.test(s)) return { ok: false, error: `${label} must be a number` };
  const decimals = s.split(".")[1]?.length ?? 0;
  if (maxDecimals !== undefined && decimals > maxDecimals) {
    return { ok: false, error: `Use at most ${maxDecimals} decimal places` };
  }
  const value = Number(s);
  if (max !== undefined && value > max) return { ok: false, error: `${label} can't exceed ${max}` };
  return { ok: true, value };
}

function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
