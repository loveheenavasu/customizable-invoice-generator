import "server-only";
import type { InvoiceInput } from "../schema";
import { fileStore } from "./file";
import { createSupabaseStore } from "./supabase";
import { StorageError, type InvoiceStore } from "./types";

export { StorageError } from "./types";

/**
 * Picks the storage driver from env:
 * - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set → Supabase (Postgres)
 * - neither set → local JSON file in DATA_DIR (zero-setup development)
 */
function pickStore(): InvoiceStore {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // Misconfiguration fails loudly rather than silently writing to a local file.
  if (url && key && isPublicKey(key)) {
    return misconfigured(
      "SUPABASE_SERVICE_ROLE_KEY holds the public anon/publishable key. Use the service_role (secret) key from Project Settings → API.",
    );
  }
  if (url && key) return createSupabaseStore(url, key);
  if (url || key) {
    const missing = url ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_URL";
    return misconfigured(`Supabase is half-configured: ${missing} is missing.`);
  }
  return fileStore;
}

function misconfigured(message: string): InvoiceStore {
  return new Proxy({} as InvoiceStore, {
    get: () => () => Promise.reject(new StorageError(message)),
  });
}

/** The anon key can't write through RLS, so using it here is always a mix-up. */
function isPublicKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"));
    return payload?.role === "anon";
  } catch {
    return false; // not a JWT (e.g. sb_secret_…) — fine
  }
}

const store = pickStore();

export const listInvoices = () => store.list();
export const getInvoice = (id: string) => store.get(id);
export const getLatestInvoice = () => store.latest();
export const countInvoices = () => store.count();
export const createInvoice = (input: InvoiceInput) => store.create(input);
export const updateInvoice = (id: string, input: InvoiceInput) => store.update(id, input);
export const deleteInvoice = (id: string) => store.remove(id);
