"use client";

import { useEffect, useRef } from "react";
import { fieldId, newId } from "@/lib/draft";
import type { CustomField } from "@/lib/schema";
import { Field } from "./Field";
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "./icons";

const SUGGESTIONS = ["PO number", "Project", "Payment terms", "Tax ID"];

interface Props {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  errorFor: (key: string) => string | undefined;
  touch: (key: string) => void;
}

export function CustomFieldsEditor({ fields, onChange, errorFor, touch }: Props) {
  // After adding, focus the label (blank field) or the value (suggested label).
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    if (focusTarget.current) {
      document.getElementById(focusTarget.current)?.focus();
      focusTarget.current = null;
    }
  }, [fields]);

  const add = (label = "") => {
    const field: CustomField = { id: newId(), label, value: "", visible: true };
    focusTarget.current = fieldId(`customFields.${field.id}.${label ? "value" : "label"}`);
    onChange([...fields, field]);
  };
  const update = (id: string, patch: Partial<CustomField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  const unused = SUGGESTIONS.filter((s) => !fields.some((f) => f.label.trim().toLowerCase() === s.toLowerCase()));

  return (
    <div className="cfields">
      {fields.length === 0 && (
        <p className="muted">Add extra details like a PO number or project name. They appear on the invoice but never change the totals.</p>
      )}

      <ul className="cfields__list">
        {fields.map((f, i) => {
          const key = (k: string) => `customFields.${f.id}.${k}`;
          const name = f.label.trim() || `custom field ${i + 1}`;
          return (
            <li key={f.id} className={`cfield ${f.visible ? "" : "cfield--hidden"}`}>
              <Field
                name={key("label")}
                label="Label"
                placeholder="e.g. PO number"
                value={f.label}
                onChange={(v) => update(f.id, { label: v })}
                onBlur={() => touch(key("label"))}
                error={errorFor(key("label"))}
              />
              <Field
                name={key("value")}
                label="Value"
                placeholder="e.g. 4471-B"
                value={f.value}
                onChange={(v) => update(f.id, { value: v })}
                onBlur={() => touch(key("value"))}
                error={errorFor(key("value"))}
              />
              <div className="cfield__actions">
                <button
                  type="button"
                  className={`toggle ${f.visible ? "toggle--on" : ""}`}
                  aria-pressed={f.visible}
                  aria-label={`Show ${name} on invoice`}
                  onClick={() => update(f.id, { visible: !f.visible })}
                >
                  {f.visible ? <EyeIcon /> : <EyeOffIcon />}
                  <span aria-hidden="true">{f.visible ? "Shown" : "Hidden"}</span>
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label={`Remove ${name}`}
                  title="Remove field"
                  onClick={() => remove(f.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="cfields__add">
        <button type="button" className="btn btn--ghost" onClick={() => add()}>
          <PlusIcon /> Add custom field
        </button>
        {unused.length > 0 && (
          <div className="chips" role="group" aria-label="Quick add">
            {unused.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => add(s)}>
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
