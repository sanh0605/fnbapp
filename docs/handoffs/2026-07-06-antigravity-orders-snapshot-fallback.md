# Antigravity Prompt — Orders page: snapshot-first product/variant name lookup

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Trigger: Post-migration UX issue — order UCK000420 showed blank product cell due to stale `findAll("Products")` cache missing newly-created PROD-042 (Lục trà chanh).

## Bug summary

User reported blank "Sản phẩm (Chi tiết)" cell for order UCK000420 in `/admin/orders`. Investigation:

- DB: `order_lines_v2.product_snapshot_json->>name = "Lục trà chanh"` (full data)
- Code: `app/admin/orders/actions.ts:135` uses `product?.name || "Unknown"` — looks up via `productById.get(line.product_id)`
- `productById` built from `findAll("Products")` — **CACHED** (vs `findAllNoCache`)
- Cache was stale → PROD-042 missing → `product?.name` undefined → fallback fired but cell rendered blank
- After page refresh, cache reloaded → cell shows correctly "2x Lục trà chanh (700ml)"

This is a **cache/catalog drift** issue. Migration created new products (PROD-042, PROD-043) that take time to propagate through caches. Snapshot data captured at order time is always correct.

## Files to fix

Only 2 places, both in `app/admin/orders/actions.ts`:

```text
app/admin/orders/actions.ts:135 - getOrdersV2 → product_name lookup
app/admin/orders/actions.ts:136 - getOrdersV2 → size_name lookup
app/admin/orders/actions.ts:231 - getOrderDetailV2 → product_name lookup
app/admin/orders/actions.ts:232 - getOrderDetailV2 → size_name lookup
```

## Fix design

Replace direct catalog lookup with **snapshot-first, catalog-fallback, "Unknown"-last-resort**:

```ts
// Current (buggy):
product_name: product?.name || "Unknown",
size_name: variant?.size_name || "Unknown",

// Fixed:
product_name: line.product_snapshot_json?.name || product?.name || "Unknown",
size_name: line.variant_snapshot_json?.size_name || variant?.size_name || "Unknown",
```

Rationale:
1. **Snapshot first** — captured at order time, always present for completed orders, immune to catalog changes/migrations
2. **Catalog fallback** — for edge cases (draft orders, missing snapshot, legacy data)
3. **"Unknown" last** — only if both sources missing

## Type safety

`product_snapshot_json` and `variant_snapshot_json` are JSONB columns. In Supabase they may come back as object or string depending on client config. Check current type definition:

```ts
// If typed as `Record<string, any> | null`:
line.product_snapshot_json?.name

// If typed as string (legacy):
JSON.parse(line.product_snapshot_json || "{}").name

// If unknown type, use parseObject helper from existing code
```

Verify the actual type in `lib/sheets_db.ts` serialize/deserialize logic. Apply consistently.

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual check:
   - Navigate to `/admin/orders`
   - Find UCK000420 — should show "2x Lục trà chanh (700ml)" even after `/admin/clear-cache`
   - Open order detail view — same expected
4. Stress test: temporarily comment out catalog lookup, verify snapshot-only path works
5. Test with older order (pre-migration Hồng trà chanh if any) — snapshot should still be correct

## Commit

Suggested: `Antigravity fix: snapshot-first product/variant name lookup in orders (cache drift fix)`

## Out of scope

- Do NOT change `findAll` caching strategy (engine scope, Codex)
- Do NOT migrate other similar lookups (POS cart, reports) — those use different patterns, separate audit
- Do NOT refactor data flow architecture
- Surgical: 4 lines changed, 1 file

## Why this matters

Future migrations / catalog changes will repeat this issue. Snapshot-first is the canonical pattern for order history display — orders represent frozen moments in time and should display using their captured context, not current catalog state.
