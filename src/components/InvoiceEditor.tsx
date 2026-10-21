"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draftTotals, emptyLine, invoiceToDraft, validateDraft, type DraftInvoice } from "@/lib/draft";
import { formatDate } from "@/lib/format";
import { formatUSD } from "@/lib/money";
import { ACCENTS, type Accent, type InvoiceInput, type Party } from "@/lib/schema";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { EmailDialog, type SendResult } from "./EmailDialog";
import { Field } from "./Field";
import {
  ArrowLeftIcon,
  BuildingIcon,
  CalculatorIcon,
  FileTextIcon,
  ListIcon,
  MailIcon,
  PaletteIcon,
  PrinterIcon,
  SaveIcon,
  TagIcon,
  UserIcon,
} from "./icons";
import { InvoicePreview } from "./InvoicePreview";
import { LineItemsEditor } from "./LineItemsEditor";

interface Props {
  initial: InvoiceInput;
  invoiceId: string | null;
  updatedAt: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

export function InvoiceEditor({ initial, invoiceId, updatedAt }: Props) {
  const [draft, setDraft] = useState<DraftInvoice>(() => invoiceToDraft(initial));
  const [id, setId] = useState(invoiceId);
  // Snapshot of the last saved draft; anything different is "unsaved".
  const [savedSnapshot, setSavedSnapshot] = useState(() => (invoiceId ? JSON.stringify(invoiceToDraft(initial)) : null));
  const [status, setStatus] = useState<Status>(updatedAt ? { kind: "saved", at: updatedAt } : { kind: "idle" });
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [emailOpen, setEmailOpen] = useState(false);
  const focusFirstError = useRef(false);

  const { input, errors } = useMemo(() => validateDraft(draft), [draft]);
  const totals = useMemo(() => draftTotals(draft), [draft]);
  const dirty = savedSnapshot !== JSON.stringify(draft);
  const errorCount = Object.keys(errors).length;

  const errorFor = useCallback(
    (key: string) => (showAllErrors || touched.has(key) ? errors[key] : undefined),
    [errors, showAllErrors, touched],
  );
  const touch = useCallback((key: string) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key))), []);

  const set = <K extends keyof DraftInvoice>(key: K, value: DraftInvoice[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setParty = (who: "business" | "customer", patch: Partial<Party>) =>
    setDraft((d) => ({ ...d, [who]: { ...d[who], ...patch } }));

  // Move focus to the first invalid field after a failed save.
  useEffect(() => {
    if (!focusFirstError.current) return;
    focusFirstError.current = false;
    const el = document.querySelector<HTMLElement>('.editor [aria-invalid="true"]');
    if (el) {
      setMobileView("edit");
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const router = useRouter();

  const save = useCallback(async (): Promise<string | null> => {
    if (!input) {
      setShowAllErrors(true);
      focusFirstError.current = true;
      setStatus({
        kind: "error",
        message: `Fix ${errorCount} ${errorCount === 1 ? "field" : "fields"} before saving.`,
      });
      return null;
    }
    const snapshot = JSON.stringify(draft);
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(id ? `/api/invoices/${id}` : "/api/invoices", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? `Save failed (${res.status}).` });
        return null;
      }
      const saved = body.invoice as { id: string; updatedAt: string };
      if (!id) {
        setId(saved.id);
        // Give the new invoice a real URL without remounting the editor.
        window.history.replaceState(null, "", `/invoices/${saved.id}`);
      }
      setSavedSnapshot(snapshot);
      setStatus({ kind: "saved", at: saved.updatedAt });
      return saved.id;
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server. Check your connection and try again." });
      return null;
    }
  }, [draft, errorCount, id, input]);

  // Save, then return to the invoice list where a success toast confirms it.
  const saveAndExit = useCallback(async () => {
    const savedId = await save();
    if (savedId) router.push(`/?saved=${encodeURIComponent(draft.number.trim())}`);
  }, [save, router, draft.number]);

  // Cmd/Ctrl + S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveAndExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAndExit]);

  const sendEmail = async (to: string, message: string): Promise<SendResult> => {
    const savedId = dirty || !id ? await save() : id;
    if (!savedId) {
      setEmailOpen(false);
      return { ok: false, error: "Save the invoice first." };
    }
    try {
      const res = await fetch(`/api/invoices/${savedId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error ?? "Sending failed.", fieldError: body.fields?.to };
      return { ok: true, previewUrl: body.previewUrl ?? null };
    } catch {
      return { ok: false, error: "Couldn't reach the server." };
    }
  };

  const defaultMessage = `Hi ${draft.customer.name.trim() || "there"},\n\nHere is invoice ${draft.number} for ${formatUSD(totals.total)}, due ${formatDate(draft.dueDate)}.\n\nThank you for your business!\n${draft.business.name}`;

  return (
    <div className={`editor-page view-${mobileView}`}>
      <header className="toolbar no-print">
        <div className="toolbar__left">
          <Link href="/" className="icon-btn" aria-label="All invoices" title="All invoices">
            <ArrowLeftIcon />
          </Link>
          <div className="toolbar__titles">
            <nav aria-label="Breadcrumb" className="crumbs">
              <Link href="/">Invoices</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{id ? "Edit" : "New"}</span>
            </nav>
            <h1 className="toolbar__title">{draft.number || "Untitled"}</h1>
          </div>
          <StatusPill status={status} dirty={dirty} hasId={!!id} />
        </div>
        <div className="toolbar__actions">
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
            <PrinterIcon /> <span className="btn__text">Print / PDF</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setEmailOpen(true)}>
            <MailIcon /> <span className="btn__text">Email</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void saveAndExit()}
            disabled={status.kind === "saving"}
            aria-keyshortcuts="Control+S Meta+S"
          >
            <SaveIcon /> {status.kind === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="segmented no-print" role="group" aria-label="Show">
        <button type="button" aria-pressed={mobileView === "edit"} onClick={() => setMobileView("edit")}>
          Edit
        </button>
        <button type="button" aria-pressed={mobileView === "preview"} onClick={() => setMobileView("preview")}>
          Preview · {formatUSD(totals.total)}
        </button>
      </div>

      <div className="workspace">
        <form className="editor no-print" onSubmit={(e) => e.preventDefault()} noValidate aria-label="Invoice details">
          {status.kind === "error" && (
            <p className="alert" role="alert">
              {status.message}
            </p>
          )}

          <Section id="details" icon={<FileTextIcon />} title="Invoice details" hint="Number and dates">
            <div className="grid grid--3">
              <Field
                name="number"
                label="Invoice number"
                required
                value={draft.number}
                onChange={(v) => set("number", v)}
                onBlur={() => touch("number")}
                error={errorFor("number")}
              />
              <Field
                name="issueDate"
                label="Issue date"
                type="date"
                required
                value={draft.issueDate}
                onChange={(v) => set("issueDate", v)}
                onBlur={() => touch("issueDate")}
                error={errorFor("issueDate")}
              />
              <Field
                name="dueDate"
                label="Due date"
                type="date"
                required
                value={draft.dueDate}
                onChange={(v) => set("dueDate", v)}
                onBlur={() => touch("dueDate")}
                error={errorFor("dueDate")}
              />
            </div>
          </Section>

          <Section id="from" icon={<BuildingIcon />} title="From" hint="Your business details">
            <PartyFields who="business" party={draft.business} onChange={setParty} errorFor={errorFor} touch={touch} />
          </Section>

          <Section id="to" icon={<UserIcon />} title="Bill to" hint="Who is paying this invoice">
            <PartyFields who="customer" party={draft.customer} onChange={setParty} errorFor={errorFor} touch={touch} />
          </Section>

          <Section id="items" icon={<ListIcon />} title="Line items" hint="Products or services">
            <LineItemsEditor
              items={draft.lineItems}
              lineTotals={totals.lineTotals}
              onChange={(items) => set("lineItems", items)}
              onAdd={() => set("lineItems", [...draft.lineItems, emptyLine()])}
              errorFor={errorFor}
              touch={touch}
              listError={showAllErrors ? errors.lineItems : undefined}
            />
          </Section>

          <Section id="totals" icon={<CalculatorIcon />} title="Discount & tax" hint="Discount is applied before tax">
            <div className="grid grid--2">
              <Field
                name="discount"
                label="Discount"
                hint="Fixed amount off the subtotal"
                prefix="$"
                inputMode="decimal"
                value={draft.discount}
                onChange={(v) => {
                  set("discount", v);
                  touch("discount");
                }}
                onBlur={() => touch("discount")}
                error={errorFor("discount")}
              />
              <Field
                name="taxRate"
                label="Tax rate"
                hint="Applied after the discount"
                suffix="%"
                inputMode="decimal"
                value={draft.taxRate}
                onChange={(v) => {
                  set("taxRate", v);
                  touch("taxRate");
                }}
                onBlur={() => touch("taxRate")}
                error={errorFor("taxRate")}
              />
            </div>
            <dl className="summary" aria-live="polite">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatUSD(totals.subtotal)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>−{formatUSD(totals.discount)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{formatUSD(totals.tax)}</dd>
              </div>
              <div className="summary__total">
                <dt>Total due</dt>
                <dd>{formatUSD(totals.total)}</dd>
              </div>
            </dl>
          </Section>

          <Section id="custom" icon={<TagIcon />} title="Custom fields" hint="Extra details — never affect totals">
            <CustomFieldsEditor
              fields={draft.customFields}
              onChange={(f) => set("customFields", f)}
              errorFor={errorFor}
              touch={touch}
            />
          </Section>

          <Section id="style" icon={<PaletteIcon />} title="Notes & branding" hint="Shown at the bottom of the invoice">
            <Field
              name="notes"
              label="Notes"
              hint="Payment instructions, thank-you note, terms…"
              multiline
              rows={4}
              value={draft.notes}
              onChange={(v) => set("notes", v)}
              onBlur={() => touch("notes")}
              error={errorFor("notes")}
            />
            <fieldset className="swatches">
              <legend className="field__label">Accent color</legend>
              <div className="swatches__row">
                {(Object.keys(ACCENTS) as Accent[]).map((key) => (
                  <label key={key} className="swatch" title={ACCENTS[key].label}>
                    <input
                      type="radio"
                      name="accent"
                      value={key}
                      checked={draft.accent === key}
                      onChange={() => set("accent", key)}
                    />
                    <span className="swatch__dot" style={{ background: ACCENTS[key].color }} aria-hidden="true" />
                    <span className="swatch__label">{ACCENTS[key].label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>
        </form>

        <div className="preview-pane">
          <div className="preview-pane__bar no-print">
            <span className="live-dot" aria-hidden="true" />
            Live preview
            <span className="muted">· US Letter</span>
          </div>
          <InvoicePreview draft={draft} totals={totals} />
        </div>
      </div>

      <EmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultTo={draft.customer.email}
        defaultMessage={defaultMessage}
        onSend={sendEmail}
      />
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  hint,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const headingId = `section-${id}`;
  return (
    <section className="panel" aria-labelledby={headingId}>
      <div className="panel__head">
        <span className="panel__icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 id={headingId}>{title}</h2>
          {hint && <p className="panel__hint">{hint}</p>}
        </div>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

function PartyFields({
  who,
  party,
  onChange,
  errorFor,
  touch,
}: {
  who: "business" | "customer";
  party: Party;
  onChange: (who: "business" | "customer", patch: Partial<Party>) => void;
  errorFor: (key: string) => string | undefined;
  touch: (key: string) => void;
}) {
  const props = (field: keyof Party) => ({
    name: `${who}.${field}`,
    value: party[field],
    onChange: (v: string) => onChange(who, { [field]: v }),
    onBlur: () => touch(`${who}.${field}`),
    error: errorFor(`${who}.${field}`),
  });
  const org = who === "business" ? "organization" : "off";
  return (
    <div className="grid grid--2">
      <Field {...props("name")} label={who === "business" ? "Business name" : "Customer name"} required autoComplete={org} />
      <Field {...props("email")} label="Email" type="email" inputMode="email" autoComplete={who === "business" ? "email" : "off"} />
      <Field {...props("phone")} label="Phone" type="tel" inputMode="tel" autoComplete={who === "business" ? "tel" : "off"} />
      <Field {...props("address")} label="Address" multiline rows={3} className="span-2" />
    </div>
  );
}

function StatusPill({ status, dirty, hasId }: { status: Status; dirty: boolean; hasId: boolean }) {
  let text: string;
  let tone: "ok" | "warn" | "busy" | "err";
  if (status.kind === "saving") [text, tone] = ["Saving…", "busy"];
  else if (status.kind === "error") [text, tone] = ["Not saved", "err"];
  else if (!hasId) [text, tone] = ["Draft — not saved yet", "warn"];
  else if (dirty) [text, tone] = ["Unsaved changes", "warn"];
  else
    [text, tone] = [
      `Saved ${status.kind === "saved" ? new Date(status.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`,
      "ok",
    ];
  return (
    // Saved time is locale/timezone dependent, so server and browser may differ.
    <span className={`pill pill--${tone}`} role="status" aria-live="polite" suppressHydrationWarning>
      {text}
    </span>
  );
}
