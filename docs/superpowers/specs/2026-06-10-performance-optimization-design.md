# Performance Optimization Design Spec - Vercel + Google Sheets

Date: 2026-06-10

## Constraints

- Database: Google Sheets (no migration)
- Deployment: Vercel (serverless, no persistent in-memory state)
- Data integrity: All data preserved, Google Sheets remains source of truth

## Part 1: Per-Sheet Cache Tags + Tiered Revalidation

### Current problem

`lib/sheets_db.ts` uses a single cache tag `'sheets'` for all sheets. Every write operation calls `revalidateTag('sheets')`, invalidating cache for ALL sheets across the entire app. Submitting 1 order wipes cache for Products, Units, Recipes, etc.

### Fix

**Per-sheet cache tags:** Each sheet gets its own tag `'sheets-{SheetName}'`. Write operations only invalidate the tag(s) for the sheet(s) they modified.

```
findAll("Orders") -> cache tag: 'sheets-Orders'
findAll("Products") -> cache tag: 'sheets-Products'
insert("Orders", data) -> revalidateTag('sheets-Orders')
```

For operations that modify multiple sheets (e.g., submitOrder writes Orders + Order_Lines + Stock_Ledger), invalidate all 3 tags.

**Tiered revalidation times:**

| Tier | Revalidation | Sheets |
|---|---|---|
| Static (300s) | 5 minutes | Units, Item_Categories, Product_Categories, Brands, Suppliers, Users |
| Dynamic (60s) | 1 minute | All other sheets |

### Implementation

Modify `lib/sheets_db.ts`:
- Add a `getCacheTag(sheetName)` helper returning `'sheets-' + sheetName`
- Add a `getRevalidation(sheetName)` helper returning 300 or 60 based on tier
- Update `findAll()` to use per-sheet tag and tiered revalidation
- Update `insert()`, `update()`, `remove()` to call `revalidateTag(getCacheTag(sheetName))` instead of global tag
- For multi-sheet operations (order submit, order delete), accept an array of sheet names to invalidate

### Affected files
- `lib/sheets_db.ts` - core cache logic
- Any server action that manually calls `revalidateTag('sheets')` - update to per-sheet tags

## Part 2: Reduce Redundant findAll Calls

### Current problem

- `/admin/orders` page fetches 5 sheets + calls `getOrders()` which fetches 5 more (3 overlap)
- `/admin/reports/pnl` page fetches 3 sheets for filters + `getPnLData()` fetches 9 more (some overlap)

### Fix

**Orders page:** Move all data fetching into `getOrders()` server action. The page component calls `getOrders()` and receives everything it needs. Remove direct `findAll` calls from the page.

**P&L report:** The filter data (Brands, Users, Categories) is needed by the page component for the filter UI. The `getPnLData()` action needs its 9 sheets. Since `unstable_cache` deduplicates within a render pass, calling `findAll("Products")` from both the page and the server action in the same request will hit cache on the second call. The main optimization is per-sheet tags from Part 1.

**POS page:** With per-sheet tags and 300s revalidation for Products/Categories/Modifiers, the POS will be fast after first load since these sheets rarely change.

### Affected files
- `app/admin/orders/page.tsx` - consolidate into server action
- `app/actions/orders.ts` - add filter data to return value

## Part 3: Batch Delete Operations

### Current problem

`deleteOrder()` in `app/actions/orders.ts` calls `remove()` individually for each Order_Line and Stock_Ledger row. Each `remove()` makes 3 API calls (findAll to find row, spreadsheets.get for sheetId, batchUpdate to delete). Deleting 1 order with 3 lines + 5 stock entries = 27 API calls.

`removeMany()` already exists in `lib/sheets_db.ts` and uses a single `batchUpdate` call for multiple rows.

### Fix

Refactor `deleteOrder()` to:
1. Find all matching Order_Lines -> collect their IDs
2. Find all matching Stock_Ledger entries -> collect their IDs
3. Call `removeMany("Order_Lines", lineIds)` - 1 API call
4. Call `removeMany("Stock_Ledger", stockIds)` - 1 API call
5. Call `remove("Orders", orderId)` - 1 API call

Result: 5 API calls instead of 27.

### Affected files
- `app/actions/orders.ts` - refactor `deleteOrder()`
- `app/actions/order-edit.ts` - similar pattern for old line cleanup during edit

## Part 4: Quick Wins

### 4a. Remove unused `@supabase/supabase-js` dependency

The app migrated from Supabase to Google Sheets. `@supabase/supabase-js` is in `package.json` but unused in the main application code. It is only referenced by `scripts/sync-supabase-sales.js` (one-time migration script, already completed) and `supabase/functions/` (legacy edge functions). Safe to remove - the migration is done and Supabase project is paused.

### 4b. Fix sequential fetch in Product Categories page

`app/admin/products/categories/page.tsx` fetches `Product_Categories` then `Products` sequentially. Wrap in `Promise.all` for parallel fetch.

## Implementation Sequence

1. Part 4a: Remove `@supabase/supabase-js` (quickest win)
2. Part 4b: Fix sequential fetch
3. Part 1: Per-sheet cache tags + tiered revalidation (highest impact)
4. Part 3: Batch delete operations
5. Part 2: Reduce redundant findAll calls

## Files to Modify

| File | Changes |
|---|---|
| `lib/sheets_db.ts` | Per-sheet tags, tiered revalidation |
| `app/actions/orders.ts` | Batch delete, remove redundant fetch |
| `app/actions/order-edit.ts` | Use removeMany for old lines |
| `app/actions/pos.ts` | Per-sheet revalidation tags |
| `app/admin/orders/page.tsx` | Consolidate data fetching |
| `app/admin/products/categories/page.tsx` | Parallel fetch |
| `package.json` | Remove @supabase/supabase-js |

## Expected Impact

| Metric | Before | After |
|---|---|---|
| POS load (warm cache) | ~2s | ~200ms |
| P&L load (warm cache) | ~3-5s | ~500ms |
| deleteOrder API calls | 27 | 5 |
| Cache invalidation scope | All sheets | Only modified sheets |
| Cold start bundle | +300KB supabase | Removed |
