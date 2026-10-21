"use client";

import type { ReactNode } from "react";
import { fieldId } from "@/lib/draft";

interface FieldProps {
  /** Validation key, e.g. "customer.email". Also derives the DOM id. */
  name: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "email" | "tel" | "date";
  inputMode?: "text" | "decimal" | "email" | "tel" | "numeric";
  autoComplete?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
}

export function Field({
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  required,
  multiline,
  rows = 3,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  prefix,
  suffix,
  hideLabel,
  className,
}: FieldProps) {
  const id = fieldId(name);
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const common = {
    id,
    name,
    value,
    onBlur,
    required,
    placeholder,
    autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;

  return (
    <div className={`field ${error ? "field--error" : ""} ${className ?? ""}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only field__label--hidden" : "field__label"}>
        {label}
        {required && !hideLabel && (
          <span className="field__req" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className={`input-wrap ${prefix ? "input-wrap--prefix" : ""} ${suffix ? "input-wrap--suffix" : ""}`}>
          {prefix && (
            <span className="input-adorn input-adorn--start" aria-hidden="true">
              {prefix}
            </span>
          )}
          <input
            {...common}
            type={type}
            inputMode={inputMode}
            onChange={(e) => onChange(e.target.value)}
            // Number boxes select their contents on focus so typing replaces "0.00".
            onFocus={inputMode === "decimal" ? (e) => e.currentTarget.select() : undefined}
          />
          {suffix && (
            <span className="input-adorn input-adorn--end" aria-hidden="true">
              {suffix}
            </span>
          )}
        </div>
      )}
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
