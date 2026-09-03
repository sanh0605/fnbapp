# FNB App

Point-of-sale and back-office system for a small takeaway drinks shop with two
points of sale and a shared inventory. This file covers only how to run the app
and the gates a change must pass.

New to the codebase? Start with [`docs/01-system/SYSTEM-OVERVIEW.md`](docs/01-system/SYSTEM-OVERVIEW.md).
Business context and scope live in [`CONTEXT.md`](CONTEXT.md); team protocol is
in [`CLAUDE.md`](CLAUDE.md).

## Stack

Verified against `package.json`:

- **Next.js** `^14.2.3` (App Router), **React** `^18`, **TypeScript** `^5`,
  **Tailwind CSS** `^3.4.1`.
- **NextAuth** `^4.24.14` (Credentials provider); credentials are checked
  against user data in Supabase Postgres.
- **Supabase Postgres** via `@supabase/supabase-js` `^2.108.2` — RPCs,
  migrations under `supabase/migrations/`, and Edge Functions. No Supabase Auth
  or Supabase Storage is wired up.
- **Vitest** `^4.1.10` with **fast-check** `^3.23.2`, **jsdom**, and
  **fake-indexeddb** for tests; `@vitest/coverage-v8` for coverage.
- **vite-node** `^6` runs the TypeScript maintenance scripts and doc gates.
- **husky** `^9.1.7` installs the pre-commit hook.
- **googleapis** `^137` drives scheduled full-database snapshots to Google
  Sheets/Drive.
- Utility libraries: `date-fns`, `lucide-react`, `react-datepicker`,
  `bcryptjs`.

## Local setup

### Prerequisites

- Node.js compatible with Next.js 14.
- npm.
- Access to approved development environment values. Never copy production
  secrets into documentation or commit them.

### Commands

All from `package.json`:

```bash
npm install        # install dependencies (runs husky "prepare")
npm run dev        # next dev  — local development server
npm run build      # next build — production build
npm start          # next start — serve a production build
npm test           # vitest run — full test suite once
npm run test:watch # vitest — watch mode
npm run lint       # next lint
```

### Environment variables

The app needs runtime configuration for the database (Supabase), authentication,
and the scheduled backup. The authoritative list of variable names and their
values lives in the approved secret manager and in a local `.env.local` (never
committed) — not in this file.

Get the current set from the secret manager or the project owner. Do not list
secret variable names or values in this repo, issues, docs, screenshots, or
commits — naming them publicly is a map for an attacker.

## Gates a change must pass

A change is not done until all of these are clean (see `CLAUDE.md` section 9):

```bash
npx tsc --noEmit                              # 0 type errors
npx vitest run                                # all tests green
npx vite-node scripts/check-rules-current.ts  # no rule/doc path drift
npx vite-node scripts/doc-checks/run-blocking.ts  # doc gates agree with code
npm run build                                 # production build succeeds
```

`npm run build` is not replaceable by the other gates: a broken build can slip
past a green tsc/vitest run.

The **pre-commit hook** (`.husky/pre-commit`) automatically runs, in order,
`tsc --noEmit`, `check-rules-current.ts`, and the doc gates
(`scripts/doc-checks/run-blocking.ts`), and blocks the commit on any failure. It
does **not** run the test suite or the build — run those yourself before
committing.

## Deployment

- Deploy region is **Singapore (`sin1`)** — the same region as the Supabase
  Postgres database, which is in Singapore. This is a Vercel project setting,
  **not** in source: it survives no code check, so a re-link or re-create of the
  project can silently lose it. Vercel's default region is Washington; running
  the app there makes DB round-trips slow and has caused page failures.
- Do not push local commits or deploy unless the owner explicitly asks.

## Safety and production operations

- Read-only inspection does not authorize production writes.
- Any historical data correction requires an approved plan, a dry-run, an atomic
  apply path, verification, and rollback evidence.
- Schema changes go through reviewed Supabase migrations; never edit production
  structure by hand.
- A successful backup does not authorize a restore; restores need their own
  reviewed plan.

## Documentation map

The docs tree is organized by purpose:

| Directory | Contents |
|---|---|
| [`docs/01-system/`](docs/01-system/) | System overview and map — start here |
| [`docs/02-rules/`](docs/02-rules/) | Business rules (by domain) and glossary |
| [`docs/03-workflows/`](docs/03-workflows/) | How each workflow works (sales, purchasing, stocktake, etc.) |
| [`docs/04-operations/`](docs/04-operations/) | Open items and incident response |

See also [`ARCHITECTURE.md`](ARCHITECTURE.md) for boundaries and
[`docs/ACCESS-MODEL.md`](docs/ACCESS-MODEL.md) for access rules.
