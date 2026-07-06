# Antigravity Prompt — Snapshot-first lookup audit (POS cart, dashboard, reports)

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Priority: 3 (per roadmap)
Estimated effort: ~1 hour

## Goal

Audit all places where the UI displays HISTORICAL data (past orders, receipts, historical reports) using CURRENT catalog lookup instead of snapshot data. Fix the gaps that could cause display drift after catalog changes (price updates, product renames, migrations).

Context: the orders page bug (UCK000420 showed blank cell) was caused by this pattern. `app/admin/orders/actions.ts` already fixed. Audit other historical-data displays.

## Background principle

**Historical data** (orders, receipts, historical reports) = use SNAPSHOT first
**Current data** (product management, stock levels, live dashboards) = use CATALOG lookup

| Context | Use snapshot? |
|---|---|
| Order history list (`/admin/orders`) | ✅ Yes (done) |
| Order detail modal | ✅ Yes |
| Order edit modal | ✅ Yes |
| POS cart (live, current) | ❌ No — cart represents current products |
| POS processing overlay | ✅ Yes (items come from submitted order) |
| Product management (admin/products) | ❌ No — managing current catalog |
| Stock levels (`/admin/inventory/*`) | ❌ No — current stock |
| Reports (sales, P&L) | ⚠️ Mixed — revenue uses stored totals (snapshot), but product name/category for display is current. Usually OK for monthly reports |
| Admin dashboard (`/admin`) | ⚠️ Mixed — cup counts use current category, but data is today/recent so cache drift minimal |

## Files to audit

### 1. `components/pos/CartPanel.tsx:188` (PROCESSING OVERLAY)

Current:
```tsx
const matchedProduct = products.find((p: any) => p.id === item.product_id);
// ...
<p className="font-bold ...">{item.product_name || matchedProduct?.name}</p>
```

Issue: `item.product_name` is from cart snapshot (correct), but fallback uses catalog. When catalog drifts, fallback shows wrong/blank name.

Fix: trust snapshot entirely. Remove `matchedProduct` lookup OR keep but use `matchedProduct` only for non-display purposes (e.g., category check). Display name 100% from `item.product_name`.

If `item.product_name` is sometimes empty (edge case), surface as a POS bug to fix at order-build time, not paper over with catalog fallback.

### 2. `components/pos/CartItemRow.tsx:65` (LIVE CART ITEM)

```tsx
const currentProduct = products.find((p: any) => p.id === item.product_id);
```

This is LIVE cart (before checkout). User selects product → cart stores product_id + snapshot name + unit_price. `currentProduct` is used for... check what.

**Audit task:** trace all usages of `currentProduct` in this file. If used for display (name, price), confirm whether snapshot has these fields. If snapshot has them, switch to snapshot. If used for category/status checks, keep as catalog lookup.

### 3. `app/admin/page.tsx:158` (DASHBOARD CUP COUNTS)

```tsx
const p = products.find((p:any) => p.id === line.product_id);
if (p && toppingCats.includes(p.category_id)) return sum;
```

This counts "cups sold in topping category" for today vs yesterday dashboard. Uses CURRENT category lookup.

Issue: if a product was recategorized (e.g., moved out of toppings), historical cup counts shift. But for "today vs yesterday" this is fine — recent orders unlikely affected.

Decision: LOW priority. Defer to follow-up if needed. Document in commit body.

### 4. `app/admin/products/page.tsx:142` (PRODUCT LIST)

```tsx
const vName = productVariants.find(v => v.id === r.target_id)?.size_name || "";
```

This is product MANAGEMENT page, showing current variant sizes for current recipes. Catalog lookup is CORRECT here. Skip.

### 5. Reports pages (`app/admin/reports/sales/page.tsx`, `app/admin/reports/pnl/page.tsx`)

Audit how product/category names are displayed in reports:
- Revenue totals: stored aggregates (snapshot-like) — OK
- Top products: typically uses product_id join with current catalog — POTENTIAL ISSUE for historical reports
- Category breakdown: same concern

**Audit task:** check if reports use server actions that join with `Products`/`Product_Variants` tables for display names. If yes, consider switching to order line snapshot (`product_snapshot_json`) for historical accuracy.

## Approach

1. **Read each file** above
2. **Trace usages** of catalog lookups for display
3. **For historical-data contexts** (orders, receipts, reports), switch to snapshot-first
4. **For live contexts** (cart, admin product management, stock), leave alone
5. **Document decisions** in commit body (which files changed, which deferred, why)

## Pattern reference

From `app/admin/orders/actions.ts:135` (the fixed pattern):

```tsx
const productSnap = parseObject(line.product_snapshot_json);
const variantSnap = parseObject(line.variant_snapshot_json);

product_name: productSnap.name || product?.name || "Unknown",
size_name: variantSnap.size_name || variant?.size_name || "Unknown",
```

(Where `parseObject` is a safe JSON parser for null/string/object inputs.)

## Out of scope

- Do NOT change reports server actions if they use SQL aggregations (those use stored totals, not catalog lookup)
- Do NOT touch product management pages (catalog lookup is correct there)
- Do NOT migrate to a different state management library

## Verify

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual:
   - Open POS, add items to cart, checkout — verify processing overlay shows correct names
   - Open `/admin/reports/sales` with last 7 days filter — verify top products list shows correct names

## Commit

Suggested: `Antigravity fix: snapshot-first lookup in POS processing + reports (audit follow-up)`

## If audit finds NO real issues

If after audit, you conclude the current code is correct (e.g., all lookups are in live-data contexts), document findings in `docs/audits/2026-07-06-snapshot-first-audit.md` instead of changing code. Commit empty + audit doc.
