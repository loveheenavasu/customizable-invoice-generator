import { z } from "zod";
import { calculateTotals, formatUSD } from "./money";

/**
 * The canonical invoice shape, shared by the browser and the API. The server
 * re-validates every write with this schema, so the client is never trusted.
 */

export const ACCENTS = {
  ink: { label: "Ink", color: "#0a0a0a" },
  ember: { label: "Ember", color: "#c2410c" },
  indigo: { label: "Indigo", color: "#4f46e5" },
  emerald: { label: "Emerald", color: "#047857" },
  rose: { label: "Rose", color: "#be123c" },
} as const;
export const DEFAULT_ACCENT = "ink";
export type Accent = keyof typeof ACCENTS;


const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date");

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine((s) => s === "" || z.string().email().safeParse(s).success, "Enter a valid email, e.g. name@example.com");

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: optionalEmail,
  phone: z.string().trim().max(40),
  address: z.string().trim().max(400),
});

export const lineItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, "Describe the item").max(300),
  quantity: z
    .number({ invalid_type_error: "Enter a quantity" })
    .finite()
    .min(0, "Quantity can't be negative")
    .max(1_000_000, "Quantity is too large"),
  unitPriceCents: z
    .number({ invalid_type_error: "Enter a price" })
    .int()
    .min(0, "Price can't be negative")
    .max(100_000_000_00, "Price is too large"),
});

export const customFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Add a label").max(60),
  value: z.string().trim().max(300),
  visible: z.boolean(),
});

export const invoiceInputSchema = z
  .object({
    number: z.string().trim().min(1, "Invoice number is required").max(40),
    issueDate: isoDate,
    dueDate: isoDate,
    business: partySchema,
    customer: partySchema,
    lineItems: z.array(lineItemSchema).min(1, "Add at least one line item").max(200),
    discountCents: z
      .number({ invalid_type_error: "Enter a discount" })
      .int()
      .min(0, "Discount can't be negative"),
    taxRate: z
      .number({ invalid_type_error: "Enter a tax rate" })
      .finite()
      .min(0, "Tax rate can't be negative")
      .max(100, "Tax rate can't exceed 100%"),
    notes: z.string().max(2000),
    customFields: z.array(customFieldSchema).max(30),
    // Unknown/legacy accent names fall back to the default instead of failing the save.
    accent: z.preprocess(
      (v) => (typeof v === "string" && v in ACCENTS ? v : DEFAULT_ACCENT),
      z.enum(Object.keys(ACCENTS) as [Accent, ...Accent[]]),
    ),
  })
  .superRefine((inv, ctx) => {
    if (inv.dueDate < inv.issueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date can't be before the issue date" });
    }
    // Only compare against the subtotal once the lines themselves are valid,
    // otherwise one bad quantity would also flag the discount.
    const linesOk = inv.lineItems.every(
      (l) => Number.isFinite(l.quantity) && l.quantity >= 0 && Number.isInteger(l.unitPriceCents) && l.unitPriceCents >= 0,
    );
    if (!linesOk || !Number.isFinite(inv.discountCents)) return;
    const { subtotal } = calculateTotals(inv);
    if (inv.lineItems.length > 0 && inv.discountCents > subtotal) {
      ctx.addIssue({ code: "custom", path: ["discountCents"], message: discountTooHigh(subtotal) });
    }
  });

export function discountTooHigh(subtotalCents: number): string {
  return `Discount can't be greater than the subtotal (${formatUSD(subtotalCents)})`;
}

export type Party = z.infer<typeof partySchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type CustomField = z.infer<typeof customFieldSchema>;
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export interface Invoice extends InvoiceInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight row for the dashboard list. */
export interface InvoiceSummary {
  id: string;
  number: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  updatedAt: string;
}
