# Performance Optimization - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce page load times by minimizing Google Sheets API calls - per-sheet cache tags, batch deletes, and removing dead weight.

**Architecture:** Modify `lib/sheets_db.ts` to use per-sheet cache tags instead of a single global tag. Refactor `deleteOrder()` to use batch delete. Remove unused Supabase dependency. Fix sequential fetch in categories page.

**Tech Stack:** Next.js `unstable_cache` with `revalidateTag`, Google Sheets API, Vercel deployment.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/sheets_db.ts` | Per-sheet cache tags, tiered revalidation |
| `app/actions/orders.ts` | Batch delete via `removeMany` |
| `app/admin/orders/page.tsx` | Remove redundant `findAll` calls |
| `app/admin/products/categories/page.tsx` | Parallel fetch |
| `package.json` | Remove `@supabase/supabase-js` |

---

### Task 1: Remove unused `@supabase/supabase-js` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove the dependency**

Run:
```bash
cd C:/Users/Admin/Desktop/fnbapp && npm uninstall @supabase/supabase-js
```

- [ ] **Step 2: Verify build still works**

Run: `npx next build 2>&1 | tail -5`
Expected: `Errors: 0 | Warnings: 0`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused @supabase/supabase-js dependency"
```

---

### Task 2: Fix sequential fetch in Product Categories page

**Files:**
- Modify: `app/admin/products/categories/page.tsx:5-7`

- [ ] **Step 1: Wrap the two sequential `findAll` calls in `Promise.all`**

Replace lines 5-7:

```typescript
  const categories = await findAll("Product_Categories");
  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const products = await findAll("Products");
```

With:

```typescript
  const [categories, products] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
  ]);
  const activeCategories = categories.filter(c => c.status !== "DELETED");
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/products/categories/page.tsx
git commit -m "perf: parallelize data fetching in product categories page"
```

---

### Task 3: Per-sheet cache tags + tiered revalidation in sheets_db.ts

This is the highest-impact change. Replace the single global `'sheets'` cache tag with per-sheet tags, and use tiered revalidation times.

**Files:**
- Modify: `lib/sheets_db.ts`

- [ ] **Step 1: Add helper functions at the top of the file (after the imports)**

Add after line 6 (`import { unstable_cache, revalidateTag } from 'next/cache';`):

```typescript
// Per-sheet cache tag: each sheet gets its own tag so writing to Orders
// does not invalidate the cache for Products, Units, etc.
const getCacheTag = (sheetName: string) => `sheets-${sheetName}`;

// Static sheets rarely change (5 min), dynamic sheets change often (60s)
const STATIC_SHEETS = new Set([
  'Units', 'Item_Categories', 'Product_Categories', 'Brands',
  'Suppliers', 'Users',
]);
const getRevalidation = (sheetName: string) => STATIC_SHEETS.has(sheetName) ? 300 : 60;
```

- [ ] **Step 2: Update `findAll` to use per-sheet tag and tiered revalidation**

Replace lines 57-69 (the `findAll` export):

```typescript
export const findAll = unstable_cache(
  async (sheetName: string) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z`,
    });
    return mapRowsToObjects(res.data.values || []);
  },
  ['sheets-findall'],
  { revalidate: 60, tags: ['sheets'] }
);
```

With:

```typescript
export const findAll = (sheetName: string) => {
  const tag = getCacheTag(sheetName);
  const reval = getRevalidation(sheetName);
  return unstable_cache(
    async (name: string) => {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${name}!A1:Z`,
      });
      return mapRowsToObjects(res.data.values || []);
    },
    ['sheets-findall', sheetName],
    { revalidate: reval, tags: [tag] }
  )(sheetName);
};
```

**Note:** The cache key `['sheets-findall', sheetName]` ensures each sheet has its own cache entry. The per-sheet `tag` ensures writing to one sheet doesn't invalidate others.

- [ ] **Step 3: Update `getHeaders` to use per-sheet tag**

Replace lines 88-99 (the `getHeaders` export):

```typescript
export const getHeaders = unstable_cache(
  async (sheetName: string): Promise<string[]> => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1`,
    });
    return res.data.values ? res.data.values[0] : [];
  },
  ['sheets-headers'],
  { revalidate: 3600, tags: ['sheets'] }
);
```

With:

```typescript
export const getHeaders = (sheetName: string) => {
  const tag = getCacheTag(sheetName);
  return unstable_cache(
    async (name: string): Promise<string[]> => {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${name}!A1:Z1`,
      });
      return res.data.values ? res.data.values[0] : [];
    },
    ['sheets-headers', sheetName],
    { revalidate: 3600, tags: [tag] }
  )(sheetName);
};
```

- [ ] **Step 4: Replace all `revalidateTag('sheets')` calls with per-sheet tags**

There are 5 occurrences of `revalidateTag('sheets')`. Replace each with `revalidateTag(getCacheTag(sheetName))`:

Line 138 in `insert()`:
```typescript
  revalidateTag(getCacheTag(sheetName));
```

Line 162 in `insertMany()`:
```typescript
  revalidateTag(getCacheTag(sheetName));
```

Line 211 in `update()`:
```typescript
  revalidateTag(getCacheTag(sheetName));
```

Line 264 in `remove()`:
```typescript
  revalidateTag(getCacheTag(sheetName));
```

Line 323 in `removeMany()`:
```typescript
  revalidateTag(getCacheTag(sheetName));
```

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: `Errors: 0 | Warnings: 0`

- [ ] **Step 6: Commit**

```bash
git add lib/sheets_db.ts
git commit -m "perf: per-sheet cache tags and tiered revalidation in sheets_db"
```

---

### Task 4: Refactor deleteOrder to use removeMany (27 -> 5 API calls)

**Files:**
- Modify: `app/actions/orders.ts:64-92`

- [ ] **Step 1: Update import to include `removeMany`**

Replace line 3:

```typescript
import { findAll, remove } from "@/lib/sheets_db";
```

With:

```typescript
import { findAll, remove, removeMany } from "@/lib/sheets_db";
```

- [ ] **Step 2: Replace the deleteOrder function body**

Replace lines 64-92 (the entire `deleteOrder` function):

```typescript
export async function deleteOrder(orderId: string) {
  try {
    // 1. Find all related rows
    const orderLines = await findAll("Order_Lines");
    const stockLedger = await findAll("Stock_Ledger");

    const lineIds = orderLines.filter((l: any) => l.order_id === orderId).map((l: any) => l.id);
    const stockIds = stockLedger.filter((s: any) => s.reference_id === orderId).map((s: any) => s.id);

    // 2. Batch delete lines and stock entries, then delete order
    if (stockIds.length > 0) await removeMany("Stock_Ledger", stockIds);
    if (lineIds.length > 0) await removeMany("Order_Lines", lineIds);
    await remove("Orders", orderId);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");
    return { success: true };
  } catch (error: any) {
    console.error("Lỗi xoá đơn:", error);
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: `Errors: 0 | Warnings: 0`

- [ ] **Step 4: Commit**

```bash
git add app/actions/orders.ts
git commit -m "perf: batch delete in deleteOrder using removeMany (27 -> 5 API calls)"
```

---

### Task 5: Consolidate orders page data fetching

**Files:**
- Modify: `app/actions/orders.ts` (add filter data to `getOrders` return)
- Modify: `app/admin/orders/page.tsx` (remove redundant `findAll` calls)

- [ ] **Step 1: Expand `getOrders()` to also return brands, products, variants, modifiers, categories**

Replace the `getOrders` function (lines 6-62) in `app/actions/orders.ts`:

```typescript
export async function getOrders() {
  try {
    const [orders, orderLines, products, variants, brands, modifiers, categories] = await Promise.all([
      findAll("Orders"),
      findAll("Order_Lines"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Brands"),
      findAll("Modifiers"),
      findAll("Product_Categories"),
    ]);

    const mappedOrders = orders.map(order => {
      const lines = orderLines.filter(l => l.order_id === order.id).map(line => {
        const product = products.find(p => p.id === line.product_id);
        const variant = variants.find(v => v.id === line.variant_id);
        let mods = [];
        try {
          if (line.modifiers_json) {
            mods = JSON.parse(line.modifiers_json);
          }
        } catch(e){}

        return {
          ...line,
          product_name: product?.name || "Unknown",
          size_name: variant?.size_name || "Unknown",
          modifiers: mods
        };
      });

      const brand = brands.find(b => b.id === order.brand_id);
      let display_order_no = order.order_no;
      if (display_order_no && display_order_no.startsWith('#')) {
        const numStr = display_order_no.replace('#', '').padStart(6, '0');
        const bCode = brand?.code || "ORD";
        display_order_no = `${bCode}${numStr}`;
      } else if (!display_order_no) {
         display_order_no = order.id;
      }

      return {
        ...order,
        display_order_no,
        lines
      };
    });

    mappedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return {
      orders: mappedOrders,
      brands: brands.filter((b: any) => b.status !== "DELETED"),
      products: products.filter((p: any) => p.status !== "DELETED"),
      variants: variants.filter((v: any) => v.status !== "DELETED"),
      modifiers: modifiers.filter((m: any) => m.status !== "DELETED"),
      categories: categories.filter((c: any) => c.status !== "DELETED"),
    };
  } catch (error: any) {
    console.error("Lỗi getOrders:", error);
    return { orders: [], brands: [], products: [], variants: [], modifiers: [], categories: [] };
  }
}
```

- [ ] **Step 2: Simplify the orders page to use only `getOrders()`**

Replace the entire content of `app/admin/orders/page.tsx`:

```typescript
import { getOrders } from "@/app/actions/orders";
import OrderTable from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { orders, brands, products, variants, modifiers, categories } = await getOrders();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Đơn hàng</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý và xem lại tất cả các đơn hàng đã được tạo.</p>
        </div>
        <div className="bg-orange-100 text-orange-700 font-bold px-4 py-2 rounded-lg">
          {orders.length} Đơn hàng
        </div>
      </div>

      <OrderTable
        initialOrders={orders}
        brands={brands}
        products={products}
        variants={variants}
        modifiers={modifiers}
        categories={categories}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: `Errors: 0 | Warnings: 0`

- [ ] **Step 4: Commit**

```bash
git add app/actions/orders.ts app/admin/orders/page.tsx
git commit -m "perf: consolidate orders page into single getOrders call (10 -> 7 findAll)"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Run full build**

Run: `npx next build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Start dev server and verify key pages**

Run: `npx next dev`

Open each page and verify it loads:
1. **POS** (`/pos`) - menu items display
2. **Dashboard** (`/admin`) - stats load
3. **Orders** (`/admin/orders`) - order list renders
4. **P&L Report** (`/admin/reports/pnl`) - report generates
5. **Sales Report** (`/admin/reports/sales`) - charts render
6. **Products** (`/admin/products`) - product list shows
7. **Categories** (`/admin/products/categories`) - category list shows

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification findings"
```
