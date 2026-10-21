import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Invoice, InvoiceInput } from "../schema";
import { StorageError, toSummary, type InvoiceStore } from "./types";

/**
 * Local JSON-file store — the zero-setup fallback when Supabase isn't
 * configured. One file, whole-file rewrites, writes serialised through a
 * promise queue and committed with write-then-rename so a crash can't leave
 * half a file behind. Fine for local development; use Supabase for real data.
 */

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const FILE = path.join(DATA_DIR, "invoices.json");

let queue: Promise<unknown> = Promise.resolve();
function serialised<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<Invoice[]> {
  let raw: string;
  try {
    raw = await fs.readFile(FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new StorageError("Couldn't read saved invoices from storage.", { cause: err });
  }
  try {
    const parsed = JSON.parse(raw) as { invoices?: Invoice[] };
    return parsed.invoices ?? [];
  } catch (err) {
    throw new StorageError("The invoice storage file is corrupted and couldn't be read.", { cause: err });
  }
}

async function writeAll(invoices: Invoice[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ invoices }, null, 2), "utf8");
    await fs.rename(tmp, FILE);
  } catch (err) {
    throw new StorageError("Couldn't save to storage. Check that the data folder is writable.", { cause: err });
  }
}

export const fileStore: InvoiceStore = {
  async list() {
    const invoices = await readAll();
    return invoices.map(toSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id) {
    return (await readAll()).find((inv) => inv.id === id) ?? null;
  },

  async latest() {
    const all = await readAll();
    return all.reduce<Invoice | null>((latest, inv) => (!latest || inv.updatedAt > latest.updatedAt ? inv : latest), null);
  },

  async count() {
    return (await readAll()).length;
  },

  create(input: InvoiceInput) {
    return serialised(async () => {
      const all = await readAll();
      const now = new Date().toISOString();
      const invoice: Invoice = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      await writeAll([...all, invoice]);
      return invoice;
    });
  },

  update(id, input) {
    return serialised(async () => {
      const all = await readAll();
      const index = all.findIndex((inv) => inv.id === id);
      if (index === -1) return null;
      const updated: Invoice = { ...input, id, createdAt: all[index].createdAt, updatedAt: new Date().toISOString() };
      all[index] = updated;
      await writeAll(all);
      return updated;
    });
  },

  remove(id) {
    return serialised(async () => {
      const all = await readAll();
      const next = all.filter((inv) => inv.id !== id);
      if (next.length === all.length) return false;
      await writeAll(next);
      return true;
    });
  },
};
