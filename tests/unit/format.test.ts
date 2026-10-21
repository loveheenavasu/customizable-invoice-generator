import { describe, expect, it } from "vitest";
import { formatDate, formatQuantity, isoToday } from "@/lib/format";

describe("formatDate", () => {
  it("formats ISO dates without shifting the day for any timezone", () => {
    expect(formatDate("2026-10-01")).toBe("Oct 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("shows a dash for missing or invalid dates", () => {
    expect(formatDate("")).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatQuantity", () => {
  it("shows up to 3 decimals and thousands separators", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity("1.5")).toBe("1.5");
    expect(formatQuantity(0.3333)).toBe("0.333");
    expect(formatQuantity(1200)).toBe("1,200");
  });

  it("shows a dash for non-numbers", () => {
    expect(formatQuantity("abc")).toBe("—");
  });
});

describe("isoToday", () => {
  it("returns YYYY-MM-DD and supports day offsets", () => {
    expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const diff = (Date.parse(isoToday(30)) - Date.parse(isoToday())) / 86_400_000;
    expect(Math.round(diff)).toBe(30);
  });
});
