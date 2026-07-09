# DB viewer timezone display evaluation

Date: 2026-07-09
Owner: Codex
Scope: Phase A investigation and recommendation only. No database or app changes were applied.

## Goal

Make Supabase human database viewers easier to read by showing `timestamptz`
values in Vietnam time (`Asia/Ho_Chi_Minh`, UTC+7), while preserving the
correct storage contract: timestamps remain UTC instants in `timestamptz`
columns.

The app UI is already correct. `lib/datetime.ts` formats UI timestamps with
`Asia/Ho_Chi_Minh`, and `app/layout.tsx` sets server-side `process.env.TZ` to
the same zone. The remaining issue is human DB inspection in Supabase Dashboard.

## Local investigation

### Direct database probe

Requested live checks:

```sql
SHOW timezone;

SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('service_role', 'authenticated', 'postgres');
```

Result from this workspace: not verified.

Reasons:

- `psql` is not available in PATH.
- `.env.local` contains Supabase API keys but no direct Postgres connection
  string or database password.
- Prior project audit already found that `SHOW timezone` is not available
  through the current PostgREST schema exposure without adding a SQL RPC or
  using a direct Postgres connection.

No credentials were printed. No live DB state was changed.

### Existing project evidence

`docs/audits/2026-07-04-hong-tra-chanh-migration-audit.md` recorded that
PostgREST returned `timestamptz` values with `+00:00`, and that direct
`SHOW timezone` was not exposed through PostgREST. That is consistent with the
user-facing Supabase Dashboard observation: timestamps are rendered as UTC.

### PostgreSQL behavior

PostgreSQL stores `timestamp with time zone` internally as a UTC instant; the
original textual offset is not retained. On output, PostgreSQL converts the
stored value to the current session `TimeZone`. The `TimeZone` setting controls
both timestamp display and interpretation of timestamp input without an explicit
zone.

Role-level configuration is valid, but it becomes the default only when the
role starts a new session. `SET ROLE` inside an existing session does not
reload role-specific configuration, so tests must use a fresh connection or a
fresh Supabase Dashboard session.

References:

- PostgreSQL Date/Time Types: https://www.postgresql.org/docs/current/datatype-datetime.html
- PostgreSQL `TimeZone` client default: https://www.postgresql.org/docs/current/runtime-config-client.html
- PostgreSQL `ALTER ROLE ... SET`: https://www.postgresql.org/docs/current/sql-alterrole.html

## Options evaluated

### Option A: role-level timezone

Set a role's session default:

```sql
ALTER ROLE postgres IN DATABASE <db_name>
SET timezone TO 'Asia/Ho_Chi_Minh';
```

Potential broader version:

```sql
ALTER ROLE service_role IN DATABASE <db_name>
SET timezone TO 'Asia/Ho_Chi_Minh';

ALTER ROLE authenticated IN DATABASE <db_name>
SET timezone TO 'Asia/Ho_Chi_Minh';

ALTER ROLE postgres IN DATABASE <db_name>
SET timezone TO 'Asia/Ho_Chi_Minh';
```

Assessment:

- Best chance to affect Supabase SQL Editor and Table Editor, if those sessions
  connect as `postgres` or another role with the configured default.
- Reversible.
- No app code change.
- Risk depends on which roles are changed.
- Changing `service_role` or `authenticated` can affect PostgREST/app queries
  and any SQL that interprets zone-less timestamps.

Important constraint: role defaults apply at login. Existing pooled sessions or
Dashboard tabs may need refresh/reconnect before the change is visible.

### Option B: app session timezone RPC

Create a function such as `set_session_timezone(text)` and call it from app
code after creating the Supabase client.

Assessment:

- Does not solve the actual Dashboard/Table Editor problem.
- Adds lifecycle complexity because Supabase/PostgREST uses connection pooling.
- Risks introducing stateful session assumptions into app code.

Rejected for this goal.

### Option C: manual SQL helper/runbook

Use:

```sql
SET TIME ZONE 'Asia/Ho_Chi_Minh';
```

before manual SQL inspection.

Assessment:

- Safest and immediately usable in SQL Editor.
- Does not affect app behavior.
- Does not help Table Editor.
- Easy for one-off audits, poor for daily inspection.

Useful fallback, but it does not meet the Table Editor/default-display goal.

## Recommendation

Recommend Option A, but only for the human Dashboard role first.

Do not initially set timezone for `service_role` or `authenticated`.

Proposed first rollout:

```sql
SELECT current_database();

ALTER ROLE postgres IN DATABASE <db_name>
SET timezone TO 'Asia/Ho_Chi_Minh';
```

Why this narrower Option A:

- It targets the problem surface: Supabase Dashboard human inspection.
- It avoids changing app/PostgREST behavior unless evidence shows Dashboard
  uses `service_role` or `authenticated`.
- It preserves the `timestamptz` storage model.
- It is reversible with one SQL statement.

If verification shows Supabase Dashboard does not use `postgres`, stop and
identify the actual role before changing more roles.

## Risk assessment

Low if limited to `postgres`:

- Direct SQL Editor output changes from UTC to Vietnam time.
- Any manual SQL run as `postgres` that inserts a timestamp without explicit
  timezone will interpret that input as Vietnam local time.
- Stored values remain UTC instants.
- App code using Supabase service role should not be affected if `service_role`
  is not changed.

Medium if applied to `service_role` or `authenticated`:

- PostgREST and server-side Supabase client sessions may render `timestamptz`
  strings with `+07:00` instead of `+00:00`.
- Code that parses returned timestamp strings as instants should remain correct,
  but tests/snapshots/string comparisons could drift.
- Zone-less timestamp input would be interpreted in Vietnam time instead of UTC.

## Reversibility

For the narrowed rollout:

```sql
ALTER ROLE postgres IN DATABASE <db_name>
RESET timezone;
```

If broader roles were ever changed:

```sql
ALTER ROLE service_role IN DATABASE <db_name>
RESET timezone;

ALTER ROLE authenticated IN DATABASE <db_name>
RESET timezone;

ALTER ROLE postgres IN DATABASE <db_name>
RESET timezone;
```

Open sessions may need to reconnect before reset behavior is visible.

## Test plan

Before change, from a direct Postgres connection:

```sql
SELECT current_database();
SHOW timezone;

SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('service_role', 'authenticated', 'postgres');

SELECT
  now() AS now_default,
  now() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS now_vn;
```

Apply only `postgres` role default, then start a new SQL Editor session or
direct `postgres` connection and run:

```sql
SHOW timezone;

SELECT
  created_at,
  created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS created_at_vn
FROM orders_v2
ORDER BY created_at DESC
LIMIT 5;
```

Expected:

- `SHOW timezone` returns `Asia/Ho_Chi_Minh` for the Dashboard/direct
  `postgres` session.
- `created_at` displays with `+07`.
- `created_at_vn` matches the wall-clock date/time shown in the app UI.
- App UI remains unchanged.

If SQL Editor changes but Table Editor does not, Supabase Table Editor is not
using the same session/role display path; do not broaden role changes until
that is verified.

## Rollout plan

1. Use a direct Postgres connection or Supabase SQL Editor as an admin.
2. Capture current state with the “before change” test queries above.
3. Apply only:

   ```sql
   ALTER ROLE postgres IN DATABASE <db_name>
   SET timezone TO 'Asia/Ho_Chi_Minh';
   ```

4. Open a fresh SQL Editor tab/session and verify `SHOW timezone`.
5. Check a recent `orders_v2.created_at` row against the app UI.
6. Check Table Editor display.
7. If Table Editor still shows UTC, stop and document that platform surface as
   unsupported by role default before expanding scope.
8. If anything unexpected happens, run the reset statement and reconnect.

## Decision needed

Approve one of these:

1. Proceed with narrowed Option A: `postgres` role only.
2. Use Option C only: document manual `SET TIME ZONE` workflow.
3. Provide direct DB credentials/tooling first so Codex can run the live
   `SHOW timezone` and `pg_roles` checks before choosing.
