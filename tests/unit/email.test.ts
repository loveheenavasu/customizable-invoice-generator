import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { savedInvoice } from "../support/fixtures";

// Fake SMTP: capture what would be sent instead of sending anything.
// vi.hoisted keeps the fake available to the hoisted vi.mock factory below.
const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(async (opts?: { to?: string }) => ({
    messageId: "<test@local>",
    accepted: [opts?.to],
    rejected: [],
    response: "250 OK",
  })),
}));
vi.mock("nodemailer", () => {
  const api = {
    createTransport: vi.fn(() => ({ sendMail })),
    createTestAccount: vi.fn(),
    getTestMessageUrl: vi.fn(() => false),
  };
  return { default: api, ...api };
});

const { sendInvoiceEmail, RecipientNotAllowedError } = await import("@/lib/email");

type Sent = { from: string; to: string; replyTo?: string; subject: string; text: string; html: string };
const lastSent = () => sendMail.mock.calls.at(-1)![0] as unknown as Sent;

beforeAll(() => {
  process.env.SMTP_HOST = "smtp.test.local";
  process.env.EMAIL_FROM = "Juniper & Pine <invoices@juniperpine.example>";
});
beforeEach(() => sendMail.mockClear());
afterEach(() => delete process.env.EMAIL_ALLOWED_RECIPIENTS);

describe("sendInvoiceEmail", () => {
  it("sends through SMTP with the number, total and due date in the subject", async () => {
    const result = await sendInvoiceEmail(savedInvoice(), "me@example.test", "Hello");
    expect(result.messageId).toBe("<test@local>");
    const mail = lastSent();
    expect(mail.to).toBe("me@example.test");
    expect(mail.subject).toBe("Invoice INV-2026-0001 from Juniper & Pine Woodworks — $99.00 due Oct 31, 2026");
    expect(mail.replyTo).toBe("hello@juniperpine.example");
  });

  it("includes totals and only VISIBLE custom fields", async () => {
    await sendInvoiceEmail(savedInvoice(), "me@example.test", "");
    const { html, text } = lastSent();
    for (const body of [html, text]) {
      expect(body).toContain("$99.00");
      expect(body).toContain("4471-B"); // visible PO number
      expect(body).not.toContain("Margin 40%"); // hidden field
    }
    expect(text).toContain("Discount: -$10.00");
    expect(text).toContain("Tax (10%): $9.00");
  });

  it("escapes HTML typed into invoice fields", async () => {
    const inv = savedInvoice({
      lineItems: [{ id: "x", description: "<script>alert(1)</script>", quantity: 1, unitPriceCents: 100 }],
      discountCents: 0,
    });
    await sendInvoiceEmail(inv, "me@example.test", "<b>hi</b>");
    const { html } = lastSent();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("only sends to allowed recipients when an allow-list is set", async () => {
    process.env.EMAIL_ALLOWED_RECIPIENTS = "me@example.test, boss@example.test";
    await expect(sendInvoiceEmail(savedInvoice(), "stranger@example.test", "")).rejects.toBeInstanceOf(
      RecipientNotAllowedError,
    );
    expect(sendMail).not.toHaveBeenCalled();
    await expect(sendInvoiceEmail(savedInvoice(), "ME@example.test", "")).resolves.toBeTruthy();
  });
});
