# Task: Full System Audit — Gate 2: Architecture and Access Map

## Context

Gate 1 closed 2026-07-18 (commits `dd2f970`, `57d298a`, `9a8ee66`, Claude-reviewed
at `6eec344`). It fixed 3 named security exposures found during Pre-Audit C.
This is Gate 2: build the actual evidence matrix that
`docs/ACCESS-MODEL.md`'s "Verification requirements for Phase 3" section has
promised since Pre-Audit B but never had — i.e., prove, per route/action,
who can call it and what stops the wrong caller, rather than relying on
spot-checks.

The audit-program spec's own text for Gate 2 is a placeholder ("Full content
per owner's spec") — there was no detailed brief handed down for this gate.
Claude scoped it directly from `docs/ACCESS-MODEL.md`'s existing Phase 3
checklist plus a concrete problem found in the existing tooling (below).
Read `docs/ACCESS-MODEL.md` in full before starting.

## Why this gate starts with fixing the audit tool, not just running it

`scripts/audit-admin-action-auth.ts` (used to find the Gate 1 SEC-2 gap) has
three real blind spots, confirmed by reading its source
(`lib/admin-auth-guard-audit.ts`):

1. **Directory scope.** `findActionFiles()` only walks `app/admin/`. It never
   looks at `app/pos/actions.ts` (POS checkout — the single most financially
   critical write path in the app) or `app/actions/auth.ts` (contains the
   already-known-broken `changePasswordAction`, FIX-1 in the backlog). Any
   future `actions.ts` outside `app/admin` is invisible to it too.
2. **Name-prefix filter.** `MUTATION_PREFIXES` is
   `["add","approve","delete","edit","save","submit","toggle","update"]`.
   A function named `voidOrderV2`, `rejectEventAction`, `createX`,
   `removeX`, `insertX`, `applyX`, `triggerBackup`, `changePasswordAction`,
   `recordX`, or `setX` is silently skipped — not flagged as a violation,
   just never examined. (`rejectEventAction` got fixed in Gate 1 SEC-2 only
   because a human read the file directly, not because this tool caught it.)
3. **Guard-detection heuristic.** It checks whether the substring
   `requireAdmin(` or `resolveActor(` appears anywhere in the function body
   — not whether the call's result is actually checked and acted on. A
   function that calls `resolveActor()` for an unrelated logging line but
   never rejects on failure would pass as "guarded." It also only inspects
   `ts.isFunctionDeclaration` nodes — an export written as
   `export const foo = async (...) => {...}` (arrow function assigned to a
   const) is invisible to the current AST walk, not flagged either way.

Confirmed no `"use server"` directive exists outside files literally named
`actions.ts` (repo-wide grep), so the file-discovery convention itself is
sound — the problem is scope and precision, not a whole hidden category of
files.

## Scope

### 1. Fix `lib/admin-auth-guard-audit.ts` and `scripts/audit-admin-action-auth.ts`

- Broaden file discovery to every `actions.ts` under `app/` (not just
  `app/admin/`), so `app/pos/actions.ts` and `app/actions/auth.ts` are
  included.
- Detect both `function` declarations and `const x = async (...) => {}`
  arrow-function exports.
- Replace the fixed prefix list with a decision made by actually reading
  each currently-unmatched exported function: if it performs a write
  (insert/update/remove/RPC call with side effects), it belongs in the
  mutation set regardless of its name. Don't guess from name alone the way
  the original prefix list did — that's exactly the mechanism that missed
  `changePasswordAction` and `voidOrderV2`-style names before.
- Tighten the guard check from "substring present anywhere in body" to
  "the guard's result actually gates the function" (e.g., an early-return
  or thrown error on `!auth.ok`/falsy guard result). A guard call that's
  present but never checked should still count as a violation.
- Add unit tests for the audit helper itself covering: an arrow-function
  export with no guard (should flag), a function-declaration export with a
  guard call whose result is never checked (should flag), and a properly
  guarded arrow-function export (should not flag) — the current test
  suite for this helper likely only covers the old prefix/declaration
  shape; check `lib/admin-auth-guard-audit.test.ts` and extend it rather
  than assuming coverage.

### 2. Extend the audit to API routes

Add `app/api/**/route.ts` to the scan (a separate, smaller check is fine —
route handlers have a different shape than `actions.ts` exports). For each
route handler (GET/POST/etc.), determine: does it have a local guard, is it
intentionally public (e.g. `app/api/auth/[...nextauth]/route.ts` is NextAuth
itself — expected to be reachable unauthenticated), or is it an
undocumented gap. Do not assume "public" for anything without checking what
it actually does.

### 3. Rerun and produce the evidence report

Run the fixed tool across the full scope. Write
`docs/audits/2026-07-18-gate2-access-map.md`: one row per action/route
covering ACCESS-MODEL.md Phase 3 items 1 (route/action inventory), 2 (would
an unauthenticated call be rejected), 3 (would a wrong-role call be
rejected), 6 (API/Edge Function authentication), and 8 (is this a
SYSTEM/CLI-only path, and can an external caller obtain SYSTEM authority).
Items 4 (brand/outlet scope — minimal now, one shop), 5 (RPC/privileged
client boundary), 9 (RLS policies), and 10 (session expiry/disabled
users/role changes) are out of scope for Gate 2 — they belong to Gate 3
(database/RPC/RLS audit) or a later phase. Say so explicitly in the report
rather than silently skipping them.

### 4. Remediate small, unambiguous new findings; stop and report the rest

If the fixed tool finds **5 or fewer** new unguarded mutations/routes beyond
the 3 already fixed in Gate 1, fix them using the same pattern as Gate 1
(local guard + regression test proving rejection-before-mutation), one
commit per logical group, and record them in the evidence report.

If it finds **more than 5**, stop remediation after documenting all of them
in the evidence report, and flag this to Claude rather than doing a large
unreviewed remediation wave in one gate. Gate 2 is the map; a big
remediation wave deserves its own reviewed scope, the same way Gate 1 did.

## Explicitly out of scope for Gate 2

- RLS policies, privileged Supabase server-client boundary review — Gate 3.
- Session expiry / disabled-user / role-change behavior — Gate 3 or later.
- Brand/outlet data-scope isolation — not applicable at meaningful depth
  while the business runs one shop; note only, don't build for it.
- FIX-1 (`changePasswordAction`) and FIX-2 (`triggerBackup` legacy
  endpoint) — these are the existing P2 functional-bug backlog items, not
  Gate 2 work, even though `changePasswordAction` will now be *visible* to
  the fixed audit tool. Do not fix it here; just note its guard status
  accurately in the evidence report.
- Redesigning RBAC or introducing new business roles.

## Constraints

- Follow `docs/COLLABORATION.md` Section C: these are engine/audit files,
  Codex-owned.
- Commit per logical step (tool fix, then evidence report, then any small
  remediation), not one giant commit.
- No production data write is expected anywhere in this gate.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: current baseline (414) or more if new tests are added.
3. The fixed audit tool's own test coverage proves it catches arrow-function
   exports and un-checked-guard cases that the old version missed.
4. `docs/audits/2026-07-18-gate2-access-map.md` covers every `actions.ts`
   under `app/` (list the count) and every `app/api/**/route.ts` (list the
   count), with an explicit status per item.
5. Any remediated finding has a regression test proving rejection-before-
   mutation, matching the Gate 1 pattern.
6. `docs/FEATURE-CATALOG.md` and `docs/ACCESS-MODEL.md` updated only for
   the specific rows/items this gate actually produced evidence for —
   surgical updates, not a rewrite.

## Expected output

- Fixed `lib/admin-auth-guard-audit.ts` + `scripts/audit-admin-action-auth.ts`
  with expanded test coverage.
- New `docs/audits/2026-07-18-gate2-access-map.md` evidence report.
- 0-5 small remediation commits if unambiguous new gaps are found (guard +
  test each), or a stop-and-report if more than 5 are found.
- `docs/ACCESS-MODEL.md` "Verification requirements for Phase 3" section
  updated to mark items 1/2/3/6/8 as evidence-backed (with a link to the
  new report), items 4/5/9/10 left as still open for Gate 3+.
- `DEVELOPMENT-TRACKING.md` entry per commit.
- No push.

## Priority

P1 — second gate of the owner-triggered eight-gate audit. Codex pickup.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — this
touches the audit tooling's own correctness (a tool that under-reports
security gaps is itself a risk) plus judgment calls on what counts as a
"guarded" mutation; not mechanical.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- The fixed tool finds more than 5 new unguarded mutations/routes (see
  Scope item 4).
- Any finding appears to require a production data write or migration.
- A route/action's guard status is genuinely ambiguous (e.g., intentionally
  public but you're not fully sure) — name it and ask rather than guessing.
- Fixing the audit tool itself turns out to require touching
  `lib/auth.ts`'s `requireAdmin`/`resolveActor` behavior — that's a bigger
  change than "fix the audit tool," flag it first.
- TS/build fails for a non-trivial reason.
