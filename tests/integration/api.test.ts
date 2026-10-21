import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validInput } from "../support/fixtures";

/**
 * End-to-end tests of the REST API: real route handlers, real validation and
 * the real file store, writing to a throw-away temp folder. Email is faked.
 */

const { sendInvoiceEmail } = vi.hoisted(() => ({ sendInvoiceEmail: vi.fn() }));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendInvoiceEmail,
}));

let dataDir: string;
let collection: typeof import("@/app/api/invoices/route");
let item: typeof import("@/app/api/invoices/[id]/route");
let email: typeof import("@/app/api/invoices/[id]/email/route");
let emailErrors: typeof import("@/lib/email");

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "folio-test-"));
  process.env.DATA_DIR = dataDir; // the store reads this when first imported
  collection = await import("@/app/api/invoices/route");
  item = await import("@/app/api/invoices/[id]/route");
  email = await import("@/app/api/invoices/[id]/email/route");
  emailErrors = await import("@/lib/email");
});
afterAll(() => rm(dataDir, { recursive: true, force: true }));
beforeEach(async () => {
  await rm(path.join(dataDir, "invoices.json"), { force: true });
  sendInvoiceEmail.mockReset();
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (method: string, body?: unknown) =>
  new Request("http://test.local/api/invoices", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function create(overrides = {}) {
  const res = await collection.POST(json("POST", validInput(overrides)));
  expect(res.status).toBe(201);
  return (await res.json()).invoice as { id: string; updatedAt: string };
}
const stored = async () => JSON.parse(await readFile(path.join(dataDir, "invoices.json"), "utf8")).invoices;

describe("POST /api/invoices (create)", () => {
  it("saves a valid invoice and returns it with an id and timestamps", async () => {
    const inv = await create();
    expect(inv.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inv).toMatchObject({ number: "INV-2026-0001", createdAt: expect.any(String) });
    expect(await stored()).toHaveLength(1);
  });

  it("rejects invalid values with field-level messages", async () => {
    const res = await collection.POST(json("POST", validInput({ discountCents: -5, taxRate: 120 })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields).toMatchObject({
      discountCents: "Discount can't be negative",
      taxRate: "Tax rate can't exceed 100%",
    });
  });

  it("rejects a discount above the subtotal even when the UI is bypassed", async () => {
    const res = await collection.POST(json("POST", validInput({ discountCents: 50_000 })));
    expect(res.status).toBe(400);
    expect((await res.json()).fields.discountCents).toBe("Discount can't be greater than the subtotal ($100.00)");
  });

  it("rejects malformed JSON", async () => {
    const res = await collection.POST(json("POST", "{not json"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/invoices (list) and GET /api/invoices/:id (retrieve)", () => {
  it("lists saved invoices with the calculated total ($99.00)", async () => {
    const inv = await create();
    const res = await collection.GET();
    const { invoices } = await res.json();
    expect(invoices).toEqual([
      expect.objectContaining({ id: inv.id, number: "INV-2026-0001", customerName: "Hollow Oak Café", totalCents: 9900 }),
    ]);
  });

  it("retrieves the full invoice including line items and hidden custom fields", async () => {
    const inv = await create();
    const res = await item.GET(json("GET"), ctx(inv.id));
    const { invoice } = await res.json();
    expect(invoice.lineItems).toEqual(validInput().lineItems);
    expect(invoice.customFields).toEqual(validInput().customFields);
  });

  it("returns 404 for an unknown invoice", async () => {
    expect((await item.GET(json("GET"), ctx("does-not-exist"))).status).toBe(404);
  });
});

describe("PUT /api/invoices/:id (edit)", () => {
  it("persists edits and moves updatedAt forward", async () => {
    const inv = await create();
    await new Promise((r) => setTimeout(r, 5));
    const res = await item.PUT(json("PUT", validInput({ notes: "Edited", taxRate: 8.875 })), ctx(inv.id));
    expect(res.status).toBe(200);
    const saved = (await stored())[0];
    expect(saved).toMatchObject({ notes: "Edited", taxRate: 8.875 });
    expect(saved.updatedAt > inv.updatedAt).toBe(true);
  });

  it("does not save invalid edits", async () => {
    const inv = await create();
    const res = await item.PUT(json("PUT", validInput({ dueDate: "2020-01-01" })), ctx(inv.id));
    expect(res.status).toBe(400);
    expect((await stored())[0].dueDate).toBe("2026-10-31");
  });

  it("returns 404 when editing an unknown invoice", async () => {
    expect((await item.PUT(json("PUT", validInput()), ctx("nope"))).status).toBe(404);
  });
});

describe("DELETE /api/invoices/:id", () => {
  it("removes the invoice from storage", async () => {
    const keep = await create({ number: "INV-2026-0001" });
    const gone = await create({ number: "INV-2026-0002" });
    expect((await item.DELETE(json("DELETE"), ctx(gone.id))).status).toBe(204);
    expect((await stored()).map((i: { id: string }) => i.id)).toEqual([keep.id]);
    expect((await item.GET(json("GET"), ctx(gone.id))).status).toBe(404);
  });

  it("returns 404 when the invoice doesn't exist", async () => {
    expect((await item.DELETE(json("DELETE"), ctx("nope"))).status).toBe(404);
  });
});

describe("POST /api/invoices/:id/email", () => {
  it("sends the SAVED invoice and returns the provider result", async () => {
    const inv = await create();
    sendInvoiceEmail.mockResolvedValue({ messageId: "<m1>", previewUrl: null });
    const res = await email.POST(json("POST", { to: "me@example.test", message: "Hi" }), ctx(inv.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messageId: "<m1>", previewUrl: null });
    const [sentInvoice, to, message] = sendInvoiceEmail.mock.calls[0];
    expect(sentInvoice).toMatchObject({ id: inv.id, discountCents: 1000 });
    expect([to, message]).toEqual(["me@example.test", "Hi"]);
  });

  it("validates the recipient address", async () => {
    const inv = await create();
    const res = await email.POST(json("POST", { to: "not-an-email" }), ctx(inv.id));
    expect(res.status).toBe(400);
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for an unsaved invoice", async () => {
    const res = await email.POST(json("POST", { to: "me@example.test" }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the recipient isn't on the allow-list", async () => {
    const inv = await create();
    sendInvoiceEmail.mockRejectedValue(new emailErrors.RecipientNotAllowedError("Not allowed"));
    const res = await email.POST(json("POST", { to: "stranger@example.test" }), ctx(inv.id));
    expect(res.status).toBe(403);
    expect((await res.json()).fields.to).toBe("Not allowed");
  });

  it("returns 502 with a clear message when the SMTP provider fails", async () => {
    const inv = await create();
    sendInvoiceEmail.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await email.POST(json("POST", { to: "me@example.test" }), ctx(inv.id));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/email provider rejected/);
  });
});

describe("storage errors", () => {
  it("returns a useful 500 message when the storage file is corrupted", async () => {
    await writeFile(path.join(dataDir, "invoices.json"), "{not json");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await collection.GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("The invoice storage file is corrupted and couldn't be read.");
  });
});
