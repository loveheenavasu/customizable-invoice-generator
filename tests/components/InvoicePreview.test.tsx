import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoicePreview } from "@/components/InvoicePreview";
import { draftTotals, type DraftInvoice } from "@/lib/draft";
import { validDraft } from "../support/fixtures";

/** Render the invoice "paper" (also what prints) to HTML and return its text. */
function render(draft: DraftInvoice) {
  const html = renderToStaticMarkup(<InvoicePreview draft={draft} totals={draftTotals(draft)} />);
  const text = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  return { html, text };
}

describe("InvoicePreview", () => {
  it("shows the brief's totals: subtotal $100, discount −$10, tax $9, total $99", () => {
    const { text } = render(validDraft());
    expect(text).toContain("Subtotal $100.00");
    expect(text).toContain("Discount −$10.00");
    expect(text).toContain("Tax (10%) $9.00");
    expect(text).toContain("Total due (USD) $99.00");
  });

  it("shows visible custom fields and never shows hidden ones", () => {
    const draft = validDraft();
    draft.customFields = [
      { id: "a", label: "PO number", value: "4471-B", visible: true },
      { id: "b", label: "Internal note", value: "Secret margin", visible: false },
    ];
    const { text } = render(draft);
    expect(text).toContain("PO number");
    expect(text).toContain("4471-B");
    expect(text).not.toContain("Internal note");
    expect(text).not.toContain("Secret margin");
  });

  it("custom fields don't change the totals", () => {
    const draft = validDraft();
    draft.customFields = [{ id: "a", label: "Tip", value: "500", visible: true }];
    expect(render(draft).text).toContain("Total due (USD) $99.00");
  });

  it("hides the discount row when there is no discount", () => {
    const draft = validDraft();
    draft.discount = "0";
    expect(render(draft).text).not.toContain("Discount");
  });

  it("updates live from the draft: business, customer, number and dates", () => {
    const draft = validDraft();
    draft.number = "INV-2026-0042";
    draft.business.name = "Juniper & Pine Woodworks";
    draft.customer.name = "Hollow Oak Café";
    draft.dueDate = "2026-12-31";
    const { text } = render(draft);
    expect(text).toContain("INV-2026-0042");
    expect(text).toContain("Juniper & Pine Woodworks");
    expect(text).toContain("Hollow Oak Café");
    expect(text).toContain("Dec 31, 2026");
    expect(text).toContain(" JP "); // monogram from the business name
  });

  it("shows placeholders for unfinished lines and treats bad numbers as $0", () => {
    const draft = validDraft();
    draft.lineItems.push({ id: "b", description: "", quantity: "1", unitPrice: "" });
    const { text } = render(draft);
    expect(text).toContain("Untitled item");
    expect(text).toContain("Subtotal $100.00");
  });

  it("uses the selected accent colour and defaults to Ink", () => {
    expect(render(validDraft()).html).toContain("--inv-accent:#0a0a0a");
    const ember = { ...validDraft(), accent: "ember" as const };
    expect(render(ember).html).toContain("--inv-accent:#c2410c");
  });

  it("escapes text typed into the invoice", () => {
    const draft = validDraft();
    draft.notes = "<img src=x onerror=alert(1)>";
    const { html } = render(draft);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
