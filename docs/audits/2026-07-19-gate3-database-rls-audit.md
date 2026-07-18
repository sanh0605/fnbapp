# Gate 3 Phase A — Live Database, RPC, and RLS Audit

- Date: 2026-07-19 (Asia/Ho_Chi_Minh)
- Mode: read-only evidence collection
- Structured evidence: [`2026-07-19-gate3-database-rls-audit.json`](2026-07-19-gate3-database-rls-audit.json)
- Re-runnable script: [`scripts/audit-gate3-database-security.ts`](../../scripts/audit-gate3-database-security.ts)

## Verdict

Gate 3 Phase A found no active raw-SQL RPC and no direct `anon` or
`authenticated` execution path to the ten live application RPCs. The P0
`exec_sql` stop gate did not fire.

The live database is more restrictive than the tracked migrations imply:
all 32 public tables have RLS enabled, none has a policy, and a publishable-key
probe against `users` returned zero rows. The Next.js server uses a privileged
service client, so the current operating model is server-only access with RLS
default-deny for public callers, not a browser Supabase client with user-facing
RLS policies.

Phase B hardening is still recommended. Twenty-eight tables retain broad
table-level grants to `anon` and `authenticated`; RLS currently blocks their
row access, but the grants are unnecessary in the present server-only model.
One orphaned `SECURITY DEFINER` function, `next_order_num`, also retains public
execution grants. Its target table does not exist, so it cannot currently
complete its write, but it should not remain dormant and automatically become
effective if that table is ever recreated.

No database row, schema object, grant, policy, secret, migration, or deployment
was changed during this audit.

## Evidence boundary

The script used Supabase Management API's
`/v1/projects/{ref}/database/query/read-only` endpoint. Supabase documents this
endpoint as executing SQL as `supabase_read_only_user`. All four catalog queries
were `SELECT` statements. The artifact records `databaseWritesAttempted: 0`.

Additional probes were also read-only:

- `public.exec_sql(query)` through the existing service client: PostgREST
  returned `PGRST202` (function not found in schema cache).
- `public.users?select=id&limit=1` through the current publishable key: HTTP 200,
  zero rows. No user field value was printed or retained.
- Production build and `.next/static` scan: 96 browser-static files checked;
  zero matches for the two key values and zero matches for
  `NEXT_PUBLIC_SUPABASE`, `SUPABASE_ANON_KEY`, or
  `SUPABASE_PUBLISHABLE_KEY` names.

## 1. Live RLS status and backup scope

| Measure | Result |
|---|---:|
| Public tables | 32 |
| RLS enabled | 32 |
| RLS forced | 0 |
| RLS policies | 0 |
| Live tables missing from backup allowlist | 0 |
| Backup-allowlisted tables missing live | 0 |

All public tables returned `relrowsecurity = true` and
`relforcerowsecurity = false`:

`audit_baseline_locks`, `backdated_ledger_events`, `base_ingredients`,
`brands`, `data_migration_runs`, `data_recovery_changes`, `item_categories`,
`modifiers`, `order_events`, `order_lines_v2`, `orders_v2`, `pos_drafts`,
`product_categories`, `product_price_history`, `product_variants`,
`production_items`, `production_orders`, `products`, `promotions`,
`purchase_order_lines`, `purchase_orders`, `purchase_sources`,
`purchased_items`, `recipes`, `semi_products`, `stock_adjustments`,
`stock_ledger`, `suppliers`, `sync_state`, `units`, `uom_conversions`, and
`users`.

`pg_policies` returned zero rows for `public`. With RLS enabled and no
applicable policy, ordinary row access is default-deny. The publishable-key
`users` probe independently confirmed that behavior at the PostgREST boundary.
The server's service-role client bypasses this RLS boundary by design.

The live list exactly matches the frozen 32-table backup allowlist. There is no
backup documentation gap in either direction.

The untracked live event trigger function `rls_auto_enable()` explains how RLS
can be enabled even though none of the 16 repository migrations contains
`ENABLE ROW LEVEL SECURITY`: it enables RLS automatically for newly created
public tables. This is live configuration drift from the migration record and
should be captured in a future reviewed migration or policy record; Phase A did
not alter it.

## 2. `anon` and `authenticated` table grants

Both roles have the same table-level grant pattern.

| Table group | Tables | Grants for each role |
|---|---:|---|
| Recovery/security tables | 4 | None |
| Remaining application tables | 28 | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |

The four fully revoked tables are `audit_baseline_locks`,
`backdated_ledger_events`, `data_migration_runs`, and
`data_recovery_changes`.

The remaining 28 tables retain broad grants, but row operations are currently
blocked by RLS default-deny. `TRUNCATE` is not governed by RLS; PostgREST does
not expose a normal table-TRUNCATE operation, and these database roles are used
as PostgREST JWT roles rather than direct login credentials. Even so, retaining
unused grants increases the impact of any future policy/configuration mistake.
Both roles have `USAGE` but not `CREATE` on schema `public`, so they cannot place
an attacker-controlled relation into the `SECURITY DEFINER` search path.
Phase B should decide whether to revoke all public table grants for the current
server-only architecture or introduce intentionally scoped policies for a
future browser client. It must not combine both models accidentally.

## 3. Raw-SQL RPC stop gate

Definitive result: **no live raw-SQL RPC was found**.

- `pg_proc` returned 16 public functions and no name matching `exec_sql`,
  `execute_sql`, `run_sql`, `query_sql`, or the reversed `sql_*` forms. The
  audit also inspected definitions for a text `query`/`sql`/`statement`/`command`
  argument passed directly to dynamic `EXECUTE`; no disguised raw-SQL RPC matched.
- `exec_sql` is absent from the live repository-RPC reconciliation.
- The existing `scripts/check-constraint-query.ts` service-role probe returned
  PostgREST `PGRST202`: no `public.exec_sql(query)` match in the schema cache.
- `get_table_constraints`, referenced only by another old diagnostic script,
  is also absent live.

Therefore neither `anon`, `authenticated`, nor `service_role` can call
`exec_sql` because the function does not exist. The two old check scripts are
stale diagnostics, not evidence of a current production RPC.

## 4. Application RPC security model

Ten repository RPCs exist live. Every one is owned by `postgres`, uses
`SECURITY DEFINER`, grants EXECUTE to `service_role`, denies EXECUTE to both
`anon` and `authenticated`, and has no internal caller/role-check signal in its
function definition.

| RPC | `anon` | `authenticated` | `service_role` | Internal caller check |
|---|---:|---:|---:|---|
| `apply_backdated_event_recovery` | No | No | Yes | None |
| `apply_hong_to_luc_migration` | No | No | Yes | None |
| `apply_mac_drift_recovery` | No | No | Yes | None |
| `apply_purchase_cost_recovery` | No | No | Yes | None |
| `create_pos_order_atomic` | No | No | Yes | None |
| `get_pos_inventory_state` | No | No | Yes | None |
| `mark_backdated_event_recomputed` | No | No | Yes | None |
| `reject_backdated_event` | No | No | Yes | None |
| `rollback_purchase_cost_recovery` | No | No | Yes | None |
| `save_purchase_order_atomic` | No | No | Yes | None |

What stops a direct PostgREST call from an authenticated-but-wrong-role caller:
the database EXECUTE grant itself. RLS is not the backstop for these functions
because `SECURITY DEFINER` executes with the owner's privileges. The Next.js
guard remains the human-role authorization layer; the service-only function
grant is the database-layer backstop. If that grant is accidentally broadened,
the function bodies do not independently reject the caller.

All ten set `search_path=public`. This is not a caller check, but the catalog
probe confirmed `anon` and `authenticated` lack schema `CREATE`, preventing
those roles from shadowing the referenced public objects.

Two repository-referenced diagnostic RPCs are not live:
`exec_sql` and `get_table_constraints`.

### Other public functions

| Function | Purpose/evidence | Public execution assessment |
|---|---|---|
| `flag_backdated_ledger_entry` | Trigger function | service only |
| `prevent_audit_locked_order_line_mutation` | Trigger function | service only |
| `get_my_role` | Reads the current user's role using `auth.uid()` | `anon`/`authenticated`; caller-scoped |
| `next_order_num` | Attempts an upsert into `order_counters` | `anon`/`authenticated`; orphaned risk |
| `rls_auto_enable` | Event-trigger function enabling RLS on new public tables | catalog EXECUTE remains public; special trigger return type |
| `touch_updated_at` | Row-trigger function | catalog EXECUTE remains public; trigger return type |

`next_order_num` deserves a separate Phase B decision. It is `SECURITY DEFINER`,
contains no caller check, and its body performs an upsert. However,
`to_regclass('public.order_counters')` and `to_regclass('order_counters')` both
returned null, so the function cannot currently complete that write. It is not
referenced by repository code or tracked migrations and has no function-local
`search_path` setting. The public caller roles cannot create the missing table,
but the function should still be removed or hardened before any owner-controlled
schema change recreates it. This is dormant attack
surface/configuration debris, not evidence that production data was changed.
Do not create `order_counters` before revoking or redesigning this function.

## 5. Publishable/anon key exposure

Confirmed against both source and a fresh production build:

- There is no `NEXT_PUBLIC_SUPABASE_*` source variable and no browser Supabase
  client implementation.
- Two server-side source references exist: the guarded server action
  `app/admin/backup/actions.ts` and maintenance helper
  `lib/task-3-recovery.ts`. Neither caused key material to enter the browser
  bundle.
- `npm run build` completed successfully.
- 96 files under `.next/static` contained zero instances of the live legacy anon
  key, the live publishable key, or their environment-variable names.
- The legacy anon key is disabled in the Supabase project; the current
  publishable key is the relevant public caller credential.

Conclusion: the current browser bundle does not disclose a Supabase API key.
This lowers practical reachability but is not the primary database control;
publishable keys are designed to be public, so RLS and grants must remain safe
even if the key is later intentionally shipped.

## Findings and Phase B inputs

| ID | Severity | Finding | Phase A disposition |
|---|---|---|---|
| G3-A1 | Pass | `exec_sql`/raw-SQL RPC absent | P0 stop gate cleared |
| G3-A2 | Pass | 10 live application RPCs are service-role-only | Defense-in-depth present |
| G3-A3 | Pass | 32/32 tables have RLS default-deny; publishable probe returned zero rows | Current public row access blocked |
| G3-A4 | Low | 28 tables retain unnecessary broad grants | Review/revoke in separately scoped Phase B |
| G3-A5 | Medium | Orphaned public `next_order_num` is `SECURITY DEFINER` and write-capable if its missing table reappears | Revoke/drop or redesign in Phase B |
| G3-A6 | Medium | Live RLS auto-enable event trigger is not represented in tracked migrations | Capture configuration provenance in Phase B |
| G3-A7 | Low | Sensitive RPC bodies rely on service-only grants and have no internal caller check | Preserve grant boundary; consider explicit defense-in-depth during future RPC changes |
| G3-A8 | Low | Two diagnostic scripts reference RPCs absent live | Script cleanup candidate; not fixed in this gate |

No evidence was found that data was exposed or modified through these gaps.
Any Phase B grant/RLS change requires a separately reviewed migration and
availability test because the production server depends on service-role bypass.

## Verification

- `vite-node scripts/audit-gate3-database-security.ts --output=...`: pass;
  raw-SQL stop gate false.
- Core audit tests: 7/7 pass, including a renamed raw-SQL RPC regression case.
- Full Vitest suite: 75 files / 445 tests pass.
- TypeScript: 0 errors. `git diff --check`: clean.
- Production Next.js build: pass.
- Publishable `users` SELECT probe: HTTP 200, zero rows.
- Database writes attempted: 0.
