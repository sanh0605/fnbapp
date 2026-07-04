# Codex Prompt — REC-068 Cleanup + Hồng trà chanh → Lục trà chanh Migration

Date: 2026-07-04
Owner: Codex (Engine Lead)
Trigger: User decision 2026-07-04 after Phase 1 audit findings.

## User Intent (verbatim)

> "Xoá luôn REC-068, đối với các đơn từ sau ngày 29/06/2026 có bán Hồng trà chanh, đều đổi lại thành Lục trà chanh."
>
> "Đây là đổi sản phẩm nên sẽ ảnh hưởng cả stock ledger, giá vốn và cả tồn kho."
>
> "Cần audit timezone và chuyển sao cho dễ nhìn. Khi user nhìn vào database thấy 29/06/2026 00:00:00 thì cũng sẽ hiểu như mặt chữ và biết đó là được ghi nhận theo giờ Việt Nam."

## Confirmed Scope

- **Product exists:** "Lục trà chanh" already exists in `products` table with its own `product_id` and variant. Codex must audit to find the exact IDs.
- **Migration affects:** stock ledger, MAC COGS, inventory, order_lines, possibly more. This is NOT a text rename — it's a product swap on historical orders.
- **Timezone:** Asia/Ho_Chi_Minh (UTC+7). Filter `created_at >= '2026-06-29 00:00:00+07'`. Store timestamps with explicit +07 offset so DB queries display as-is.

## Goals

1. Delete `REC-068` recipe row (the corrupt Hồng trà chanh version with no Trái chanh).
2. Migrate all `order_lines` rows where:
   - `product_name = 'Hồng trà chanh'` (snapshot text), OR product_id matches the Hồng trà chanh product
   - Order `created_at >= '2026-06-29 00:00:00+07'`
   - Status: COMPLETED only (don't touch drafts/cancelled)
3. Change those order_lines to reference the **Lục trà chanh** product_id and variant_id.
4. Recalculate downstream impacts: stock ledger entries, MAC COGS allocations, inventory balances.
5. Provide dry-run + rollback plan + verification queries.

## Pre-flight Audit (DO THIS FIRST, before designing migration)

Produce a single audit document at `docs/audits/2026-07-04-hong-tra-chanh-migration-audit.md` with these sections:

### A. Product catalog audit

```sql
-- Find both products
SELECT id, name, category_id, active
FROM products
WHERE name ILIKE '%trà chanh%' OR name ILIKE '%tra chanh%';

-- Find variants
SELECT v.id, v.product_id, v.size_name, v.price, p.name
FROM product_variants v
JOIN products p ON p.id = v.product_id
WHERE p.name ILIKE '%trà chanh%' OR p.name ILIKE '%tra chanh%';
```

Document the exact `product_id` and `variant_id` for both Hồng trà chanh and Lục trà chanh.

### B. Recipe history audit

```sql
-- Recipes for both products
SELECT id, target_type, target_id, status, end_date, created_at,
       ingredients_json
FROM recipes
WHERE target_id IN (
  SELECT variant_id_from_above_for_both_products
);
```

Confirm whether Lục trà chanh has its own recipe chain. Determine which recipe is "effective" for each variant on 2026-06-29.

### C. Affected orders count

```sql
-- Asia/Ho_Chi_Minh = UTC+7. Count orders to migrate.
SELECT COUNT(*) AS affected_orders,
       MIN(created_at) AS earliest,
       MAX(created_at) AS latest
FROM orders o
JOIN order_lines ol ON ol.order_id = o.id
WHERE ol.product_name ILIKE '%Hồng trà chanh%'
  AND o.status = 'COMPLETED'
  AND o.created_at >= '2026-06-29 00:00:00+07';
```

Document the count + date range. User will sanity check.

### D. Stock ledger entries referencing Hồng trà chanh

```sql
-- Identify ledger entries that will need reallocation
SELECT COUNT(*) FROM stock_ledger
WHERE item_reference = '<hong_tra_chanh_variant_id>'
  AND created_at >= '2026-06-29 00:00:00+07';
```

Or whatever column Codex's `lib/mac-cogs.ts` uses for variant references.

### E. MAC ledger entries

```sql
SELECT COUNT(*) FROM mac_ledger
WHERE item_reference = '<hong_tra_chanh_variant_id>'
  AND created_at >= '2026-06-29 00:00:00+07';
```

### F. Timezone verification

```sql
-- Verify DB timezone setting
SHOW timezone;
SELECT NOW(), NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh';
```

Document current DB TZ. If DB is UTC, the migration script must use explicit `AT TIME ZONE 'Asia/Ho_Chi_Minh'` for filter.

## Migration Design

### Step 1: Backup

Create a Supabase snapshot before any write. Document the snapshot ID in the migration script.

```sql
-- Take Supabase logical backup
-- Document: pg_dump or supabase dashboard snapshot
```

### Step 2: Dry-run migration script

File: `scripts/migrate-hong-tra-to-luc-tra.ts`

Accept `--dry-run` flag (default). Print:
- Affected orders count
- Affected order_lines count
- Sample 5 order_lines with before/after diff
- Stock ledger entries to update
- MAC ledger entries to update
- Projected inventory balance changes for Hồng trà chanh variant (post-migration)
- Projected inventory balance changes for Lục trà chanh variant (post-migration)

Require `--apply` flag to actually write.

### Step 3: Migration logic

For each affected order_line:

1. Find the equivalent Lục trà chanh variant by `size_name` (S/M/L). If size doesn't exist in Lục trà chanh, FLAG for manual review (do not auto-migrate).
2. Update `product_id`, `variant_id`, `product_name` snapshot.
3. Recalculate `unit_price` — **DECISION POINT**: Use original Hồng trà chanh price (snapshot) OR Lục trà chanh's current price at order time? Default: keep original snapshot price to preserve revenue history. Document this in the audit doc.
4. Recompute `line_total`, discount allocations, etc. only if pricing changes.

For stock_ledger / mac_ledger entries on these orders:

1. Find entries whose `item_reference` = Hồng trà chanh variant.
2. **DECISION POINT**: Should we move them to Lục trà chanh? Or leave them as-is (acknowledging that historical stock movements stay attributed to Hồng trà chanh)?

   Default recommendation: **leave stock_ledger/mac_ledger entries AS-IS**. Rationale: those entries represent physical stock movements at the time, and the inventory WAS Hồng trà chanh at that moment. Migrating them would distort historical COGS for both products.

   Alternative: only migrate FUTURE stock movements. Past stays as Hồng trà chanh for accounting integrity.

3. Document the chosen approach in the audit doc with reasoning.

### Step 4: Recipe cleanup

- Delete `REC-068` row from `recipes` table. (Or set status to 'DELETED' if soft-delete is the pattern.)
- Verify no order_line snapshots reference REC-068 directly (orders store ingredient snapshots, not recipe_id, so this should be safe).
- Document whether Hồng trà chanh needs a NEW recipe (with Trái chanh) for the period before 29/06, or if older recipes (REC-062 to REC-067) are still valid.

## Verification Gates (after --apply)

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 278+ tests pass
3. Run audit script `scripts/audit-recipe-history.ts` → REC-068 gone, no new TRUE_DROP
4. Spot-check 3 migrated orders in `/admin/orders` UI:
   - Order shows "Lục trà chanh" in line items
   - Order total unchanged (or matches expected diff if pricing changed)
   - P&L report for 2026-06-29 shows Lục trà chanh revenue
5. MAC ledger reconciliation: total COGS for the day still matches pre-migration total ± expected diff
6. Inventory balances:
   - Hồng trà chanh variant stock = 0 (if all migrated)
   - Lục trà chanh variant stock unchanged (we didn't migrate ledger entries)

## Out of scope

- Do NOT touch orders before 2026-06-29
- Do NOT modify price lists for either product
- Do NOT delete the Hồng trà chanh product itself (defer to separate decision)
- Do NOT touch Cancelled/Draft orders
- Do NOT migrate modifier recipes (Phase 1.5 follow-up)

## Commit strategy

Suggested: one commit per phase for traceable history.

1. `Codex docs: hong-tra-chanh migration audit (pre-flight)` — the audit document
2. `Codex feat: migrate-hong-tra-to-luc-tra script (dry-run)` — script with `--dry-run` only
3. (User review of dry-run output, manual approval)
4. `Codex feat: apply hong-tra-to-luc-tra migration` — `--apply` execution + cleanup
5. `Codex docs: post-migration verification report` — verification results

## Risk callouts for user

- **Pricing decision**: keep original Hồng trà chanh price (safer) vs use Lục trà chanh price (more accurate). Default: keep original.
- **Stock ledger treatment**: leave past entries as Hồng trà chanh (safer) vs migrate to Lục trà chanh (more accurate but distorts historical COGS). Default: leave as-is.
- **Size coverage**: if Lục trà chanh lacks a size that Hồng trà chanh orders used, those orders need manual review.

Em/Codex must NOT proceed with `--apply` until user reviews the dry-run output and explicitly approves.

## Skills / Context

- Reference: `lib/mac-cogs.ts`, `lib/supabase.ts`, `lib/recipe-history-audit.ts`, `scripts/audit-recipe-history.ts`
- Existing audit doc: `docs/audits/2026-07-04-recipe-audit.md` (where REC-068 was identified)
- Test pattern: `lib/recipe-history-audit.test.ts` shows the testing conventions
