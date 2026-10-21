-- Invoices table for Folio.
-- Run once in the Supabase dashboard → SQL Editor (or `supabase db push`).

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  number         text        not null check (char_length(number) between 1 and 40),
  issue_date     date        not null,
  due_date       date        not null,
  -- { name, email, phone, address }
  business       jsonb       not null,
  customer       jsonb       not null,
  -- [{ id, description, quantity, unitPriceCents }]
  line_items     jsonb       not null default '[]'::jsonb,
  discount_cents bigint      not null default 0,
  -- percentage, e.g. 8.875
  tax_rate       numeric(6, 3) not null default 0,
  notes          text        not null default '',
  -- [{ id, label, value, visible }]
  custom_fields  jsonb       not null default '[]'::jsonb,
  accent         text        not null default 'ink',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Last line of defence; the API validates the same rules first.
  constraint invoices_discount_non_negative check (discount_cents >= 0),
  constraint invoices_tax_rate_range       check (tax_rate >= 0 and tax_rate <= 100),
  constraint invoices_due_after_issue      check (due_date >= issue_date),
  constraint invoices_line_items_is_array  check (jsonb_typeof(line_items) = 'array'),
  constraint invoices_custom_fields_array  check (jsonb_typeof(custom_fields) = 'array')
);

-- Dashboard lists invoices newest-edited first.
create index if not exists invoices_updated_at_idx on public.invoices (updated_at desc);

-- Lock the table down. With RLS on and no policies, the public "anon" and
-- "authenticated" keys can't read or write anything. Only the Next.js server,
-- using the secret service-role key (which bypasses RLS), can access invoices.
alter table public.invoices enable row level security;
