import { describe, expect, it } from "vitest";
import { draftTotals, validateDraft, type DraftInvoice } from "@/lib/draft";

const base = (): DraftInvoice => ({
  number: "INV-1",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  business: { name: "Juniper & Pine", email: "", phone: "", address: "" },
  customer: { name: "Acme Co", email: "ap@acme.example", phone: "", address: "" },
  lineItems: [{ id: "a", description: "Table", quantity: "2", unitPrice: "50" }],
  discount: "10",
  taxRate: "10",
  notes: "",
  customFields: [{ id: "c1", label: "PO", value: "123", visible: false }],
  accent: "indigo",
});

describe("validateDraft", () => {
  it("accepts the brief's example and totals $99.00", () => {
    const d = base();
    const { input, errors } = validateDraft(d);
    expect(errors).toEqual({});
    expect(input?.lineItems[0]).toMatchObject({ quantity: 2, unitPriceCents: 5000 });
    expect(draftTotals(d).total).toBe(9900);
  });

  it("custom fields never affect totals", () => {
    const d = base();
    d.customFields = [{ id: "x", label: "Tip", value: "500", visible: true }];
    expect(draftTotals(d).total).toBe(9900);
  });

  it("rejects negative quantity, price, discount and tax, keyed by line id", () => {
    const d = base();
    d.lineItems[0] = { ...d.lineItems[0], quantity: "-1", unitPrice: "-5" };
    d.discount = "-1";
    d.taxRate = "-2";
    const { input, errors } = validateDraft(d);
    expect(input).toBeNull();
    expect(errors["lineItems.a.quantity"]).toMatch(/negative/);
    expect(errors["lineItems.a.unitPrice"]).toMatch(/negative/);
    expect(errors.discount).toMatch(/negative/);
    expect(errors.taxRate).toMatch(/negative/);
  });

  it("rejects a discount larger than the subtotal", () => {
    const d = base();
    d.discount = "100.01";
    expect(validateDraft(d).errors.discount).toBe("Discount can't be greater than the subtotal ($100.00)");
  });

  it("rejects a due date before the issue date and missing names", () => {
    const d = base();
    d.dueDate = "2026-09-01";
    d.customer.name = " ";
    const { errors } = validateDraft(d);
    expect(errors.dueDate).toMatch(/before/);
    expect(errors["customer.name"]).toBe("Name is required");
  });

  it("keys custom field errors by id", () => {
    const d = base();
    d.customFields[0].label = "";
    expect(validateDraft(d).errors["customFields.c1.label"]).toBe("Add a label");
  });
});

describe("error noise", () => {
  it("a bad quantity doesn't also flag the discount", () => {
    const d = base();
    d.lineItems[0].quantity = "-2";
    const { errors } = validateDraft(d);
    expect(Object.keys(errors)).toEqual(["lineItems.a.quantity"]);
  });
});

describe("discount vs subtotal", () => {
  it("flags a too-big discount even while a line has no price yet", () => {
    const d = base();
    d.lineItems.push({ id: "b", description: "", quantity: "1", unitPrice: "" });
    d.discount = "150";
    expect(validateDraft(d).errors.discount).toBe("Discount can't be greater than the subtotal ($100.00)");
  });
});
