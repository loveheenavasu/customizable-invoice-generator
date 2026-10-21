import { describe, expect, it } from "vitest";
import { calculateTotals, formatUSD, lineTotalCents, parseDecimal, parseMoney } from "@/lib/money";

describe("calculateTotals", () => {
  it("matches the brief: 2 × $50 − $10 discount + 10% tax = $99.00", () => {
    const t = calculateTotals({
      lineItems: [{ quantity: 2, unitPriceCents: 5000 }],
      discountCents: 1000,
      taxRate: 10,
    });
    expect(t.subtotal).toBe(10000);
    expect(t.discount).toBe(1000);
    expect(t.tax).toBe(900);
    expect(t.total).toBe(9900);
    expect(formatUSD(t.total)).toBe("$99.00");
  });

  it("rounds each line to cents before summing", () => {
    // 0.333 × $1.00 = 33.3¢ → 33¢, twice = 66¢ (not round(66.6) = 67¢)
    const t = calculateTotals({
      lineItems: [
        { quantity: 0.333, unitPriceCents: 100 },
        { quantity: 0.333, unitPriceCents: 100 },
      ],
      discountCents: 0,
      taxRate: 0,
    });
    expect(t.lineTotals).toEqual([33, 33]);
    expect(t.subtotal).toBe(66);
  });

  it("applies the discount before tax and rounds tax half up", () => {
    // (1005 − 0) × 8.875% = 89.19375 → 89¢
    const t = calculateTotals({
      lineItems: [{ quantity: 1, unitPriceCents: 1005 }],
      discountCents: 0,
      taxRate: 8.875,
    });
    expect(t.tax).toBe(89);
    // 15¢ × 10% = 1.5¢ → 2¢
    expect(
      calculateTotals({ lineItems: [{ quantity: 1, unitPriceCents: 15 }], discountCents: 0, taxRate: 10 })
        .tax,
    ).toBe(2);
  });

  it("never applies more discount than the subtotal", () => {
    const t = calculateTotals({
      lineItems: [{ quantity: 1, unitPriceCents: 500 }],
      discountCents: 900,
      taxRate: 10,
    });
    expect(t.discount).toBe(500);
    expect(t.total).toBe(0);
  });

  it("handles an empty invoice", () => {
    expect(calculateTotals({ lineItems: [], discountCents: 0, taxRate: 5 }).total).toBe(0);
  });
});

describe("lineTotalCents", () => {
  it("avoids float noise", () => {
    expect(lineTotalCents(3, 115)).toBe(345);
    expect(lineTotalCents(1.5, 101)).toBe(152); // 151.5 → 152
  });
});

describe("parseMoney", () => {
  it("parses dollars into exact cents", () => {
    expect(parseMoney("1.15")).toEqual({ ok: true, value: 115 });
    expect(parseMoney("$1,234.5")).toEqual({ ok: true, value: 123450 });
    expect(parseMoney(".5")).toEqual({ ok: true, value: 50 });
    expect(parseMoney("50")).toEqual({ ok: true, value: 5000 });
  });

  it("rejects negatives, junk and extra decimals", () => {
    expect(parseMoney("-5", "Price")).toEqual({ ok: false, error: "Price can't be negative" });
    expect(parseMoney("abc").ok).toBe(false);
    expect(parseMoney("1.999")).toEqual({ ok: false, error: "Use at most 2 decimal places" });
    expect(parseMoney("", "Price")).toEqual({ ok: false, error: "Enter a price" });
  });
});

describe("parseDecimal", () => {
  it("enforces max and non-negative", () => {
    expect(parseDecimal("10", "Tax rate", { max: 100 })).toEqual({ ok: true, value: 10 });
    expect(parseDecimal("101", "Tax rate", { max: 100 }).ok).toBe(false);
    expect(parseDecimal("-1", "Quantity")).toEqual({ ok: false, error: "Quantity can't be negative" });
  });
});
