# Codex Prompt — Timezone display implementation (Task 4, Phase C)

Date: 2026-07-09
Owner: Codex (Engine Lead)
Trigger: User approved narrowed Option A from Phase A eval (commit `f01c151`).

## Decision

User approved **Option A narrowed**: only `postgres` role gets timezone override. `service_role` and `authenticated` are NOT changed — preserves app/PostgREST behavior.

## Goal

Create migration file `supabase/migrations/0013_set_postgres_role_timezone.sql` containing the ALTER ROLE statement. Claude deploys + verifies separately.

## Implementation

Single migration file with:

1. **Preflight comment block**: document the "before change" queries (from Phase A eval §Test plan) so they're easy to run manually if needed
2. **ALTER ROLE statement**: 

```sql
ALTER ROLE postgres IN DATABASE postgres SET timezone TO 'Asia/Ho_Chi_Minh';
```

Use `current_database()` in a DO block if Supabase DB name might differ:

```sql
DO $$
BEGIN
  EXECUTE format(
    'ALTER ROLE postgres IN DATABASE %I SET timezone TO %L',
    current_database(),
    'Asia/Ho_Chi_Minh'
  );
END $$;
```

Codex pick whichever is safer. Document the choice in commit body.

3. **Verification comment block**: queries to run after deploy (from Phase A eval §Test plan)

## Verification

- `npx tsc --noEmit` -> 0 errors (no TS changes, sanity check)
- `npx vitest run` -> 320/320 pass (no test changes, sanity check)
- Migration file format valid SQL (parse via `supabase db lint` if available)
- No deploy, no manual DB queries

## Commit

Single commit:
```
Codex feat: set postgres role timezone to Asia/Ho_Chi_Minh (Task 4)
```

Commit body should document:
- Narrowed Option A (postgres role only, not service_role/authenticated)
- Reason: preserve app/PostgREST behavior, target Dashboard human inspection only
- Reversibility: `ALTER ROLE postgres IN DATABASE postgres RESET timezone`

## Out of scope

- Do NOT deploy migration (Claude deploys via `supabase db push`)
- Do NOT modify service_role or authenticated
- Do NOT change app code (`lib/datetime.ts` is already correct)
- Do NOT change UI display logic
- Do NOT write a runbook doc (Phase A eval doc is sufficient)

## Coordination

- Phase A eval: `docs/audits/2026-07-09-timezone-display-eval.md`
- After Codex commits, Claude will:
  1. `supabase db push` with SUPABASE_DB_PASSWORD env
  2. Open fresh Supabase Dashboard SQL Editor tab
  3. Run `SHOW timezone` -> expect `Asia/Ho_Chi_Minh`
  4. Compare `orders_v2.created_at` display vs UI
  5. If Table Editor still UTC, document as platform limitation
