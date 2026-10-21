import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page page--narrow">
      <h1>Invoice not found</h1>
      <p className="muted">It may have been deleted.</p>
      <Link href="/" className="btn btn--primary">
        Back to invoices
      </Link>
    </div>
  );
}
