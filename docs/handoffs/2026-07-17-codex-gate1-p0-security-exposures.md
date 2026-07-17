# Task: Full System Audit — Gate 1: Close P0 Security Exposures

## Context

Owner triggered the full eight-gate audit program on 2026-07-17
(`docs/superpowers/specs/2026-07-17-full-system-audit-program.md`) after
reviewing the Pre-Audit C feature inventory (commit `99f466d`, 51
capabilities, Claude-reviewed and closed at commit `24a57bd`). Baseline
commit for this audit program: `24a57bd9ee08e164ec2f0497e4aca3b7f0d3b921`.

This is Gate 1 of 8. Per the spec, Gate 1 scope is narrow: close identified
P0/P1 security exposures. Do not redesign the authorization system. Gate 2
(architecture/access map) and Gate 3 (database/RPC/RLS audit) are separate,
later work — do not pull their scope into this one.

Three concrete exposures were found and independently verified in code
during Pre-Audit C review (not just observed in a report — Claude read the
actual source for each):

## Scope

### 1. SEC-1 — `password_hash` leakage to authenticated admin Client Components

Flagged by Pre-Audit A (2026-07-17), carried forward unresolved. Raw `users`
rows, including `password_hash`, can be serialized into props passed to
authenticated admin Client Components. Not currently exploitable by an
anonymous user (admin pages require login), but violates the server-only
sensitive-field rule in `docs/ACCESS-MODEL.md`.

Fix: strip `password_hash` (and any other credential material) before any
`users` row crosses from a Server Component/Server Action into a Client
Component prop or a JSON response. Find every call site that reads from the
`users` table and passes the result toward the client; project only the
fields the UI actually needs.

### 2. SEC-2 — `approveAndRecomputeAction` has no server-side guard, trusts caller-supplied reviewer

File: `app/admin/audit/backdated-ledger/actions.ts`.

Verified: `approveAndRecomputeAction(eventId: string, reviewer: string)` has
no `requireAdmin()`/`resolveActor()` call in its own body — it relies
entirely on the `/admin/*` middleware route protection, which does not cover
direct Server Action invocation in every case. It also accepts `reviewer` as
a plain string parameter from the caller rather than deriving the reviewer
identity from the authenticated session.

Compare with the guard pattern already used elsewhere (e.g. `voidOrderV2`,
`savePurchaseOrder` — see `CODE-22` in `docs/audits/codex-handoff-2026-06-25.md`
for the established `requireAdmin`/`resolveActor` pattern). Apply the same
pattern here: add the server-side guard, and derive the reviewer identity
from `resolveActor()`/session rather than the `reviewer` parameter. Check
`rejectEventAction` in the same file for the identical issue — Pre-Audit C
only named `approveAndRecomputeAction` explicitly; verify whether
`rejectEventAction` has the same gap before assuming it does or doesn't.

### 3. SEC-3 — Two maintenance routes outside the auth middleware matcher

File: `middleware.ts`. Confirmed matcher is exactly
`["/pos/:path*", "/admin/:path*"]`. These routes are structurally
unprotected:

- `/api/revalidate` — cache revalidation. Business impact if abused is
  availability/staleness, not data exposure or mutation.
- `/api/inventory/sync/scan` — read-only order-ledger discrepancy scan
  (`auditOrderLedger`). Can expose inventory/order discrepancy metadata to
  an unauthenticated caller. The companion `execute` endpoint is already
  correctly retired (returns HTTP 410) — do not touch that one, it is done.

Fix: add a minimal local guard to each of these two routes (session check,
or a shared secret/token check if a route needs to be callable outside a
browser session — pick whichever fits how each route is actually invoked
today; check current callers before choosing). Do not add these routes to
the middleware matcher if that would change unrelated behavior — a local
guard inside the route handler is the narrower, safer change.

## Explicitly out of scope for Gate 1

- Do not redesign RBAC or introduce new business roles — that's Gate 2/Phase 3.
- Do not touch `FIX-1` (broken `changePasswordAction`) or `FIX-2` (manual
  backup calling the legacy endpoint) — those are functional bugs, not
  security exposures; they stay as separate P2 backlog items in
  `docs/ROADMAP.md`.
- Do not touch RLS policies or the privileged Supabase server client
  pattern — that's Gate 3.
- Do not expand beyond these 3 named items without checking back — if you
  find a 4th P0 exposure while working this, name it and stop rather than
  silently fixing it in the same commit.

## Constraints

- Follow `docs/COLLABORATION.md` Section C: these are engine/auth files,
  Codex-owned. No UI changes should be needed for any of the 3 fixes.
- Add a regression test for each fix proving the previously-open path is now
  rejected (anonymous/unauthorized request → rejected; caller-supplied
  reviewer → ignored in favor of session actor).
- Commit per item (3 commits, or 1 commit per logically grouped pair) rather
  than one giant commit — per Section D rule 2, don't mix unrelated fixes.
- No production data write is expected for any of these 3 fixes — they are
  code/guard changes, not data corrections. If you find you need to touch
  production data to close one of them, stop and flag it first.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: 403+ pass (baseline plus new regression tests).
3. For SEC-1: grep confirms no remaining call site passes a raw `users` row
   (with `password_hash`) into a Client Component prop or serialized
   response.
4. For SEC-2: new test proves `approveAndRecomputeAction` (and
   `rejectEventAction` if it has the same gap) rejects an unauthenticated/
   wrong-role call, and proves the recorded reviewer comes from the session
   actor, not the caller-supplied parameter.
5. For SEC-3: new test or manual curl-equivalent proves both routes reject
   an unauthenticated request.
6. Update `docs/FEATURE-CATALOG.md` status for `USR-ADMIN` (SEC-1),
   `AUD-BACKDATE-REVIEW` (SEC-2), and `MAINT-CACHE`/`MAINT-INVENTORY-SCAN`
   (SEC-3) records once fixed — evidence and `Last verified` date, not a
   wholesale rewrite of those rows.

## Expected output

- Guard/fix code changes across the 3 named files.
- New regression tests proving each previously-open path is now closed.
- `docs/FEATURE-CATALOG.md` status updates for the 4 affected feature
  records (evidence + date only).
- `DEVELOPMENT-TRACKING.md` entry per commit.
- `docs/ROADMAP.md`: move the SEC-1/SEC-2/SEC-3 P2 rows to done once closed
  and verified.
- No push.

## Priority

P0 — first gate of the owner-triggered eight-gate audit. Codex pickup.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — security
guard changes touching authorization paths, requires care around session
handling and regression coverage, not a mechanical fix.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Fixing SEC-2 or SEC-3 would require changing `middleware.ts`'s matcher
  in a way that affects other routes' behavior — propose the change first.
- A 4th P0-level exposure surfaces while working this gate.
- Any fix appears to require a production data write or migration.
- `rejectEventAction` turns out to have a different or larger gap than
  `approveAndRecomputeAction` — describe it before fixing.
- TS/build fails for a non-trivial reason.
