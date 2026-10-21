import { NextResponse } from "next/server";
import { invoiceInputSchema } from "@/lib/schema";
import { createInvoice, listInvoices } from "@/lib/store";
import { badRequest, readJson, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => NextResponse.json({ invoices: await listInvoices() }));

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const parsed = invoiceInputSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const invoice = await createInvoice(parsed.data);
  return NextResponse.json({ invoice }, { status: 201 });
});
