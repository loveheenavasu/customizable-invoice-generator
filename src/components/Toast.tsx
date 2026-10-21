"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "./icons";

/**
 * One-shot success toast. Announced to screen readers via role="status",
 * auto-dismisses after a few seconds, and can be closed manually.
 */
export function Toast({ message, onDone }: { message: string; onDone?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) onDone?.();
  }, [visible, onDone]);

  if (!visible) return null;
  return (
    <div className="toast no-print" role="status" aria-live="polite">
      <span className="toast__icon" aria-hidden="true">
        ✓
      </span>
      <span className="toast__text">{message}</span>
      <button type="button" className="toast__close" onClick={() => setVisible(false)} aria-label="Dismiss">
        <CloseIcon />
      </button>
    </div>
  );
}

/**
 * Shows the "saved" toast passed from the editor via ?saved=<number>, then
 * strips the query so a refresh doesn't show it again.
 */
export function SavedToast({ invoiceNumber }: { invoiceNumber: string | null }) {
  useEffect(() => {
    if (invoiceNumber) window.history.replaceState(null, "", window.location.pathname);
  }, [invoiceNumber]);
  if (!invoiceNumber) return null;
  return <Toast message={`Invoice ${invoiceNumber} saved successfully.`} />;
}
