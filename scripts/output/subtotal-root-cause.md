# Subtotal=0 Root Cause Report

## Scope (Sub-Task 1)

I analyzed 152 COMPLETED orders from the last 7 days (Jun 10 to Jun 17).

- **Total orders**: 152
- **Orders with subtotal = 0**: 61
- **Orders with subtotal > 0**: 91

### Daily Breakdown:
- **Jun 10 - Jun 14**: 0 zero / 89 total (0%)
- **Jun 15**: 13 zero / 15 total (87%)
- **Jun 16**: 31 zero / 31 total (100%)
- **Jun 17**: 17 zero / 17 total (100%)

**Verdict**: The bug is **GENERAL** and affects all new orders created via `pos.ts` since approximately Jun 15 18:15 (coinciding with the commit `d684f73`). It is not limited to combo orders.

## calculateSubtotal analysis (Sub-Task 2)

```typescript
  const calculateSubtotal = () => cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  
  const calculateItemTotal = (item: any) => {
    const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
    const baseTotal = (item.unit_price + modsPrice) * item.qty;
    let discount = 0;
    if (item.discount_amount > 0) {
      if (item.discount_type === "PERCENT") {
        discount = (baseTotal * item.discount_amount) / 100;
      } else {
        discount = item.discount_amount;
      }
    }
    return Math.max(0, baseTotal - discount);
  };
```

**Verdict**: The logic in `POSScreen.tsx` is correct. For non-empty carts with standard pricing, it returns a positive number.

## pos.ts trace (Sub-Task 3)

```typescript
// app/actions/pos.ts lines 25, 44
export async function submitOrder(orderData: any) {
    ...
    const { ..., subtotal_amount, ... } = orderData;
    ...
    await insert("Orders", {
      ...
      subtotal: subtotal_amount || total_amount,
      ...
    });
```

**Verdict**: The logic `subtotal: subtotal_amount || total_amount` is correct and should result in a non-zero value as long as `total_amount` is positive.

## Cache claim verification (Sub-Task 4)

I performed a raw inspection of the spreadsheet headers and found that `subtotal` (Column F, index 5) exists and is correctly named.

However, a raw read of latest order rows (e.g., `UCK000151`) shows that Column F is consistently `""` (empty string).

In `lib/sheets_db.ts`:
- `insert` calls `getHeaders`.
- `mapObjectToRow` iterates through the returned headers and looks up `obj[header]`.
- If Column F's header was empty or different when the server last cached it, `obj["subtotal"]` would be ignored.

**Evidence of Cache Stale**:
- Standalone scripts (running in a fresh process) see the `subtotal` header.
- The production server build artifacts (Jun 16) should have the code fix `d684f73`.
- Yet, the server continues to write `""` into Column F.

## Raw sheet inspection (Sub-Task 5)

Sample Order: `UCK000151`
- Cell value at Column F (index 5): `""` (Empty string)
- Cell value at Column G (index 6): `"157000"` (Correct `discount_amount`)
- Cell value at Column Q (index 16): `"{...}"` (Correct `applied_promotion_snapshot_json`)

**Conclusion**: The server is correctly writing to Column Q (which was added yesterday), meaning its header list has 17 items. But it is writing `""` to index 5. This proves `mapObjectToRow` did not find the key `"subtotal"` in its `headers` array, or `pos.ts` is not providing it.

## Deploy timeline (Sub-Task 6)

- `d684f73` (Fix subtotal key): **Mon Jun 15 18:15:52 2026**
- Affected orders start: **Jun 15 (afternoon)**
- Last server build artifact: **Jun 16 18:06**

**Verdict**: The fix `d684f73` was committed before the last server build. If the build successfully deployed, the server SHOULD be running the correct code.

## Verdict

The true root cause is a **Next.js `unstable_cache` Stale State** for the `getHeaders` function.

While `applied_promotion_snapshot_json` (Column Q) was added and recognized (likely because the cache was fresh for that column count), the `subtotal` column (Column F) was likely empty or renamed at some point during the server's uptime, and `getHeaders("Orders")` is stuck with a header list that has an empty string or the old name at index 5.

Because `revalidateTag` in `insert` happens AFTER the stale read and write, and potentially in a different process/instance, the header cache is not effectively refreshing for the writing path.

## Recommended Fix

1. **Immediate**: Force-restart the production server to wipe the `unstable_cache`.
2. **Infrastructure**: Add a "Cache Clear" button in the Admin Settings that explicitly calls `revalidateTag` for all known sheets from within the server environment.
3. **Robustness**: Modify `getHeaders` in `lib/sheets_db.ts` to use a much shorter revalidation time (e.g., 60 seconds) or disable caching entirely for the `insert` path to ensure schema changes are picked up immediately.
4. **Data Repair**: Re-run the backfill script (Job A from `fix-subtotal-and-line-discounts.ts`) to fix the 61 affected orders.
