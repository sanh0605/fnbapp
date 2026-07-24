# Materialized Inventory Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-ledger replay for current-stock reads with a transactionally maintained, ledger-derived balance table.

**Architecture:** `stock_ledger` remains authoritative. Migration `0038` creates and backfills `inventory_balances`; a trigger applies INSERT, DELETE, and UPDATE deltas in the same database transaction. Current-stock reads query this small table; MAC and effective-time calculations retain historical replay.

**Tech Stack:** PostgreSQL/Supabase migration and triggers, Next.js server actions, TypeScript, Vitest.

## Global Constraints

- Keep `stock_ledger` as quantity truth and `Order_Lines_V2.cost_at_sale` as COGS truth.
- Negative balances stay visible; no MAC/recovery behavior changes.
- Trigger and rebuild RPC are service-role-only and set `search_path = public`.
- Use TDD, one commit per task, and never push.

---

### Task 1: Transactional balance table and guard

**Files:**
- Create: `supabase/migrations/0038_materialize_inventory_balances.sql`
- Create: `lib/inventory-balance-migration.test.ts`

**Interfaces:**
- Produces `inventory_balances(item_reference text primary key, quantity numeric(18,6), updated_at timestamptz)`.
- Produces `trg_stock_ledger_inventory_balances` and `rebuild_inventory_balances()`.

- [ ] **Step 1: Write the failing migration guard**

```ts
const sql = readFileSync(resolve("supabase/migrations/0038_materialize_inventory_balances.sql"), "utf8").toLowerCase();
expect(sql).toContain("create table if not exists public.inventory_balances");
expect(sql).toContain("after insert or delete or update of item_reference, quantity_change");
expect(sql).toContain("on conflict (item_reference) do update");
expect(sql).toContain("old.quantity_change");
expect(sql).toContain("new.quantity_change");
expect(sql).toContain("function public.rebuild_inventory_balances()");
expect(sql).toContain("to service_role");
```

- [ ] **Step 2: Run the guard and observe RED**

Run: `node_modules\\.bin\\vitest.cmd run lib\\inventory-balance-migration.test.ts`

Expected: FAIL because migration `0038` is absent.

- [ ] **Step 3: Implement the migration**

Create the table and this signed-delta helper:

```sql
create or replace function public.apply_inventory_balance_delta(p_item_reference text, p_quantity_delta numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if nullif(btrim(coalesce(p_item_reference, '')), '') is null then return; end if;
  insert into public.inventory_balances (item_reference, quantity, updated_at)
  values (p_item_reference, p_quantity_delta, now())
  on conflict (item_reference) do update
  set quantity = public.inventory_balances.quantity + excluded.quantity,
      updated_at = now();
end;
$$;
```

The trigger adds `NEW.quantity_change` on INSERT, adds negated `OLD.quantity_change` on DELETE, and performs both operations on UPDATE. Backfill with grouped ledger sums. The rebuild RPC locks, truncates, re-aggregates, returns its inserted count, revokes public/anon/authenticated, and grants only service role.

- [ ] **Step 4: Run the guard and observe GREEN**

Run: `node_modules\\.bin\\vitest.cmd run lib\\inventory-balance-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -- supabase/migrations/0038_materialize_inventory_balances.sql lib/inventory-balance-migration.test.ts; git commit -m "Codex feat: materialize inventory balances"`

### Task 2: Read-only balance drift audit

**Files:**
- Create: `lib/inventory-balance-audit.ts`
- Create: `lib/inventory-balance-audit.test.ts`
- Create: `scripts/audit-inventory-balances.ts`

**Interfaces:**
- `auditInventoryBalances(ledgerRows, balanceRows, tolerance)` returns counts and mismatch samples.
- The CLI exits nonzero for a mismatch and never writes data.

- [ ] **Step 1: Write failing pure-function tests**

```ts
expect(auditInventoryBalances(
  [{ item_reference: "ING-1", quantity_change: 10 }, { item_reference: "ING-1", quantity_change: -3 }],
  [{ item_reference: "ING-1", quantity: 7 }],
).mismatchCount).toBe(0);
expect(auditInventoryBalances(
  [{ item_reference: "ING-1", quantity_change: 10 }],
  [{ item_reference: "ING-1", quantity: 9 }, { item_reference: "BTP-1", quantity: 0 }],
).mismatchCount).toBe(2);
```

- [ ] **Step 2: Run tests and observe RED**

Run: `node_modules\\.bin\\vitest.cmd run lib\\inventory-balance-audit.test.ts`

Expected: FAIL because `auditInventoryBalances` is absent.

- [ ] **Step 3: Implement pure comparison and wrapper**

The helper sums nonblank ledger references, unions ledger and balance keys, and flags a missing side or a delta greater than `0.000001`. The wrapper sets `CLI_MODE=true`, reads `Stock_Ledger` and `Inventory_Balances` through `findAllNoCache`, prints up to 20 samples plus `No data was written.`, and returns exit code 1 on a mismatch.

- [ ] **Step 4: Run tests and observe GREEN**

Run: `node_modules\\.bin\\vitest.cmd run lib\\inventory-balance-audit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -- lib/inventory-balance-audit.ts lib/inventory-balance-audit.test.ts scripts/audit-inventory-balances.ts; git commit -m "Codex audit: verify materialized inventory balances"`

### Task 3: Switch current-stock reads to balances

**Files:**
- Modify: `app/admin/inventory/actions.ts:419-465`
- Modify: `app/admin/inventory/actions.auth.test.ts`
- Modify: `app/pos/actions.ts:313-348`
- Modify: `app/pos/actions.auth.test.ts`

**Interfaces:**
- `getRealtimeStock()` keeps returning `{ id, name, item_type, current_stock, unitName }[]`.
- `getPOSStockStatus()` keeps returning `{ id, current_stock }[]`.

- [ ] **Step 1: Add failing action tests**

```ts
mocks.findAllNoCache.mockImplementation(async (sheet) => {
  if (sheet === "Inventory_Balances") return [{ item_reference: "BI-1", quantity: 7 }];
  throw new Error(`unexpected uncached read: ${sheet}`);
});
await expect(getStockStatus()).resolves.toEqual([
  { id: "BI-1", current_stock: 7 },
  { id: "BTP-1", current_stock: 0 },
]);
```

Add the equivalent admin assertion: missing balance means zero, non-inventory ingredients remain excluded, and `Stock_Ledger` is never requested.

- [ ] **Step 2: Run focused tests and observe RED**

Run: `node_modules\\.bin\\vitest.cmd run app\\admin\\inventory\\actions.auth.test.ts app\\pos\\actions.auth.test.ts`

Expected: FAIL because both loaders still request `Stock_Ledger`.

- [ ] **Step 3: Implement the query swap**

```ts
const balanceByItemId = new Map(
  (balances as any[]).map((row) => [String(row.item_reference), Number(row.quantity) || 0]),
);
```

Use `findAllNoCache("Inventory_Balances")` because it has one row per item and must reflect every committed ledger transaction. Preserve catalog filters and return types. Remove `sheets-Stock_Ledger` from these two loaders' cache tags.

- [ ] **Step 4: Run focused tests and observe GREEN**

Run: `node_modules\\.bin\\vitest.cmd run app\\admin\\inventory\\actions.auth.test.ts app\\pos\\actions.auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -- app/admin/inventory/actions.ts app/admin/inventory/actions.auth.test.ts app/pos/actions.ts app/pos/actions.auth.test.ts; git commit -m "Codex perf: read current stock from balances"`

### Task 4: Full verification and approved production deploy

**Files:** None.

- [ ] **Step 1: Run local merge gate**

Run: `node_modules\\.bin\\vitest.cmd run; node_modules\\.bin\\tsc.cmd --noEmit; node_modules\\.bin\\next.cmd build; git diff --check`

Expected: all commands pass.

- [ ] **Step 2: Verify planned migration**

Run: `supabase.cmd migration list`

Expected: only `0038` lacks a remote entry.

- [ ] **Step 3: Deploy approved migration**

Run: `supabase.cmd db push`

Expected: only `0038_materialize_inventory_balances.sql` is applied.

- [ ] **Step 4: Run read-only production audits**

Run: `node_modules\\.bin\\vite-node.cmd scripts\\audit-inventory-balances.ts; node_modules\\.bin\\vite-node.cmd scripts\\audit-current-stock.ts; node_modules\\.bin\\vite-node.cmd scripts\\audit-pnl-mac-consistency.ts`

Expected: zero balance mismatches, the existing three negative items only, and zero P&L MAC delta.

- [ ] **Step 5: Report outcome without pushing**

Report exact audit counts, migration status, and commit IDs. Do not push.
