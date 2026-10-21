import { describe, expect, it } from "vitest";
import { nextInvoiceNumber } from "@/lib/defaults";

describe("nextInvoiceNumber", () => {
  it("starts at 0001", () => {
    expect(nextInvoiceNumber([], "2026")).toBe("INV-2026-0001");
  });
  it("uses the highest number, so deletions never cause reuse", () => {
    // INV-2026-0001 was deleted; only 0002 remains → next must be 0003, not 0002.
    expect(nextInvoiceNumber(["INV-2026-0002"], "2026")).toBe("INV-2026-0003");
  });
  it("ignores custom numbers and other years", () => {
    expect(nextInvoiceNumber(["TOAST-TEST", "INV-2025-0099", "INV-2026-0007"], "2026")).toBe("INV-2026-0008");
  });
});
