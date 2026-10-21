import nodemailer, { type Transporter } from "nodemailer";
import { calculateTotals, formatUSD } from "./money";
import { formatDate, formatQuantity } from "./format";
import { ACCENTS, DEFAULT_ACCENT, type Invoice } from "./schema";

/**
 * Server-only email sending. SMTP credentials come from env vars and never
 * reach the browser. In development without SMTP configured we fall back to
 * an Ethereal test inbox (nothing is delivered; you get a preview URL).
 */

export class EmailConfigError extends Error {}
export class RecipientNotAllowedError extends Error {}

// Fail in seconds, not nodemailer's 2-minute default, so the UI can say what went wrong.
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };

let cachedTransport: Promise<{ transport: Transporter; ethereal: boolean }> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = (async () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST) {
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 587),
        secure: SMTP_SECURE === "true",
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        ...TIMEOUTS,
      });
      return { transport, ethereal: false };
    }
    if (process.env.NODE_ENV === "production") {
      throw new EmailConfigError("Email isn't configured. Set SMTP_HOST and related variables on the server.");
    }
    const account = await nodemailer.createTestAccount();
    const transport = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
      ...TIMEOUTS,
    });
    return { transport, ethereal: true };
  })();
  // Don't cache a failure (e.g. Ethereal unreachable) — let the next call retry.
  cachedTransport.catch(() => (cachedTransport = null));
  return cachedTransport;
}

function assertRecipientAllowed(to: string) {
  const allow = (process.env.EMAIL_ALLOWED_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && !allow.includes(to.toLowerCase())) {
    throw new RecipientNotAllowedError(
      "This server only sends to addresses listed in EMAIL_ALLOWED_RECIPIENTS.",
    );
  }
}

export async function sendInvoiceEmail(invoice: Invoice, to: string, message: string) {
  assertRecipientAllowed(to);
  const { transport, ethereal } = await getTransport();
  const from = process.env.EMAIL_FROM || `${invoice.business.name} <invoices@example.com>`;
  const totals = calculateTotals(invoice);

  const info = await transport.sendMail({
    from,
    to,
    replyTo: invoice.business.email || undefined,
    subject: `Invoice ${invoice.number} from ${invoice.business.name} — ${formatUSD(totals.total)} due ${formatDate(invoice.dueDate)}`,
    text: renderText(invoice, message),
    html: renderHtml(invoice, message),
  });

  // Server-side record of what the SMTP server said, for tracing delivery issues.
  console.info("Invoice email handed to SMTP", {
    invoice: invoice.number,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    messageId: info.messageId,
  });

  return {
    messageId: info.messageId,
    previewUrl: ethereal ? nodemailer.getTestMessageUrl(info) || null : null,
  };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

function renderText(inv: Invoice, message: string): string {
  const t = calculateTotals(inv);
  const lines = inv.lineItems.map(
    (l, i) => `- ${l.description}: ${formatQuantity(l.quantity)} × ${formatUSD(l.unitPriceCents)} = ${formatUSD(t.lineTotals[i])}`,
  );
  const fields = inv.customFields.filter((f) => f.visible).map((f) => `${f.label}: ${f.value}`);
  return [
    message,
    "",
    `Invoice ${inv.number}`,
    `From: ${inv.business.name}`,
    `To: ${inv.customer.name}`,
    `Issued: ${formatDate(inv.issueDate)}   Due: ${formatDate(inv.dueDate)}`,
    ...fields,
    "",
    ...lines,
    "",
    `Subtotal: ${formatUSD(t.subtotal)}`,
    ...(t.discount ? [`Discount: -${formatUSD(t.discount)}`] : []),
    `Tax (${inv.taxRate}%): ${formatUSD(t.tax)}`,
    `Total due: ${formatUSD(t.total)}`,
    ...(inv.notes ? ["", inv.notes] : []),
  ]
    .join("\n")
    .trim();
}

/** Table-based, inline-styled HTML so it survives Gmail/Outlook. */
function renderHtml(inv: Invoice, message: string): string {
  const t = calculateTotals(inv);
  const accent = ACCENTS[inv.accent]?.color ?? ACCENTS[DEFAULT_ACCENT].color;
  const cell = "padding:10px 0;border-bottom:1px solid #e7e2d8;font-size:14px;";
  const num = `${cell}text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;`;

  const rows = inv.lineItems
    .map(
      (l, i) => `<tr>
        <td style="${cell}">${esc(l.description)}</td>
        <td style="${num}">${formatQuantity(l.quantity)}</td>
        <td style="${num}">${formatUSD(l.unitPriceCents)}</td>
        <td style="${num}">${formatUSD(t.lineTotals[i])}</td></tr>`,
    )
    .join("");

  const fields = inv.customFields
    .filter((f) => f.visible)
    .map((f) => `<div><span style="color:#6b6458">${esc(f.label)}:</span> ${esc(f.value)}</div>`)
    .join("");

  const sumRow = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:${strong ? 16 : 14}px;${strong ? "font-weight:700;" : "color:#4a453c;"}">${label}</td>
     <td style="padding:4px 0;text-align:right;font-variant-numeric:tabular-nums;font-size:${strong ? 16 : 14}px;${strong ? `font-weight:700;color:${accent};` : ""}">${value}</td></tr>`;

  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1a17">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fffdf8;border-top:6px solid ${accent};border-radius:6px">
    <tr><td style="padding:28px 32px 8px">
      ${message ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.55">${nl2br(message)}</p>` : ""}
      <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em;color:${accent}">Invoice ${esc(inv.number)}</div>
      <div style="margin-top:6px;font-size:14px;color:#4a453c">From <strong>${esc(inv.business.name)}</strong> to <strong>${esc(inv.customer.name)}</strong></div>
      <div style="margin-top:6px;font-size:14px;color:#4a453c">Issued ${formatDate(inv.issueDate)} · Due <strong>${formatDate(inv.dueDate)}</strong></div>
      ${fields ? `<div style="margin-top:10px;font-size:13px;line-height:1.6">${fields}</div>` : ""}
    </td></tr>
    <tr><td style="padding:16px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th align="left" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6458;padding-bottom:6px">Item</th>
          <th align="right" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6458">Qty</th>
          <th align="right" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6458">Price</th>
          <th align="right" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6458">Amount</th>
        </tr>${rows}
      </table>
      <table role="presentation" width="260" align="right" cellpadding="0" cellspacing="0" style="margin-top:14px">
        ${sumRow("Subtotal", formatUSD(t.subtotal))}
        ${t.discount ? sumRow("Discount", `−${formatUSD(t.discount)}`) : ""}
        ${sumRow(`Tax (${inv.taxRate}%)`, formatUSD(t.tax))}
        ${sumRow("Total due", formatUSD(t.total), true)}
      </table>
    </td></tr>
    ${inv.notes ? `<tr><td style="padding:8px 32px 28px;font-size:13px;line-height:1.6;color:#4a453c">${nl2br(inv.notes)}</td></tr>` : ""}
  </table>
  <div style="font-size:12px;color:#8a8275;margin-top:14px">${esc(inv.business.name)}${inv.business.email ? ` · ${esc(inv.business.email)}` : ""}</div>
  </td></tr></table></body></html>`;
}
