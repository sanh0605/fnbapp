# Task: Gate 2 Remediation Wave 1 — POS System-Actor Gaps + Edge Function Signature Check

## Context

Gate 2 (`docs/audits/2026-07-18-gate2-access-map.md`, commits `3570da0`,
`f14b092`) found 25 access findings and correctly stopped short of fixing
them (exceeds the 5-item unreviewed cap). Claude reviewed the report,
independently confirmed the findings by reading source directly, and is
splitting remediation into scoped waves per the report's own recommendation.
This is Wave 1 — the highest-risk, least-ambiguous subset: no business
decision required, just close a real gap.

## Scope

### 1. `app/pos/actions.ts` — remove unauthenticated SYSTEM fallback

Three functions currently use `getServerSession()` (or nothing at all) only
to *pick an actor label*, never to reject a missing session:

- `submitOrderV2` — falls back to actor id `"system"` when no session.
- `savePOSDraft` — same pattern, also has a `CLI_MODE` bypass that skips the
  session lookup entirely (keep that bypass — it's for legitimate CLI/script
  execution — but everything else must require a real session).
- `deletePOSDraft` — has no guard or session lookup at all currently.

Also close the matching unguarded read:

- `getPOSDrafts` — no guard or session lookup.

Fix: require an authenticated session for all four. This is **not** the
same as `requireAdmin()` — POS actions are meant for STAFF (cashier) role,
not ADMIN-only. Check `lib/auth.ts` for whether a lighter "require any
authenticated session" helper already exists (distinct from `requireAdmin`);
if not, add one rather than incorrectly locking POS actions to ADMIN. Keep
the `CLI_MODE` bypass path in `savePOSDraft` working for legitimate
CLI/script callers — don't require CLI_MODE callers to also have a session.

Preserve existing behavior for real, authenticated calls exactly as today
(no data shape change) — this is closing an unauthenticated bypass, not
redesigning the POS action contract.

### 2. `supabase/functions/user-admin/index.ts` — fix `/migrate` signature check

`_isServiceRole(jwt)` currently does `JSON.parse(atob(jwt.split('.')[1]))`
and checks `payload.role === 'service_role'` — this decodes the JWT payload
but never verifies its signature. Anyone who can construct a base64 payload
claiming `role: 'service_role'` passes this check, regardless of whether
the platform's own JWT verification is enabled for this function.

Fix: verify the JWT signature before trusting its claimed role, not just
decode the payload. Use the same verification approach `admin.auth.getUser()`
already uses elsewhere in this file for regular user tokens (see the
`Authorization` header handling later in `index.ts`) rather than inventing
a new verification method — check the existing Supabase JS client's
capability for verifying a service-role token, or use the `SUPABASE_SERVICE_ROLE_KEY`
environment value in the comparison directly (compare the incoming Bearer
token to the actual service-role key string, similar in spirit to how
`backup-to-drive`'s `X-Backup-Token` check works) rather than trusting an
unverified claim inside the token itself.

This is a one-time migration endpoint (`/migrate`) — check
`docs/audits/2026-07-18-gate2-access-map.md`'s Edge Function section before
changing anything, and don't touch the other 3 Edge Functions in this wave
(see Out of scope).

### 3. `app/admin/inventory/actions.ts` — lock `submitStockAdjustment` to ADMIN

Owner decision 2026-07-18: stock adjustment submission is a manager/admin
responsibility, not a cashier/staff task. Staff should no longer be able to
submit an adjustment request at all (today they can, landing it in a
`PENDING` status pending admin approval).

Fix: change `submitStockAdjustment`'s guard from `resolveActor()` (accepts
any authenticated role) to `requireAdmin()` (matching `approveStockAdjustment`
and `rejectStockAdjustment` in the same file). Once this is ADMIN-only, the
existing `isApproved = role === "ADMIN"` branch and the `PENDING` status
path become dead code for this entry point — every successful call is now
from an ADMIN, so it will always auto-approve. Simplify accordingly (remove
the now-unreachable `PENDING`/`isApproved` branching in this function) rather
than leaving dead conditional logic behind, but do not touch
`approveStockAdjustment`/`rejectStockAdjustment` — those still serve a
purpose if a `PENDING` row exists from before this change (historical rows),
and the model may reintroduce a submit/approve split later with a proper
Inventory role.

Update `docs/FEATURE-CATALOG.md`'s `INV-STOCK-ADJUSTMENT` record's "Intended
users" field to reflect ADMIN-only submission, and note in "Known
limitations" that this is a policy narrowing (staff can no longer submit),
not a workflow bug fix.

## Explicitly out of scope for Wave 1

- The 21 unguarded admin read actions — separate Wave 2, mechanical, lower
  risk than these financially-material POS writes.
- `backup-to-sheets`, `notify-order` Edge Functions, and `user-admin`'s
  non-`/migrate` routes — deployment-config verification, not a code fix;
  tracked separately.
- Do not add ADMIN-level restriction to any POS action — cashier/STAFF
  access must remain exactly as intended today, only the *unauthenticated*
  path closes.

## Constraints

- Follow `docs/COLLABORATION.md` Section C: `app/pos/actions.ts` transaction
  paths and Supabase functions are Codex-owned.
- Add a regression test per fixed function proving an unauthenticated call
  is now rejected, matching the Gate 1 pattern (rejection before any
  read/write occurs).
- Commit the POS fix and the Edge Function fix separately — different risk
  surfaces, different review needs.
- No production data write, deployment, or migration expected.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: 422+ pass.
3. New tests prove: unauthenticated `submitOrderV2`/`savePOSDraft`/
   `deletePOSDraft`/`getPOSDrafts` calls are rejected before any read/write;
   the `CLI_MODE` bypass still works for `savePOSDraft`.
4. `_isServiceRole`'s replacement is covered by a test proving a
   payload-only forged token (no valid signature/key match) is rejected.
5. `docs/audits/2026-07-18-gate2-access-map.md` and
   `docs/FEATURE-CATALOG.md` updated only for the specific rows this wave
   closes (evidence + date), not a rewrite.

## Priority

P0 — highest-risk subset of Gate 2 findings (financially material POS
writes reachable without authentication).

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — touches
POS transaction paths and an Edge Function auth boundary; same risk class
as Gate 1.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- `lib/auth.ts` has no existing "require any authenticated session" helper
  and adding one would require a larger refactor than expected.
- The `_isServiceRole` fix would require deploying or rotating any secret.
- Fixing `savePOSDraft`'s `CLI_MODE` interaction turns out to be ambiguous
  (e.g., unclear which real CLI callers depend on the current bypass shape).
- TS/build fails for a non-trivial reason.
