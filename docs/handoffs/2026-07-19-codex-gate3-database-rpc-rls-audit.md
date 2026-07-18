# Task: Full System Audit — Gate 3: Database/RPC/RLS Audit (Phase A — Read-Only)

## Context

Gate 2 (architecture and access map) closed 2026-07-19 — all application-level
Server Action and API route guards are now verified and enforced. Gate 2
explicitly deferred `docs/ACCESS-MODEL.md` Phase 3 items 5 (RPC/privileged
client boundary) and 9 (RLS policies and bypass assumptions) to Gate 3. This
is Gate 3.

The audit-program spec has no real detail for Gate 3 either (same
"Full content per owner's spec" placeholder pattern as Gate 2 — see
`docs/superpowers/specs/2026-07-17-full-system-audit-program.md`'s note on
this). Claude scoped this gate from a direct repository investigation
before writing this handoff, not from the spec text. Findings from that
investigation, which set the scope below:

- `lib/supabase.ts`'s own comment states the app's server client "Uses
  service role key for server actions / scripts. Bypasses RLS." and that a
  separate browser client "should use ANON key + RLS policies" — but no
  such browser client exists anywhere in the repo (confirmed by a repo-wide
  search for `NEXT_PUBLIC_SUPABASE`/`createBrowserClient`-style patterns:
  zero matches). The RLS half of the intended design was apparently never
  built.
- None of the 16 tracked migrations under `supabase/migrations/` contain
  `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` (confirmed by a repo-wide
  case-insensitive search for "row level security"/"policy": zero matches).
  This does not prove RLS is off in the live database — it could have been
  toggled via the Supabase dashboard outside of tracked migrations — but it
  means the repository has no record of RLS ever being configured, and Gate
  3 must check the live state directly rather than trust the migration
  history.
- `scripts/check-constraint-query.ts` calls `supabase.rpc("exec_sql", { query: ... })`
  — a raw-SQL-execution RPC, called only via the service-role client in a
  local debug script. This confirms an `exec_sql` (or similarly named)
  function likely exists in the live database. Whether `anon` or
  `authenticated` roles can also call it is unknown from the repo alone and
  must be checked live — if they can, that is a P0-severity finding (raw
  SQL execution from a non-privileged caller).
- The app's RPC surface includes financially material functions
  (`save_purchase_order_atomic`, `create_pos_order_atomic`,
  `apply_backdated_event_recovery`, `mark_backdated_event_recomputed`,
  `reject_backdated_event`, `apply_mac_drift_recovery`, and others). Gate
  1/2 verified the *application layer* rejects unauthorized callers before
  reaching these RPCs, but did not verify whether the RPCs themselves would
  also reject an unauthorized direct call (e.g., via PostgREST) if the
  application-layer guard were ever bypassed or misconfigured — that's the
  defense-in-depth question this gate answers.
- `SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY` exist as env vars but a
  repo-wide search found no `NEXT_PUBLIC_`-prefixed usage, meaning nothing
  currently ships this key into browser-bundled JavaScript. This reduces
  but does not eliminate exposure risk (the key could still leak by other
  means) — confirm this holds and note it, don't just repeat the claim.

## Scope — Phase A (this task): read-only live database evidence only

Produce `docs/audits/2026-07-19-gate3-database-rls-audit.md` covering:

### 1. Live RLS status per table

Query the live database directly (e.g. `SELECT relname, relrowsecurity,
relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace
AND relkind = 'r'`, or the Supabase-provided equivalent) for every table
under the `public` schema. Report which tables have RLS enabled, which
don't, and for any that do, list the actual policies (`pg_policies`).
Cross-reference the 32-table backup allowlist (see
`docs/audits/2026-07-16-drive-backup-policy.md` or the backup Edge Function
source) as a checklist of tables that should exist — flag any table found
live but not in that list, or vice versa, as a documentation gap to note
(not fix here).

### 2. `anon` and `authenticated` role grants

For the `anon` and `authenticated` Postgres roles: what table-level
privileges do they hold (`information_schema.role_table_grants` or
equivalent), and what function/RPC EXECUTE privileges do they hold
(`information_schema.role_routine_grants` or equivalent). This is the real
question Gate 1/2 couldn't answer from application code alone — if `anon`
can `SELECT`/`INSERT`/`UPDATE` a table directly, or `EXECUTE` a sensitive
RPC, that's a live exposure regardless of what the Next.js app does.

### 3. `exec_sql` (and any similarly-named raw-SQL RPC)

Specifically resolve whether this function exists live, what its
`SECURITY DEFINER`/`SECURITY INVOKER` setting is, and which roles can
execute it. This is the single highest-priority item in this gate — flag
it immediately if `anon` or `authenticated` can call it, don't wait for the
full report to be assembled.

### 4. Application RPC security model

For the financially material RPCs named above (purchase order, POS
checkout, backdated-event recovery, MAC drift recovery, and any others
found via a repo-wide `.rpc(` search): for each, determine
`SECURITY DEFINER` vs `SECURITY INVOKER`, which roles can execute it, and
whether the function body itself performs any internal role/caller check
(independent of the calling application code). Document what currently
stops a direct, authenticated-but-wrong-role PostgREST call to each RPC —
if the answer is "nothing, only the Next.js app's own guard," say so
explicitly rather than assuming RLS or grants provide a backstop.

### 5. Anon/publishable key exposure confirmation

Confirm (don't just repeat the claim) that no client-side bundle includes
`SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY`/any `NEXT_PUBLIC_SUPABASE_*`
variable. A build-output grep (`grep -r` over `.next/static` after a
production build, or equivalent) is stronger evidence than a source-only
grep, since bundlers can sometimes inline env vars unexpectedly.

## Explicitly out of scope for this task

- **Do not enable RLS, write policies, revoke grants, or change any live
  database configuration.** This is Phase A: evidence only. Remediation
  (if needed) is a separate, separately reviewed Phase B — touching live
  RLS/grants is a production-configuration change with real availability
  risk (an incorrectly scoped policy could silently break a working query
  path), not something to bundle into a read-only audit.
- Item 4 (brand/outlet scope) and item 10 (session expiry/disabled
  users/role changes) from `docs/ACCESS-MODEL.md`'s Phase 3 checklist —
  not this gate's focus; note if something relevant surfaces incidentally
  but don't go looking for it.
- Do not modify any application code (`app/`, `lib/`, `components/`) — this
  gate is entirely about live database configuration evidence.
- Do not attempt to fix `exec_sql` or any other finding even if it looks
  trivial (e.g., "just revoke the grant") — report it, let Claude scope the
  fix separately once the full picture is in.

## Constraints

- Read-only against the live database. If a query requires a connection
  method not already established in this repo's tooling (e.g., psql access
  vs. only RPC/PostgREST access), check what's actually available — several
  existing scripts (`scripts/supabase-ping.ts`,
  `scripts/check-promotions-constraint.ts`, `scripts/audit-*.ts`) already
  demonstrate live introspection patterns; extend or add a new read-only
  audit script rather than working ad hoc.
- Follow `docs/COLLABORATION.md` rule 6: this audit script is itself a
  first-class deliverable, not a throwaway — should be re-runnable later.
- Follow rule 1: read-only by default, no `--apply` path needed since
  nothing is being written.
- No production data write, no migration, no deployment, no secret
  rotation, no `--apply` of any kind.

## Verification

1. The audit script runs successfully against the live database and
   produces deterministic, re-runnable output.
2. `docs/audits/2026-07-19-gate3-database-rls-audit.md` answers all 5 scope
   items above with concrete evidence (query output, not assumptions).
3. The `exec_sql` question (item 3) has a definitive yes/no answer with
   evidence, not "likely" or "probably."
4. `docs/ACCESS-MODEL.md`'s Phase 3 checklist items 5 and 9 updated to
   `EVIDENCE_BACKED` (if fully answered) or left open with the specific
   remaining unknown named, not silently marked done.

## Priority

P0 if item 3 (`exec_sql` grants) turns out to allow `anon`/`authenticated`
execution — that would be an active, severe exposure requiring immediate
escalation, not waiting for the rest of the report. Otherwise P1 — this is
evidence-gathering for a defense-in-depth layer behind application guards
that Gate 1/2 already verified are enforced.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — live
database security introspection with a P0-severity possible outcome,
requires care, not mechanical.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- `exec_sql` (or any raw-SQL RPC) is confirmed callable by `anon` or
  `authenticated` — flag immediately, this may need emergency containment
  (narrower than a full Gate 3 close) before the rest of the audit
  continues, similar in spirit to the original Phase 0 diagnose-order
  containment.
- Any table is found to have RLS enabled with policies that look like they
  might already be blocking legitimate application traffic (would suggest
  the service-role client isn't actually bypassing everything as assumed,
  or something is inconsistent) — describe before assuming either the app
  or the audit's expectation is wrong.
- Live database access requires credentials or a connection method not
  already available in this repo's environment — describe what's missing
  rather than guessing at a workaround.
- Any finding suggests data has already been exposed or modified through a
  gap (not just "could be") — that changes this from an audit to an
  incident, flag immediately.
