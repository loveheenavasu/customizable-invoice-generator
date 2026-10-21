"use client";

/** Shown when a page fails to load, e.g. the invoice storage can't be read. */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page page--narrow">
      <h1>Something went wrong</h1>
      <p className="muted">
        {error.message.includes("storage")
          ? error.message
          : "We couldn't load this page. Your saved invoices are safe — please try again."}
      </p>
      <button type="button" className="btn btn--primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
