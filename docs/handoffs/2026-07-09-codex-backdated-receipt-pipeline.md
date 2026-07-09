# Codex Prompt — Backdated Receipt Detection + Manual Review Pipeline (Task 3.2)

Date: 2026-07-09
Owner: Codex (Engine Lead)
Trigger: User interview confirmed policy direction. Single-agent execution end-to-end (4 phases), Claude reviews each phase.

## Background

Task 3.1 (commit `8f8bcf7`) confirmed PROD-028 BTP_SHORTFALL drift root cause: PO-051 backdated. Effective stock_ledger timestamp `2026-07-04T17:00:00Z`, real purchase_orders.created_at `2026-07-06T04:38:14Z`. 8 sales between those timestamps priced at old MAC, replay uses new MAC → drift.

This is a data model design gap, not a code bug. Backdated entries inherently create divergence between sale-time-known COGS and current-replay COGS.

## Requirements (user interview 2026-07-09)

| Dimension | Answer |
|---|---|
| Backdate frequency | **Weekly** (operator too busy, hasn't delegated) |
| Reason | Operator bandwidth — cannot block, would break workflow |
| Policy | **Allow + flag manual review** |
| Materiality | **Zero tolerance** — drift must resolve to 0 |

"Allow + flag" + "Zero tolerance" must go together. Workflow:
1. Backdated entry inserted → trigger detects → flag created
2. System identifies affected order lines
3. Admin reviews flag → approves recompute
4. System recomputes atomically → drift = 0

## Architecture

4 phases, sequential. One commit per phase. Pause after each commit for Claude review.

```
Phase A (Detection) -> Phase B (Recompute) -> Phase C (Admin UI) -> Phase D (Tests)
   migration 0014       TS script + RPC         admin pages           vitest
```

After Phase D, Task 3 recovery (Option A lock + Option B recompute existing 170 lines) becomes meaningful — no new drift leaks in.

## Coordination protocol

- **One commit per phase** — clean rollback
- **Pause after each phase commit** — Claude reviews diff + directs next phase
- **If blocker** — document in commit body, pause, ask Claude
- **No push** — Claude pushes when ready
- **No `--no-verify`** — pre-commit hook must pass
- **Verify before each commit**:
  - `npx tsc --noEmit` → 0 errors
  - `npx vitest run` → all tests pass (320+ baseline)
  - `git diff --check` → clean

## Phase A: Detection + Audit + Backfill

**Goal:** Detect future backdated entries via trigger. Quantify past backdating via backfill. Document pattern in audit doc.

### Files

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/0014_backdated_ledger_detection.sql` | Create | Schema + trigger |
| `scripts/backfill-backdated-ledger-events.ts` | Create | Read-only past pattern analysis |
| `docs/audits/2026-07-09-backdated-ledger-pattern.md` | Create | Pattern audit doc |

### Schema (migration 0014)

```sql
-- Track backdated ledger entries for admin review.
create table if not exists public.backdated_ledger_events (
  id uuid primary key default gen_random_uuid(),
  stock_ledger_id bigint not null,
  detected_at timestamptz not null default now(),
  effective_timestamp timestamptz not null,
  visibility_timestamp timestamptz not null default now(),
  source_table text not null,
  source_id text,
  item_reference text not null,
  quantity_change numeric(18,6),
  unit_cost bigint,
  status text not null default 'PENDING',
  reviewed_by text,
  reviewed_at timestamptz,
  recompute_run_id text,
  notes text,
  constraint backdated_ledger_events_status_chk check (
    status in ('PENDING', 'APPROVED', 'RECOMPUTED', 'REJECTED')
  )
);

create index if not exists backdated_ledger_events_status_detected_at_idx
  on public.backdated_ledger_events (status, detected_at desc);
create index if not exists backdated_ledger_events_item_reference_idx
  on public.backdated_ledger_events (item_reference);

alter table public.backdated_ledger_events enable row level security;
revoke all on table public.backdated_ledger_events from public;
revoke all on table public.backdated_ledger_events from anon;
revoke all on table public.backdated_ledger_events from authenticated;
grant select, insert, update on table public.backdated_ledger_events to service_role;
```

### Detection trigger

Definition of "backdated": `stock_ledger.created_at` (effective timestamp, set explicitly by app) is more than 5 minutes before `now()` (real insert time).

5-minute threshold handles normal transaction latency. Anything older = intentional backdating.

```sql
create or replace function public.flag_backdated_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip during recovery (replay writes old timestamps legitimately)
  if current_setting('app.mac_drift_recovery', true) = 'on' then
    return new;
  end if;

  -- Skip non-inventory-increasing entry types (sales consume is never backdated from app)
  if NEW.transaction_type not in ('PO_RECEIPT', 'STOCK_ADJUST', 'PRODUCTION_YIELD', 'INITIAL_BALANCE') then
    return new;
  end if;

  -- Backdated if effective timestamp is more than 5 minutes before real insert
  if NEW.created_at < now() - interval '5 minutes' then
    insert into public.backdated_ledger_events (
      stock_ledger_id,
      effective_timestamp,
      visibility_timestamp,
      source_table,
      source_id,
      item_reference,
      quantity_change,
      unit_cost
    ) values (
      NEW.id,
      NEW.created_at,
      now(),
      NEW.source,
      NEW.reference_id,
      NEW.item_reference,
      NEW.quantity_change,
      NEW.unit_cost
    );
  end if;

  return new;
end;
$$;

revoke all on function public.flag_backdated_ledger_entry() from public;
revoke all on function public.flag_backdated_ledger_entry() from anon;
revoke all on function public.flag_backdated_ledger_entry() from authenticated;

create trigger detect_backdated_ledger_entry
after insert on public.stock_ledger
for each row
execute function public.flag_backdated_ledger_entry();
```

### Backfill script

`scripts/backfill-backdated-ledger-events.ts` — read-only. NO database writes. Output goes to audit doc.

Logic:
1. Scan `stock_ledger` for entries where `transaction_type IN ('PO_RECEIPT', 'STOCK_ADJUST', 'PRODUCTION_YIELD')` AND `created_at < (sibling source row's created_at)`
2. For PO_RECEIPT: join `stock_ledger.reference_id = purchase_orders.id`, compare `stock_ledger.created_at < purchase_orders.created_at`
3. For STOCK_ADJUST / PRODUCTION_YIELD: no sibling source — use proxy `stock_ledger.created_at < now() - interval '1 day'` (very rough estimate)
4. Group counts by month, source_table, item_reference
5. Compute total VND impact for each backdated entry (using existing MAC replay with/without entry)
6. Output JSON artifact + console summary

Do NOT actually insert these into `backdated_ledger_events`. The table is for trigger-captured future events only. Past events stay as audit-only.

### Audit doc

`docs/audits/2026-07-09-backdated-ledger-pattern.md` should contain:

1. **Methodology**: how past backdated entries were detected (with limitations)
2. **Counts**: total entries, by month, by source_table, by item_reference (top 10)
3. **VND impact**: sum of |drift| attributable to backdating
4. **Sample**: 5 example entries with full trace
5. **Coverage gap**: which entry types lack sibling source for precise detection
6. **Recommendation**: confirm Phase B-D scope still appropriate, or adjust

### Phase A verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 320/320 pass
- Trigger logic: dry-run via `EXPLAIN` (no real insert)
- Backfill script: read-only, no INSERT/UPDATE
- No deploy (Claude deploys via `supabase db push`)

### Phase A commit

```
Codex feat: backdated ledger detection schema + trigger + backfill audit (Task 3.2 Phase A)
```

Commit body:
- Detection threshold (5 minutes) rationale
- Backfill methodology + limitations
- Top 3 findings from audit doc

### Phase A pause point

After commit, **pause for Claude review**. Claude reviews:
- Schema design (correct indexes, RLS, constraints)
- Trigger logic (correct event types, threshold, recovery bypass)
- Backfill methodology (no false positives)
- Audit doc findings

Claude directs: proceed to Phase B, or adjust Phase A first.

---

## Phase B: Recompute Script + Idempotency RPC

**Goal:** TypeScript script that, given an event_id, finds affected order lines, computes new COGS (sale-time-known MAC), calls atomic recompute RPC.

### Files

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/0015_backdated_event_recompute.sql` | Create | RPC for atomic flag update + lock |
| `lib/backdated-ledger/recompute-event.ts` | Create | TS orchestration |
| `lib/backdated-ledger/find-affected-lines.ts` | Create | Affected line discovery |
| `lib/backdated-ledger/compute-sale-time-cogs.ts` | Create | Sale-time MAC replay |
| `scripts/recompute-backdated-event.ts` | Create | CLI entry |

### RPC (migration 0015)

```sql
-- Atomically mark event approved/recomputed and bind to recovery run.
-- The actual cost_at_sale update uses existing apply_mac_drift_recovery RPC
-- (migration 0012). This RPC only manages event lifecycle.

create or replace function public.mark_backdated_event_recomputed(
  p_event_id uuid,
  p_reviewer text,
  p_run_id text,
  p_change_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.backdated_ledger_events%rowtype;
begin
  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception 'p_reviewer required';
  end if;

  select * into v_event
  from public.backdated_ledger_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event % not found', p_event_id;
  end if;

  if v_event.status = 'RECOMPUTED' then
    return jsonb_build_object('event_id', p_event_id, 'already_recomputed', true);
  end if;

  if v_event.status not in ('PENDING', 'APPROVED') then
    raise exception 'Event % is in status %, cannot recompute', p_event_id, v_event.status;
  end if;

  update public.backdated_ledger_events
  set status = 'RECOMPUTED',
      reviewed_by = p_reviewer,
      reviewed_at = now(),
      recompute_run_id = p_run_id
  where id = p_event_id;

  return jsonb_build_object(
    'event_id', p_event_id,
    'marked_recomputed', true,
    'run_id', p_run_id
  );
end;
$$;

revoke all on function public.mark_backdated_event_recomputed(uuid, text, text, integer) from public;
revoke all on function public.mark_backdated_event_recomputed(uuid, text, text, integer) from anon;
revoke all on function public.mark_backdated_event_recomputed(uuid, text, text, integer) from authenticated;
grant execute on function public.mark_backdated_event_recomputed(uuid, text, text, integer) to service_role;
```

### TS modules

**`lib/backdated-ledger/find-affected-lines.ts`**:

Given an event (effective_timestamp, visibility_timestamp, item_reference):
1. Find all SALES_CONSUME stock_ledger entries between those timestamps consuming the item_reference (directly or via BTP recipe decomposition)
2. For each, get the parent order_line_id (via `item_reference` or `reference_id` join)
3. Return list of `{ line_id, order_id, sale_time, stored_cost_at_sale }`

Reuse recipe traversal logic from `lib/mac-cogs-audit.ts` if available.

**`lib/backdated-ledger/compute-sale-time-cogs.ts`**:

Given an order line + the backdated event to exclude:
1. Replay MAC using only stock_ledger entries visible at sale_time (i.e., `created_at <= sale_time`)
2. Compute new cost_at_sale
3. Return `{ line_id, old_cost_at_sale, new_cost_at_sale }`

Reuse logic from `scripts/debug-prod-028-btp-shortfall.ts` (which already does this).

**`lib/backdated-ledger/recompute-event.ts`**:

Orchestrator:
1. Load event
2. Find affected lines
3. Compute new costs for each
4. Build changes array
5. Compute source_hash (SHA-256 of canonical changes JSON)
6. Call `apply_mac_drift_recovery` RPC with run_id = `backdated-{event_id}`
7. Call `mark_backdated_event_recomputed` RPC
8. Return summary

**`scripts/recompute-backdated-event.ts`**:

CLI:
```bash
npx vite-node scripts/recompute-backdated-event.ts --event-id <uuid> --reviewer <name> --dry-run
npx vite-node scripts/recompute-backdated-event.ts --event-id <uuid> --reviewer <name> --apply
```

Default `--dry-run`. `--apply` triggers actual recompute.

### Phase B verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 320/320 pass (no new tests yet — Phase D)
- Dry-run script: produces plan JSON, no DB writes
- RPC: SQL parse via `psql --parse` (no deploy)

### Phase B commit

```
Codex feat: backdated event recompute TS pipeline + lifecycle RPC (Task 3.2 Phase B)
```

Commit body:
- Reuse of existing `apply_mac_drift_recovery` (migration 0012) for atomic update
- Sale-time MAC replay strategy (filter ledger to visibility < sale_time)
- Dry-run plan hash example

### Phase B pause point

After commit, **pause for Claude review**. Claude reviews:
- RPC correctness (idempotency, lock, status transitions)
- TS module design (separation of concerns)
- Sale-time replay correctness (vs Phase A debug script evidence)
- Dry-run plan output sanity

Claude directs: proceed to Phase C, or adjust Phase B first.

---

## Phase C: Admin Review UI

**Goal:** Admin page to review pending backdated events and approve recompute.

**Scope note:** UI is normally Antigravity's domain. User explicitly delegated to Codex for this task. Follow existing UI patterns (see `app/admin/orders/page.tsx`, `app/admin/audit/...`).

### Files

| File | Action | Purpose |
|---|---|---|
| `app/admin/audit/backdated-ledger/page.tsx` | Create | List page |
| `app/admin/audit/backdated-ledger/[eventId]/page.tsx` | Create | Detail page |
| `app/admin/audit/backdated-ledger/actions.ts` | Create | Server actions |
| `app/admin/audit/backdated-ledger/loading.tsx` | Create | Loading skeleton |
| `components/backdated-ledger/event-row.tsx` | Create | List row component |
| `components/backdated-ledger/event-detail.tsx` | Create | Detail view component |
| `components/backdated-ledger/status-badge.tsx` | Create | Status pill |

### Reuse existing components

- `components/ui/PageHeader.tsx` — page header
- `components/ui/EmptyState.tsx` — empty list state
- `components/ui/SkeletonTable.tsx` — loading state
- `lib/datetime.ts:formatDateTime` — Vietnam time display
- `lib/format.ts:formatNumber` — VND formatting
- `lib/supabase.ts` — server client

### List page features

- Filter: status (PENDING default), date range, item_reference, source_table
- Sort: detected_at desc default
- Pagination: 50 per page
- Columns: detected_at, source_table, source_id, item_reference, quantity, unit_cost, status, actions
- Row click → detail page

### Detail page features

- Event metadata (detected_at, effective vs visibility timestamps, source)
- Affected order lines table (line_id, order_id, sale_time, stored COGS, would-be COGS, delta)
- Total delta VND
- "Approve + Recompute" button (calls server action)
- "Reject" button (sets status = REJECTED, requires reason in notes)
- Confirmation modal before action

### Server actions

```ts
// actions.ts
'use server';

export async function approveAndRecompute(eventId: string, reviewer: string) {
  // 1. Call lib/backdated-ledger/recompute-event.ts orchestrator
  // 2. Return success/failure with summary
}

export async function rejectEvent(eventId: string, reviewer: string, reason: string) {
  // 1. Update status to REJECTED with notes
}
```

### Phase C verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 320/320 pass
- Manual: navigate to `/admin/audit/backdated-ledger` — page loads, shows empty state (no PENDING events yet)
- Lighthouse-friendly: no console errors, no missing keys

### Phase C commit

```
Codex feat: admin backdated ledger review UI (Task 3.2 Phase C)
```

Commit body:
- Page structure overview
- Reuse of shared components
- Action button UX (confirmation modal pattern)

### Phase C pause point

After commit, **pause for Claude review**. Claude reviews:
- UI consistency (matches existing admin pages)
- Component reuse (no duplicate implementations)
- Action safety (confirmation modal, error handling)
- Accessibility (aria-* attributes, keyboard navigation)

Claude directs: proceed to Phase D, or adjust Phase C first.

---

## Phase D: Tests

**Goal:** Test coverage for detection trigger, recompute pipeline, idempotency.

### Files

| File | Action | Purpose |
|---|---|---|
| `lib/backdated-ledger/detection.test.ts` | Create | Trigger logic tests |
| `lib/backdated-ledger/recompute.test.ts` | Create | Recompute pipeline tests |
| `lib/backdated-ledger/find-affected-lines.test.ts` | Create | Affected line discovery tests |

### Test cases

**Detection:**
1. Insert stock_ledger row with `created_at = now()` → no flag created
2. Insert with `created_at = now() - interval '10 minutes'` → flag created with correct fields
3. Insert with recovery setting ON → no flag (bypass)
4. Insert SALES_CONSUME → no flag (wrong transaction_type)
5. Insert INITIAL_BALANCE backdated → flag created

**Recompute:**
1. Dry-run produces plan with correct affected lines
2. Apply: cost_at_sale updated, event marked RECOMPUTED
3. Idempotent: re-apply same run_id → `already_recomputed: true`
4. Sale-time replay correctly excludes backdated event
5. Mismatched old_cost_at_sale → atomic rollback

**Find affected lines:**
1. Direct consumption (raw ingredient → product)
2. BTP recipe consumption (raw → BTP → product)
3. No consumption (item not in any recipe of sold products) → empty list
4. Multiple sales in window → all found
5. Sales outside window → excluded

### Phase D verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 335+/335+ pass (320 baseline + 15 new)
- All new tests actually test the behavior (not just snapshot)

### Phase D commit

```
Codex test: backdated ledger detection + recompute coverage (Task 3.2 Phase D)
```

Commit body:
- Test count: 15 new tests
- Coverage areas: detection, recompute, find-affected-lines
- Mock strategy: real DB fixtures or in-memory mocks

### Phase D pause point (final)

After commit, **pause for Claude final review**. Claude reviews:
- Test coverage adequacy
- Mock strategy (no over-mocking that hides real bugs)
- All 4 phases coherent end-to-end

After Claude approves Phase D, Task 3.2 is complete. Next:
- Claude deploys migrations 0014 + 0015 via `supabase db push`
- Claude runs dry-run on first real backdated event when one appears
- Eventually: Task 3 recovery (Option A lock + Option B recompute 170 baseline lines)

---

## Cross-phase rules

- **One commit per phase** — clean rollback boundary
- **Pause after each phase** — Claude reviews before next phase starts
- **Verify before commit**:
  - `npx tsc --noEmit` → 0 errors
  - `npx vitest run` → all pass
  - `git diff --check` → clean
- **No push** — Claude pushes
- **No `--no-verify`** — pre-commit hook must pass
- **No `--no-gpg-sign`** — sign commits normally
- **Surgical changes** — touch only files listed per phase
- **No new `any` types** — explicit typing required
- **Lodash for data processing** — per CLAUDE.md

## Out of scope (do NOT do)

- Migration 0012 lock rows for existing 170 lines (Task 3 recovery, separate task)
- Recompute existing 170-line baseline (Task 3 recovery)
- Modify existing recipes (none need changing)
- Modify existing `apply_mac_drift_recovery` RPC (reuse as-is)
- Modify existing `lib/mac-cogs-audit.ts` (reuse helpers)
- Edit existing migration files 0001-0013
- Edit unrelated dirty files in working tree (`supabase/.temp/cli-latest`, etc.)

## If blocker encountered

If any phase hits a blocker (unexpected schema issue, missing infrastructure, ambiguous requirement):
1. Stop coding
2. Document blocker in commit body
3. Commit partial work with `WIP - blocked:` prefix
4. Pause for Claude direction

Do NOT silently work around blockers. Do NOT guess at requirements.

## Coordination

- Claude has reviewed Task 3 (commit `be2370e`) and Task 3.1 (commit `8f8bcf7`)
- Migration 0012 (lock infrastructure) already deployed as side effect — empty lock table, safe
- After Phase D, Claude will:
  1. Deploy migrations 0014 + 0015
  2. Wait for first real backdated event (likely within a week per user interview)
  3. Walk through admin UI, approve first recompute, verify drift = 0
  4. Eventually: write Task 3 recovery prompt (Option A + B for 170 baseline lines)
