# Folio: Customizable Invoice Generator

A browser-based invoice tool for a small business. Edit an invoice with a live preview, add custom fields, save and reopen invoices, print or save to PDF, and email invoices through any SMTP provider.

> All names, addresses and emails in the app and this repo are fictional (`*.example` domains).

## Features

| Requirement | How it's handled |
| --- | --- |
| Invoice editor | Business and customer details, invoice number, issue and due dates, notes. You can add, edit and remove line items (description, quantity, unit price). |
| USD totals | Each line is rounded to cents, then summed into the subtotal. The fixed discount is subtracted, then tax is calculated and rounded to cents. All math uses integer cents ([`src/lib/money.ts`](src/lib/money.ts)). |
| Custom fields | Add, edit, hide/show and remove. Quick-add chips for common labels (PO number, Project…). Visible fields print on the invoice and appear in the email. They never affect totals. |
| Live preview and PDF | The preview re-renders on every keystroke. **Print / PDF** uses the browser print dialog, and print CSS outputs only the invoice paper: no controls, and hidden fields are never rendered. |
| Responsive | Two columns on desktop (editor and sticky preview). On tablet and phone it switches to Edit/Preview tabs, and line items become stacked cards. |
| Accessibility | Every input has a real `<label>`. Visible focus rings, keyboard-only flow, focus moves to new rows and fields, errors linked with `aria-describedby`, live status for saving, native `<dialog>` for email, skip link, AA contrast, reduced-motion support. |
| Validation | Negative quantities, prices, discounts and tax rates are rejected. The discount can't exceed the subtotal, and the due date can't be before the issue date. Errors show after a field loses focus, or on Save (which also moves focus to the first problem). The server re-validates with the same Zod schema. |
| Database | **Supabase (Postgres)**, accessed only from the server with the secret key; the table has Row Level Security on with no public policies. Falls back to a local JSON file when Supabase isn't configured. |
| Backend | Next.js route handlers: `GET/POST /api/invoices`, `GET/PUT/DELETE /api/invoices/:id`, `POST /api/invoices/:id/email`. |
| Email | Sent with Nodemailer over SMTP. Credentials stay server-side. The email is built from the **saved** invoice and totals are recomputed on the server. |

**Check from the brief:** 2 × $50 − $10 discount + 10% tax = **$99.00**. This is covered by automated tests (see [Tests](#tests)).

## Tech stack

The brief allows any stack, so I chose:

- **Next.js 15 (App Router) + React 19 + TypeScript**: one project for UI and API, server components load invoices directly.
- **Zod**: one schema shared by browser and server.
- **Nodemailer**: works with any SMTP provider (Resend, Postmark, SendGrid, Mailtrap, Gmail app password…).
- **Supabase (Postgres)** via `@supabase/supabase-js`: the database. A local JSON file is used automatically when Supabase isn't configured.
- **Vitest**: unit tests for the money math and validation.
- Plain CSS with design tokens (no UI framework). Fonts: Geist and Geist Mono via `next/font`.

## Run it locally

Requires Node 18.18+ (tested on Node 20). Node 22+ is recommended, because newer `@supabase/supabase-js` releases print a deprecation warning on Node 20.

```bash
npm install
cp .env.example .env.local   # optional: fill in SMTP to send real email
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm test           # unit tests
npm run typecheck  # tsc --noEmit
npm run build && npm start   # production build
```

## Tests

```bash
npm test             # run everything once
npm run test:watch   # re-run on save
```

All tests live in [`tests/`](tests). They never touch Supabase or send real email: the setup clears those settings, the API tests use a temporary folder for storage, and email uses a fake SMTP server.

| Folder | What it covers |
| --- | --- |
| `tests/unit/money.test.ts` | Rounding each line to cents, discount before tax, tax rounding, **the $99.00 check**, parsing dollar input |
| `tests/unit/schema.test.ts` | Server validation: no negative quantity, price, discount or tax; discount ≤ subtotal; due ≥ issue date; required fields; email format |
| `tests/unit/draft.test.ts` | Editor validation and live error messages |
| `tests/unit/defaults.test.ts` | Invoice numbering (never reuses a number after a delete) |
| `tests/unit/email.test.ts` | Email subject and totals, hidden custom fields excluded, HTML escaped, recipient allow-list |
| `tests/unit/format.test.ts`, `supabase-mapping.test.ts` | Date and quantity formatting; database row mapping |
| `tests/integration/api.test.ts` | The REST API end to end: create, list, retrieve, edit, delete, validation errors, email success and failure, storage errors |
| `tests/components/InvoicePreview.test.tsx` | The invoice (and printed output): totals, visible vs hidden custom fields, placeholders, accent color, escaping |

## Database setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/migrations/0001_create_invoices.sql`](supabase/migrations/0001_create_invoices.sql) and click **Run**. This creates the `invoices` table with constraints and turns on Row Level Security.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (labelled "secret" in newer dashboards) → `SUPABASE_SERVICE_ROLE_KEY`
4. Put both in `.env.local` and restart `npm run dev`.

**Security model:** the browser never talks to Supabase. Every read and write goes through the Next.js API, which validates with Zod and then uses the service-role key on the server. The table has RLS enabled with **no policies**, so the public `anon` key can't read or write anything even if someone has it. The `server-only` import makes the build fail if database code is ever pulled into browser code. The database also enforces non-negative discounts, a 0–100% tax rate and due date ≥ issue date as a last line of defence.

**Table design:** one `invoices` row per invoice. Scalar fields are real columns (`number`, `issue_date`, `due_date`, `discount_cents`, `tax_rate`…). Line items, custom fields and the business/customer details are `jsonb`, because they are always read and written together with their invoice. That keeps every save a single atomic write, with no multi-table transaction needed.

### Without Supabase (local fallback)

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both empty, invoices are stored in `./data/invoices.json` (change the folder with `DATA_DIR`). This is handy for a quick local run. Writes are serialised and atomic (write-then-rename), and the file is git-ignored. If only one of the two Supabase variables is set, the app reports an error instead of quietly writing to the file.

## Email setup

Set these in `.env.local` (see [`.env.example`](.env.example)):

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP server. Use `SMTP_SECURE=true` for port 465, `false` for 587/STARTTLS |
| `SMTP_USER`, `SMTP_PASS` | SMTP credentials (server-side only, never sent to the browser) |
| `EMAIL_FROM` | Sender, e.g. `"Juniper & Pine <invoices@yourdomain.com>"`. It must be allowed by your provider |
| `EMAIL_ALLOWED_RECIPIENTS` | Optional comma-separated allow-list. While testing, set it to your own address so mail can only go to an inbox you control |

**No SMTP configured?** In development the server falls back to an [Ethereal](https://ethereal.email) throwaway inbox. Nothing is delivered, and the dialog shows a link to preview the email. In production, a missing SMTP config returns a clear 503 error instead.

SMTP connections time out after 10–20 seconds, so a misconfigured provider shows an error instead of hanging.

## Project structure

```
src/
  app/
    page.tsx                     Dashboard: list of saved invoices
    invoices/new/page.tsx        New invoice (prefills business details from the last invoice)
    invoices/[id]/page.tsx       Load a saved invoice into the editor
    api/invoices/...             REST route handlers
    globals.css                  Design tokens, layout, responsive and print styles
  components/
    InvoiceEditor.tsx            State, validation display, save/email/print actions
    InvoicePreview.tsx           The invoice "paper" (also what prints)
    LineItemsEditor.tsx          Line item rows
    CustomFieldsEditor.tsx       Custom fields with show/hide
    EmailDialog.tsx              Native <dialog> for sending
    Field.tsx                    Accessible labelled input with error/hint
  lib/
    money.ts                     Integer-cent math, parsing and formatting
    schema.ts                    Zod schema: the single source of truth for validation
    draft.ts                     Editor state (string inputs) → validated invoice
    store/index.ts               Picks the storage driver (Supabase or local file)
    store/supabase.ts            Supabase/Postgres driver (server-only)
    store/supabase-mapping.ts    Row <-> invoice mapping
    store/file.ts                Local JSON-file driver
supabase/migrations/             SQL to create the invoices table (+ RLS)
tests/
  unit/                          Money math, validation rules, numbering, formatting, email, DB mapping
  integration/                   The REST API end to end (create, list, edit, delete, email, errors)
  components/                    The invoice preview / printed output
  support/                       Shared fixtures and test setup
    email.ts                     SMTP transport and HTML/text email rendering
```

## Decisions

- **Integer cents everywhere.** Dollar strings are parsed digit by digit (`"1.15"` becomes exactly `115`), never through floats. Rounding is half away from zero, applied per line and then to tax, in the order the brief specifies.
- **Draft vs. saved shape.** The editor keeps numbers as the raw strings you typed, so `12.` or an empty box can exist mid-edit. Each render parses them for the preview and validation. Unparseable values count as $0 in the preview and block saving.
- **Errors keyed by row id, not index.** Deleting a line doesn't move an error onto the wrong row.
- **One schema, two places.** The same Zod schema runs in the browser for instant feedback and on the server as the real gate.
- **Email from the saved record.** Sending saves first, then the server renders the email from storage, so the email can't show numbers the database doesn't have.
- **Recipient allow-list.** An optional guard so test runs can't email real customers by accident.
- **Native `<dialog>`** gives focus trapping, Esc to close and a backdrop with no library.
- **Business details carry over** from the most recent invoice, and invoice numbers auto-increment (`INV-2026-0002`).
- **Design.** Styled after [tasteskill.dev](https://www.tasteskill.dev/): a warm off-white page (`#f5f4f2`), white cards with hairline borders instead of shadows, black pill buttons, near-black text with tight heading letter-spacing, one dark featured card and a small orange accent. Geist and Geist Mono throughout. The invoice has five accent colors (Ink by default, Ember, Indigo, Emerald, Rose).

## Time spent

3 hours

## Unfinished work and limitations

- **No authentication or multi-user support.** It isn't required by the brief, but anyone who can reach the server can read and edit invoices.

