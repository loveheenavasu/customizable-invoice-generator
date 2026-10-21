"use client";

import { useEffect, useRef } from "react";
import { fieldId, type DraftLine } from "@/lib/draft";
import { formatUSD } from "@/lib/money";
import { Field } from "./Field";
import { PlusIcon, TrashIcon } from "./icons";

interface Props {
  items: DraftLine[];
  lineTotals: number[];
  onChange: (items: DraftLine[]) => void;
  onAdd: () => void;
  errorFor: (key: string) => string | undefined;
  touch: (key: string) => void;
  listError?: string;
}

export function LineItemsEditor({ items, lineTotals, onChange, onAdd, errorFor, touch, listError }: Props) {
  // Focus the description of a newly added row so keyboard users can keep typing.
  const prevCount = useRef(items.length);
  useEffect(() => {
    if (items.length > prevCount.current) {
      document.getElementById(fieldId(`lineItems.${items[items.length - 1].id}.description`))?.focus();
    }
    prevCount.current = items.length;
  }, [items]);

  const update = (id: string, patch: Partial<DraftLine>) =>
    onChange(items.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const remove = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    // Keep focus in the list rather than dropping it on <body>.
    const neighbour = next[Math.min(index, next.length - 1)];
    if (neighbour) {
      requestAnimationFrame(() => document.getElementById(fieldId(`lineItems.${neighbour.id}.description`))?.focus());
    }
  };

  return (
    <div className="lines">
      <div className="lines__head" aria-hidden="true">
        <span>Description</span>
        <span className="num">Qty</span>
        <span className="num">Unit price</span>
        <span className="num">Amount</span>
        <span />
      </div>

      <ol className="lines__list">
        {items.map((l, i) => {
          const key = (f: string) => `lineItems.${l.id}.${f}`;
          const n = i + 1;
          return (
            <li key={l.id} className="line">
              <Field
                className="line__desc"
                name={key("description")}
                label={
                  <>
                    Description
                    <span className="sr-only">, line {n}</span>
                  </>
                }
                hideLabel
                placeholder="e.g. Walnut dining table"
                value={l.description}
                onChange={(v) => update(l.id, { description: v })}
                onBlur={() => touch(key("description"))}
                error={errorFor(key("description"))}
              />
              <Field
                className="line__qty"
                name={key("quantity")}
                label={
                  <>
                    Quantity
                    <span className="sr-only">, line {n}</span>
                  </>
                }
                hideLabel
                inputMode="decimal"
                value={l.quantity}
                onChange={(v) => update(l.id, { quantity: v })}
                onBlur={() => touch(key("quantity"))}
                error={errorFor(key("quantity"))}
              />
              <Field
                className="line__price"
                name={key("unitPrice")}
                label={
                  <>
                    Unit price
                    <span className="sr-only"> in USD, line {n}</span>
                  </>
                }
                hideLabel
                prefix="$"
                inputMode="decimal"
                placeholder="0.00"
                value={l.unitPrice}
                onChange={(v) => update(l.id, { unitPrice: v })}
                onBlur={() => touch(key("unitPrice"))}
                error={errorFor(key("unitPrice"))}
              />
              <p className="line__total num" aria-label={`Amount, line ${n}`}>
                {formatUSD(lineTotals[i] ?? 0)}
              </p>
              <button
                type="button"
                className="icon-btn icon-btn--danger line__remove"
                onClick={() => remove(i)}
                disabled={items.length === 1}
                aria-label={`Remove line ${n}${l.description ? `: ${l.description}` : ""}`}
                title={items.length === 1 ? "An invoice needs at least one line" : "Remove line"}
              >
                <TrashIcon />
              </button>
            </li>
          );
        })}
      </ol>

      {listError && <p className="field__error">{listError}</p>}

      <button type="button" className="btn btn--ghost" onClick={onAdd}>
        <PlusIcon /> Add line item
      </button>
    </div>
  );
}
