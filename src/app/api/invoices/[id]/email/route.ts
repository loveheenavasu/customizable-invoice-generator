import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailConfigError, RecipientNotAllowedError, sendInvoiceEmail } from "@/lib/email";
import { getInvoice } from "@/lib/store";
import { badRequest, notFound, readJson, withErrorHandling } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  to: z.string().trim().email("Enter a valid email address"),
  message: z.string().max(2000).default(""),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Sends the *saved* invoice. Totals are recomputed from stored data on the
 * server, so the email can't disagree with what's in the database.
 */
export const POST = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);

  const invoice = await getInvoice((await params).id);
  if (!invoice) return notFound();

  try {
    const result = await sendInvoiceEmail(invoice, parsed.data.to, parsed.data.message);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RecipientNotAllowedError) {
      return NextResponse.json({ error: err.message, fields: { to: err.message } }, { status: 403 });
    }
    if (err instanceof EmailConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Email send failed", err);
    return NextResponse.json(
      { error: "The email provider rejected the message. Check the SMTP settings and try again." },
      { status: 502 },
    );
  }
});
