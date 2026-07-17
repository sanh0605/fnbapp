# FNB App Architecture

Status: canonical runtime overview

Last verified: 2026-07-17

## Purpose and evidence boundary

This document describes the current runtime shape, major modules, trust boundaries, and reliability controls. It intentionally avoids a generated file-by-file map. Detailed business rules, access intent, and historical audit evidence live in the linked Tier 2 and Tier 3 documents.

`OBSERVED` means the repository contains the described path. `VERIFIED` means a reviewed test or production check supports the claim. Intended controls that are not yet verified are labeled explicitly.

## Runtime components

### Browser application

- Next.js 14 and React 18 render the POS, login, settings, and administration surfaces.
- Client Components handle interaction and receive data from Server Components or Server Actions.
- The browser is an untrusted boundary. Service-role keys and backup tokens must never cross it.

### Next.js application server

- Runs locally through `next dev` and in production on Vercel.
- Hosts Server Components, Server Actions, and the NextAuth route.
- Uses `lib/supabase.ts` to create a server-only Supabase client with `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- Applies the `Asia/Ho_Chi_Minh` timezone in `next.config.js` and the root layout.

### Supabase data platform

- Postgres is the primary operational database.
- Reviewed migrations under `supabase/migrations/` define schema, RPCs, recovery controls, audit locks, and backdated-ledger handling.
- Critical flows use database RPCs where an atomic transaction is required, including purchase-order writes and reviewed recovery operations.
- Edge Functions provide integration surfaces such as backup snapshots, notifications, and user administration.
- No active Supabase Auth or Supabase Storage consumer was found during Pre-Audit B. Application authentication currently uses NextAuth Credentials.

### External services

- **Vercel:** production hosting and deployment.
- **Google Apps Script:** scheduled pull of the database snapshot endpoint.
- **Google Drive:** daily and monthly full-snapshot storage.
- **Google Sheets:** legacy migration, audit, and compatibility paths remain in the repository; Pre-Audit C must distinguish any live consumer from historical tooling.
- **Telegram:** an Edge Function contains notification integration; operational status belongs in the feature catalog and is not asserted here.

## Request and data flows

### Authentication and session flow

1. NextAuth Credentials receives username/password input.
2. Server-side code reads the matching user row from Supabase Postgres and compares the bcrypt password hash.
3. A signed NextAuth session carries the user identity and technical role.
4. `middleware.ts` protects `/admin/**` and `/pos/**`; STAFF users are redirected away from the admin area.
5. Server-side actions may add action-local checks such as `requireAdmin()` or `resolveActor()`.

Route protection is observed, but action-by-action authorization and RLS enforcement are not certified by this document. Phase 3 owns that verification. SEC-1 tracks raw password-hash fields crossing an authenticated admin server/client boundary.

### Operational read flow

1. A Server Component or Server Action requests data.
2. Server-side data helpers call Supabase Postgres, normally with server credentials.
3. The server shapes data for the requesting UI.
4. Sensitive fields must be removed before serialization to a Client Component.

The server client uses a privileged key and can bypass RLS. Therefore, application-side authorization and response shaping are critical boundaries even if RLS policies exist.

### Operational write flow

1. UI input reaches a Server Action.
2. The action validates input and resolves the actor where implemented.
3. Simple writes use data helpers; critical multi-row writes use reviewed RPC/transaction paths.
4. Domain events, ledger rows, consumption rows, and snapshots are written according to the business rule for that flow.
5. Read-only audit scripts check invariants after high-risk changes.

No script or admin workflow is authorized to rewrite production history merely because it can connect to the database. Historical correction requires a separate approved dry-run/apply/rollback plan.

### Backup flow

1. An Apps Script time trigger runs daily around 02:30 Asia/Ho_Chi_Minh.
2. Apps Script calls the deployed `backup-to-drive` Edge Function with `BACKUP_PULL_TOKEN`.
3. The Edge Function returns a schema-versioned full snapshot for the approved table allowlist.
4. Apps Script validates the bundle and writes an idempotent daily file plus the current monthly file into separate Drive folders.
5. Retention keeps 180 daily snapshots and monthly snapshots indefinitely.
6. Restore remains a separate, reviewed operation; a successful backup is not proof of restore readiness.

The detailed contract and capacity threshold remain authoritative in the [backup policy](docs/audits/2026-07-16-drive-backup-policy.md) and [operator runbook](docs/operations/apps-script-drive-backup.md).

## Major modules

| Module | Primary surfaces | Main responsibility |
|---|---|---|
| Authentication | `app/login`, `app/api/auth`, `lib/auth.ts` | Credentials login, sessions, technical-role propagation |
| POS | `app/pos` | Cart, pricing, checkout, drafts, and order submission |
| Orders | `app/admin/orders` | Order review, edit, void, snapshots, and event history |
| Catalog | `app/admin/products`, `app/admin/brands`, `app/admin/promotions` | Products, variants, modifiers, recipes, pricing, promotions |
| Purchasing and inventory | `app/admin/inventory`, purchase/ledger libraries | Purchase orders, stock ledger, adjustments, current stock |
| Production and BTP | `app/admin/production`, `app/admin/semi-products` | Production orders, yields, semi-product consumption |
| Reports | `app/admin/reports`, report allocators | Revenue, COGS, profit, and consistency checks |
| Audit and recovery | `app/admin/audit`, `scripts/audit-*`, recovery controls | Drift classification, evidence locks, backdated-event review |
| Backup | Edge Function, Apps Script, Drive policy | Full snapshots, validation, retention, restore inputs |
| User administration | `app/admin/users`, user-admin Edge Function | User lifecycle and role data; security hardening remains pending |

Feature completeness and operational verification belong in [`docs/FEATURE-CATALOG.md`](docs/FEATURE-CATALOG.md), not this architecture overview.

## Trust boundaries

| Boundary | Trusted material | Main risk | Current control | Verification status |
|---|---|---|---|---|
| Browser | User input and rendered data are untrusted | Input manipulation, sensitive-field exposure | Server-side execution and route protection | PARTIAL; Phase 3 pending |
| Next.js server | Session secret, privileged Supabase key | Missing action guard or unsafe serialization | NextAuth, middleware, selected action-local guards | OBSERVED, not fully verified |
| Supabase Postgres/RPC | Operational and historical data | Partial writes, unauthorized privileged access | RPC transactions, migrations, service-key secrecy | Flow-specific verification only |
| Edge Functions | Integration secrets and snapshot bundle | Token leakage, overly broad data export | Edge secrets, pull token, schema allowlist | Backup flow verified by policy/tests |
| Apps Script/Drive | Backup token, snapshot files | Unauthorized access, incomplete retention | Script Properties, Drive ownership, validation, idempotency | Operationally verified; restore drill separate |
| Maintenance scripts | Production credentials when explicitly loaded | Accidental writes or historical mutation | Dry-run/apply protocol, reviewed plans, audit receipts | Script-specific |

The intended role matrix is defined in [`docs/ACCESS-MODEL.md`](docs/ACCESS-MODEL.md). It must not be treated as verified enforcement until the security audit records evidence.

## Reliability and data-integrity controls

- Order lines pin `cost_at_sale`; reports use MAC as the primary COGS contract.
- Order and recipe snapshots preserve the inputs used at write time.
- Stock quantity changes are represented through the stock ledger.
- Backdated-ledger migrations and review flows surface transactions created after their effective time.
- Audit baseline locks protect reviewed historical lines from ordinary mutation.
- Cohort-aware MAC audit output separates stored-value violations from informational replay shifts.
- High-risk recovery scripts use immutable source hashes, dry-run planning, atomic apply paths, post-apply verification, and rollback evidence.
- Full database snapshots provide recovery inputs but do not replace transaction safety or restore drills.

Detailed valuation rules remain in the [MAC/COGS design](docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md). Approved operating rules are summarized in [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md).

## Environments and delivery

### Local development

- `npm run dev` starts the Next.js development server.
- `.env.local` supplies approved local credentials and is not committed.
- Tests and read-only audits run locally; scripts requiring production credentials must state their mode and must not silently write.

### Production

- Vercel hosts the Next.js application.
- Supabase hosts Postgres and Edge Functions.
- Apps Script owns the backup time trigger; Drive owns snapshot retention.
- Production migrations, function deployment, secret rotation, restore, and data recovery each require explicit review appropriate to their risk.

There is no tracked GitHub Actions workflow at this baseline. The Husky hook runs TypeScript locally before commits; it is not remote CI.

## Known gaps and non-claims

- RLS coverage and action-level authorization are scheduled for Phase 3 and are not certified here.
- SEC-1 tracks removal of `password_hash` from admin browser payloads.
- Offline POS capability is `UNVERIFIED`; architecture must not imply it exists.
- Multi-brand/outlet/franchise support is future scope, not the current operating model.
- Supabase Auth and Supabase Storage are not claimed as active components.
- Legacy Sheets and notification paths require Pre-Audit C classification before being called live or retired.
- Restore readiness requires a documented restore plan and drill; daily file creation alone is insufficient.

## Supporting authority

- Business context: [`CONTEXT.md`](CONTEXT.md)
- Business rules: [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md)
- Access intent: [`docs/ACCESS-MODEL.md`](docs/ACCESS-MODEL.md)
- Feature evidence: [`docs/FEATURE-CATALOG.md`](docs/FEATURE-CATALOG.md)
- Test strategy: [`docs/TESTING.md`](docs/TESTING.md)
- MAC/COGS design: [`docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`](docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md)
- Backup policy: [`docs/audits/2026-07-16-drive-backup-policy.md`](docs/audits/2026-07-16-drive-backup-policy.md)
- Collaboration protocol: [`docs/COLLABORATION.md`](docs/COLLABORATION.md)

Update this document when runtime components, trust boundaries, authentication, critical transaction paths, deployment integrations, or backup architecture change.
