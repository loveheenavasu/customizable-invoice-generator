import "server-only";
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { calculateTotals } from "../money";
import type { InvoiceInput, InvoiceSummary } from "../schema";
import { fromRow, isUuid, toRow, type InvoiceRow } from "./supabase-mapping";
import { StorageError, type InvoiceStore } from "./types";

/**
 * Supabase (Postgres) store. Runs only on the server with the secret
 * service-role key; the table has RLS enabled with no policies, so the public
 * anon key can't touch it. `server-only` makes the build fail if this module
 * is ever imported into browser code.
 */

const TABLE = "invoices";

export function createSupabaseStore(url: string, serviceKey: string): InvoiceStore {
  const db: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fail = (action: string, error: PostgrestError | Error): never => {
    console.error(`Supabase ${action} failed`, error);
    const hint =
      // 42P01 = Postgres "undefined table"; PGRST205 = PostgREST can't find the table.
      "code" in error && (error.code === "42P01" || error.code === "PGRST205")
        ? " The invoices table is missing — run supabase/migrations/0001_create_invoices.sql."
        : "";
    throw new StorageError(`Database error: couldn't ${action} invoices. Please try again.${hint}`, { cause: error });
  };

  // Network failures reject instead of returning { error }; normalise both.
  const run = async <T>(action: string, query: PromiseLike<{ data: T; error: PostgrestError | null }>) => {
    let result: { data: T; error: PostgrestError | null };
    try {
      result = await query;
    } catch (err) {
      return fail(action, err as Error);
    }
    if (result.error) fail(action, result.error);
    return result.data;
  };

  return {
    async list() {
      // Fetch only what the dashboard needs, plus the numbers to total each invoice.
      const rows = await run(
        "load",
        db
          .from(TABLE)
          .select("id, number, customer, issue_date, due_date, line_items, discount_cents, tax_rate, updated_at")
          .order("updated_at", { ascending: false }),
      );
      return (rows ?? []).map(
        (r): InvoiceSummary => ({
          id: r.id,
          number: r.number,
          customerName: r.customer?.name ?? "",
          issueDate: r.issue_date,
          dueDate: r.due_date,
          totalCents: calculateTotals({
            lineItems: r.line_items ?? [],
            discountCents: Number(r.discount_cents),
            taxRate: Number(r.tax_rate),
          }).total,
          updatedAt: r.updated_at,
        }),
      );
    },

    async get(id) {
      if (!isUuid(id)) return null;
      const row = await run("load", db.from(TABLE).select("*").eq("id", id).maybeSingle<InvoiceRow>());
      return row ? fromRow(row) : null;
    },

    async latest() {
      const row = await run(
        "load",
        db.from(TABLE).select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle<InvoiceRow>(),
      );
      return row ? fromRow(row) : null;
    },

    async count() {
      let result;
      try {
        result = await db.from(TABLE).select("id", { count: "exact", head: true });
      } catch (err) {
        return fail("count", err as Error);
      }
      if (result.error) fail("count", result.error);
      return result.count ?? 0;
    },

    async create(input: InvoiceInput) {
      const row = await run("save", db.from(TABLE).insert(toRow(input)).select("*").single<InvoiceRow>());
      if (!row) return fail("save", new Error("Insert returned no row"));
      return fromRow(row);
    },

    async update(id, input) {
      if (!isUuid(id)) return null;
      const row = await run(
        "save",
        db
          .from(TABLE)
          .update({ ...toRow(input), updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("*")
          .maybeSingle<InvoiceRow>(),
      );
      return row ? fromRow(row) : null;
    },

    async remove(id) {
      if (!isUuid(id)) return false;
      const rows = await run("delete", db.from(TABLE).delete().eq("id", id).select("id"));
      return (rows?.length ?? 0) > 0;
    },
  };
}
