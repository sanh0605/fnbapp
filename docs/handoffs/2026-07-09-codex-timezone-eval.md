# Codex Prompt — DB viewer timezone display evaluation

Date: 2026-07-09
Owner: Codex (Engine Lead)
Priority: 4 (per Codex roadmap)
Estimated effort: ~30 min - 1 hour

## Goal

Evaluate 2 options for making Supabase DB viewer (SQL Editor, Table Editor) display timestamps in Vietnam time (UTC+7) by default. Currently displays UTC, which confuses the user when comparing DB values to UI display.

## Background

Earlier timezone audit confirmed:
- ✅ UI display correct (uses `lib/datetime.ts:formatDateTime` with `Asia/Ho_Chi_Minh`)
- ✅ DB stores UTC instant (correct `timestamptz` practice)
- ⚠️ Supabase Dashboard viewers show UTC by default (`2026-07-06T05:46:02+00:00`)
- User wants: when opening DB viewer, see "06/07/2026 12:46" matching UI

PostgreSQL behavior (per Codex's earlier audit): `timestamptz` stores the instant, not the original offset. Display depends on the session's `timezone` setting.

## Options to evaluate

### Option A: Role-level timezone (recommended initial proposal)

```sql
ALTER ROLE service_role IN DATABASE <db_name> SET timezone TO 'Asia/Ho_Chi_Minh';
ALTER ROLE authenticated IN DATABASE <db_name> SET timezone TO 'Asia/Ho_Chi_Minh';
ALTER ROLE postgres IN DATABASE <db_name> SET timezone TO 'Asia/Ho_Chi_Minh';
```

**Pros:**
- All queries via these roles display Vietnam time
- App code unchanged
- Reversible (`RESET timezone`)

**Cons:**
- Affects ALL queries, including those that explicitly want UTC
- May break existing date arithmetic if any code assumes UTC display
- PostgREST may cache timezone per session — needs verification

### Option B: Session-level timezone in app code

In `lib/supabase.ts`, after connecting:
```ts
await supabase.rpc('set_session_timezone', { tz: 'Asia/Ho_Chi_Minh' });
```

Requires:
- Custom RPC `set_session_timezone(text)` with SECURITY DEFINER
- Called on every new connection (Supabase pools connections)

**Pros:**
- App-controlled, opt-in
- Doesn't affect other DB users (analytics tools, etc.)

**Cons:**
- Complex (RPC + lifecycle management)
- Doesn't help when user queries directly via Supabase Dashboard

### Option C: SQL helper for manual use

Provide a helper SQL snippet for the user to run before inspecting data:

```sql
-- Run this first, then your queries
SET TIME ZONE 'Asia/Ho_Chi_Minh';
SELECT created_at, order_no FROM orders_v2 ORDER BY created_at DESC LIMIT 5;
```

Document in `docs/runbooks/checking-db-timestamps.md`.

**Pros:**
- Zero risk to app
- User has full control

**Cons:**
- User must remember to run `SET TIME ZONE` each session
- Doesn't help with Table Editor (which doesn't run SQL)

## Phase A: Investigation

Read existing Supabase project settings to determine current state:

```bash
SUPABASE_DB_PASSWORD='<password>' psql '<connection_string>' -c "SHOW timezone;"
SUPABASE_DB_PASSWORD='<password>' psql '<connection_string>' -c "SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('service_role', 'authenticated', 'postgres');"
```

Document findings in `docs/audits/2026-07-09-timezone-display-eval.md`:
- Current server timezone
- Existing role-level timezone overrides (if any)
- Supabase platform default behavior

## Phase B: Recommendation

Based on investigation, recommend ONE option with:

1. **Risk assessment**: what could break?
2. **Reversibility**: how to undo?
3. **Test plan**: how to verify it works?
4. **Rollout plan**: how to apply safely?

User reviews recommendation → approves specific option → Codex implements.

## Phase C: Implementation (after approval)

If Option A approved:
```sql
-- Migration file supabase/migrations/0010_set_role_timezone.sql
ALTER ROLE service_role IN DATABASE <db_name> SET timezone TO 'Asia/Ho_Chi_Minh';
-- (other roles as approved)
```

Test via:
```bash
psql ... -c "SET ROLE service_role; SELECT now();"
```
Should display Vietnam time.

If Option B approved:
- Create RPC `set_session_timezone(text)`
- Update `lib/supabase.ts` to call on connection
- Test via app queries

If Option C approved:
- Write `docs/runbooks/checking-db-timestamps.md`
- No code changes

## Verify

Phase A:
- Audit doc committed
- No code changes

Phase C (after approval):
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 308+ tests pass
- Manual: query DB via Supabase Dashboard → see Vietnam time

## Commit

Phase A: `Codex docs: DB timezone display evaluation`

Phase C: `Codex feat: <option A/B/C implementation>`

## Out of scope

- Do NOT change app code that reads timestamps (`lib/datetime.ts` is correct)
- Do NOT migrate timestamp columns to non-tz types
- Do NOT change POS write path (`new Date().toISOString()` is correct)
- Do NOT modify already-deployed 0009 migration

## Coordination

This is the lowest-risk task. Suitable as a warm-up after token refresh.
