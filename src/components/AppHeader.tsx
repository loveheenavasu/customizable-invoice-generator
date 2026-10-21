import Link from "next/link";
import { LogoMark } from "./icons";

export function AppHeader() {
  return (
    <header className="appbar no-print">
      <div className="appbar__inner">
        <Link href="/" className="logo" aria-label="Folio home">
          <LogoMark />
          <span>Folio</span>
        </Link>
        <nav aria-label="Main">
          <Link href="/" className="appbar__link">
            Invoices
          </Link>
        </nav>
      </div>
    </header>
  );
}
