import { describe, expect, it } from "vitest";
import { invoiceInputSchema } from "@/lib/schema";
import { validInput } from "../support/fixtures";

/** Run the server-side schema and return `{ path: message }` for failures. */
function errorsFor(input: unknown): Record<string, string> {
  const result = invoiceInputSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

const line = validInput().lineItems[0];

describe("server validation (invoiceInputSchema)", () => {
  it("accepts a valid invoice", () => {
    expect(errorsFor(validInput())).toEqual({});
  });

  it.each([
    ["negative quantity", { lineItems: [{ ...line, quantity: -1 }] }, "lineItems.0.quantity", "Quantity can't be negative"],
    ["negative unit price", { lineItems: [{ ...line, unitPriceCents: -1 }] }, "lineItems.0.unitPriceCents", "Price can't be negative"],
    ["negative discount", { discountCents: -1 }, "discountCents", "Discount can't be negative"],
    ["negative tax rate", { taxRate: -0.5 }, "taxRate", "Tax rate can't be negative"],
    ["tax rate over 100%", { taxRate: 101 }, "taxRate", "Tax rate can't exceed 100%"],
  ])("rejects %s", (_name, override, path, message) => {
    expect(errorsFor(validInput(override))[path]).toBe(message);
  });

  it("rejects a discount greater than the subtotal and states the subtotal", () => {
    expect(errorsFor(validInput({ discountCents: 10001 })).discountCents).toBe(
      "Discount can't be greater than the subtotal ($100.00)",
    );
  });

  it("allows a discount exactly equal to the subtotal", () => {
    expect(errorsFor(validInput({ discountCents: 10000 }))).toEqual({});
  });

  it("rejects a due date before the issue date", () => {
    expect(errorsFor(validInput({ dueDate: "2026-09-30" })).dueDate).toBe("Due date can't be before the issue date");
  });

  it("requires at least one line item", () => {
    expect(errorsFor(validInput({ lineItems: [] })).lineItems).toBe("Add at least one line item");
  });

  it("requires business and customer names and an invoice number", () => {
    const errors = errorsFor(
      validInput({
        number: " ",
        business: { ...validInput().business, name: "" },
        customer: { ...validInput().customer, name: "" },
      }),
    );
    expect(errors.number).toBe("Invoice number is required");
    expect(errors["business.name"]).toBe("Name is required");
    expect(errors["customer.name"]).toBe("Name is required");
  });

  it("validates email format but allows it to be empty", () => {
    expect(errorsFor(validInput({ customer: { ...validInput().customer, email: "not-an-email" } }))["customer.email"]).toMatch(
      /valid email/,
    );
    expect(errorsFor(validInput({ customer: { ...validInput().customer, email: "" } }))).toEqual({});
  });

  it("rejects numbers sent as strings and fractional cents", () => {
    expect(errorsFor(validInput({ lineItems: [{ ...line, quantity: "2" as unknown as number }] }))).toHaveProperty(
      "lineItems.0.quantity",
    );
    expect(errorsFor(validInput({ lineItems: [{ ...line, unitPriceCents: 10.5 }] }))).toHaveProperty(
      "lineItems.0.unitPriceCents",
    );
  });

  it("requires custom field labels", () => {
    const errors = errorsFor(validInput({ customFields: [{ id: "x", label: "", value: "v", visible: true }] }));
    expect(errors["customFields.0.label"]).toBe("Add a label");
  });

  it("falls back to the Ink accent for unknown colours", () => {
    const parsed = invoiceInputSchema.parse({ ...validInput(), accent: "neon" });
    expect(parsed.accent).toBe("ink");
  });

  it("rejects a body that isn't an invoice at all", () => {
    expect(invoiceInputSchema.safeParse(null).success).toBe(false);
    expect(invoiceInputSchema.safeParse({}).success).toBe(false);
  });
});
