import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { StorageError } from "./store";

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** 400 with a flat `{ path: message }` map the editor can show next to fields. */
export function badRequest(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
  return NextResponse.json({ error: "Some fields need attention.", fields }, { status: 400 });
}

export const notFound = () => NextResponse.json({ error: "Invoice not found." }, { status: 404 });

/**
 * Wrap a route handler so storage failures become a JSON error the UI can
 * show, instead of an opaque 500 page.
 */
export function withErrorHandling<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof StorageError ? err.message : "Something went wrong on the server. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
