"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "./Field";
import { CloseIcon, MailIcon } from "./icons";

export type SendResult =
  | { ok: true; previewUrl: string | null }
  | { ok: false; error: string; fieldError?: string };

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTo: string;
  defaultMessage: string;
  onSend: (to: string, message: string) => Promise<SendResult>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Native <dialog>: focus trapping, Esc to close and backdrop come for free. */
export function EmailDialog({ open, onClose, defaultTo, defaultMessage, onSend }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState(defaultMessage);
  const [toError, setToError] = useState<string>();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "sent"; previewUrl: string | null } | { kind: "error"; error: string }
  >({ kind: "idle" });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTo(defaultTo);
      setMessage(defaultMessage);
      setToError(undefined);
      setState({ kind: "idle" });
      dialog.showModal();
      // Start in the recipient box rather than on the close button.
      document.getElementById("f-email-to")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // Only reset when the dialog opens, not on every parent keystroke.
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(to.trim())) {
      setToError("Enter a valid email address, e.g. name@example.com");
      document.getElementById("f-email-to")?.focus();
      return;
    }
    setToError(undefined);
    setState({ kind: "sending" });
    const result = await onSend(to.trim(), message);
    if (result.ok) {
      setState({ kind: "sent", previewUrl: result.previewUrl });
    } else {
      setState({ kind: "error", error: result.error });
      if (result.fieldError) setToError(result.fieldError);
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="email-title">
      <form onSubmit={submit} noValidate>
        <header className="dialog__head">
          <h2 id="email-title">Email invoice</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        {state.kind === "sent" ? (
          <div className="dialog__body" role="status">
            <p className="success">✓ Invoice sent to {to}.</p>
            {state.previewUrl && (
              <p className="muted">
                No SMTP server is configured, so this went to a test inbox.{" "}
                <a href={state.previewUrl} target="_blank" rel="noreferrer">
                  Open the email preview
                </a>
                .
              </p>
            )}
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog__body">
            <p className="muted">The invoice is saved first, then sent from the server using the saved version.</p>
            <Field
              name="email-to"
              label="Send to"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={to}
              onChange={setTo}
              error={toError}
            />
            <Field name="email-message" label="Message" multiline rows={6} value={message} onChange={setMessage} />
            {state.kind === "error" && (
              <p className="alert" role="alert">
                {state.error}
              </p>
            )}
            <div className="dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={state.kind === "sending"}>
                <MailIcon /> {state.kind === "sending" ? "Sending…" : "Send invoice"}
              </button>
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}
