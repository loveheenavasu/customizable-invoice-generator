import { NextResponse } from "next/server";
import { invoiceInputSchema } from "@/lib/schema";
import { deleteInvoice, getInvoice, updateInvoice } from "@/lib/store";
import { badRequest, notFound, readJson, withErrorHandling } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, { params }: Ctx) => {
  const invoice = await getInvoice((await params).id);
  return invoice ? NextResponse.json({ invoice }) : notFound();
});

export const PUT = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const parsed = invoiceInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  const invoice = await updateInvoice((await params).id, parsed.data);
  return invoice ? NextResponse.json({ invoice }) : notFound();
});

export const DELETE = withErrorHandling(async (_req: Request, { params }: Ctx) =>
  (await deleteInvoice((await params).id)) ? new NextResponse(null, { status: 204 }) : notFound(),
);
