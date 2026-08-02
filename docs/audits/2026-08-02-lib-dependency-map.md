# `lib/` dependency map — measured for the deferred phase 3 restructure

Date: 2026-08-02
Status: evidence, kept for when the restructure resumes
Method: `scripts`-aware import scan across 637 files in `app/`, `lib/`,
`components/`, `scripts/`, `types/`, counting all four import forms this repo
actually uses — `@/lib/x`, `../lib/x`, `./x`, `../x`.

## Why this file exists

The restructure was deferred on 2026-08-02: the owner is changing how inventory
and COGS are calculated, and that change lands on the heaviest part of the
restructure. This measurement is the part worth keeping, so the work is not
repeated when the restructure resumes.

**A first attempt at this measurement was wrong and is worth recording as a
warning.** A `git grep` for `@/lib/x` and `./x` reported 15 unused modules. The
real number is 3. Scripts import with `../lib/x` — 61 occurrences — which that
pattern never matched, so the count silently under-reported by a factor of five.
Any future scan must cover all four forms.

## Result

**78 top-level modules in `lib/`.** Only **3** are genuinely unreferenced:
`crypto`, `sheets`, `sheets-source`.

**6 are used only by `scripts/`**, never by running code — audit tooling that is
correctly in `lib/` for testability: `admin-auth-guard-audit`,
`production-stock-audit`, `purchase-order-rpc-readiness`, `recipe-history-audit`,
`script-cleanup-tools`, `stock-adjustment-audit`.

### The hubs, and why the split is feasible

Eleven modules have ten or more non-test importers. They fall into two groups,
and the split between them is the reason a domain layout is workable:

| Module | Importers | Kind |
|---|---|---|
| `supabase` | 62 | Infrastructure |
| `sheets_db` | 52 | Infrastructure |
| `format` | 35 | Infrastructure |
| `auth` | 33 | Infrastructure |
| `order-types` | 28 | Shared types |
| `shared-actions` | 16 | Infrastructure |
| `datetime` | 13 | Infrastructure |
| `dialog` | 10 | Infrastructure (UI) |
| `inventory-consumption` | 16 | **Domain engine** |
| `mac-cogs` | 16 | **Domain engine** |
| `recipe-selection` | 10 | **Domain engine** |

**The tangle is infrastructure, not cross-domain.** Eight of the eleven hubs are
cross-cutting utilities that every area legitimately depends on; only three are
business logic. Domains would therefore depend downward on a shared tier rather
than sideways on each other, which is ordinary layering rather than a knot to
untie.

`order-types` is named for orders but is imported by 24 `lib/` modules — it is a
shared type module wearing a domain name, and belongs in the shared tier
whatever it ends up called.

## What the COGS change collides with

`mac-cogs` and `inventory-consumption` are two of the three domain hubs, and the
calculation change touches both, plus roughly a dozen modules around them
(`full-history-recompute`, `order-cogs`, `purchase-ledger-rebuild`,
`phase4-rebuild-scope`, `phase5-cost-scope`, and the cost/stock audits).

That overlap is why the owner sequenced the calculation change first:
restructuring those files immediately before rewriting them would be work done
twice.

## Also measured, still true

Source size across `app/`, `lib/`, `components/`: ~42,000 lines. `lib/` holds 183
`.ts` files, of which 78 are source and 105 are co-located tests — the
co-location is deliberate and stays. The maintainability problem is concentrated
in a few oversized files rather than in directory width:

| File | Lines |
|---|---|
| `components/POSScreen.tsx` | 1,378 |
| `app/admin/reports/actions.ts` | 1,110 |
| `lib/history-ops/hong-luc-migration.ts` | 980 |
| `app/admin/orders/actions.ts` | 755 |

Splitting those is independent of the COGS change for the first two and the
last, and can proceed whenever the restructure does.
