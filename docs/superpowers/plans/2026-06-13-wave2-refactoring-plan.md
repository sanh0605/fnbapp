# Wave 2 Refactoring Plan (Operations)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 4 Operations features (Purchased Items, Purchase Orders, Semi-products, Production) to feature-colocated architecture with StickyFilterBar, shared UI primitives, and strict TypeScript types. **ABSOLUTELY NO changes to business logic, calculations, or Stock Ledger writes.**

**Architecture:** Each feature gets its own `components/` and `actions.ts` inside `app/admin/[feature]/`. Pages become slim server components passing typed data to client components. Client components render `StickyFilterBar` with integrated filters (text search, status dropdowns, date pickers). Forms use `FormModal`, `LoadingButton`, `DeleteConfirmModal`. Actions use `lib/shared-actions.ts` for simple CRUD; complex functions are moved verbatim.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Google Sheets via `lib/sheets_db.ts`

**Supreme Constraints:**
1. **DO NOT alter any calculation** -- FIFO cost allocation, stock ledger entries, recipe versioning, unit conversion math must remain byte-for-byte identical.
2. **DO NOT add new business logic** -- only restructure, type, and colocate.
3. **DO NOT fix bugs that change behavior** -- document bugs but preserve current behavior exactly.

---

## Part 1: Audit Findings Summary

### Per-Feature Critical Logic Map

#### 1. Purchased Items

| File | Lines | Critical Logic |
|------|-------|----------------|
| `app/admin/inventory/items/page.tsx` | 77 | Fetches 5 sheets, resolves category/ingredient names |
| `components/InventoryForms.tsx` (PurchasedItemForm) | ~200 | `isRaw` conditional rendering, unit name-to-ID round-trip, batch unit validation, `units_json` payload construction |
| `app/actions/inventory.ts` (add/update/delete) | ~130 | `addPurchasedItem`: creates Purchased_Item + N UOM_Conversions. `updatePurchasedItem`: syncs conversions (upsert + delete removed), `update_history` cascade rewrites PO line units. **Double update bug on PO lines** (preserved). |

**Stock Ledger involvement:** None (items themselves don't touch stock ledger).

#### 2. Purchase Orders (MOST CRITICAL)

| File | Lines | Critical Logic |
|------|-------|----------------|
| `app/admin/inventory/purchase-orders/page.tsx` | 85 | Lists POs with status badges |
| `app/admin/inventory/purchase-orders/new/page.tsx` | 45 | Fetches 6 sheets, renders PurchaseOrderForm |
| `app/admin/inventory/purchase-orders/[id]/page.tsx` | 142 | Fetches 8 sheets, renders detail (COMPLETED) or edit form (DRAFT) |
| `components/PurchaseOrderForm.tsx` | 428 | Line item management, unit conversion auto-fill, landed cost computation, two submit modes (DRAFT/COMPLETED), inline SupplierModal |
| `app/actions/purchase-orders.ts` | 157 | **savePurchaseOrder**: PO header upsert, delete-all-and-recreate PO lines, **Stock Ledger writes for COMPLETED** (base unit conversion, proportional landed cost allocation, unit_cost = landed_cost_total / quantity_change) |

**CRITICAL MATH in `savePurchaseOrder` (lines 99-133):**
```typescript
// Base unit conversion
if (line.base_ingredient_id) {
  item_reference = line.base_ingredient_id;
  if (convRate) quantity_change = quantity_change * Number(convRate);
}
// Proportional landed cost allocation
const line_proportion = line_subtotal / subtotal_amount;
const allocated_extra = total_extra_costs * line_proportion;
const landed_cost_total = line_subtotal + allocated_extra;
const unit_cost = quantity_change > 0 ? landed_cost_total / quantity_change : 0;
```
This must be preserved **exactly** -- no variable renames, no refactoring of the arithmetic.

#### 3. Semi-products

| File | Lines | Critical Logic |
|------|-------|----------------|
| `app/admin/semi-products/page.tsx` | 165 | Fetches 4 sheets, joins semi-products with recipes, builds recipe history with ingredient resolution |
| `components/SemiProductForm.tsx` | 289 | `ingredients_json` management, self-reference prevention, `batch_yield`, unit resolution per ingredient |
| `app/actions/recipes.ts` | 103 | `saveSemiProduct`: upsert semi-product + **recipe versioning** (close old recipe by setting `end_date`, create new if `ingredients_json` changed). `deleteSemiProduct`: soft delete. |

**CRITICAL RECIPE VERSIONING in `saveSemiProduct` (lines 41-85):**
- Fetches all recipes, finds active one (empty `end_date`)
- Compares `ingredients_json` strings
- If changed: closes old (sets `end_date = nowIso`), creates new row with `end_date = ""`
- `nowIso` uses `effectiveDateStr` if provided, else `new Date().toISOString()`

**Known bugs (PRESERVED, NOT FIXED):**
- `deleteSemiProduct` revalidates wrong path (`/admin/inventory/semi-products` instead of `/admin/semi-products`)
- Recipe lookup on page uses `.find()` without `end_date` filter (may return stale recipe)

#### 4. Production

| File | Lines | Critical Logic |
|------|-------|----------------|
| `app/admin/production/page.tsx` | 112 | Fetches 6 sheets, renders history table with ingredient details |
| `components/ProductionForm.tsx` | 233 | Semi-product selection -> recipe lookup -> ingredient multiplier calculation (`targetYield / batch_yield`), manual quantity override, `consumed_ingredients` JSON payload |
| `app/actions/production.ts` | 84 | `saveProductionOrder`: creates Production_Order + Production_Item + **N Stock_Ledger CONSUME entries** (negative, `unit_cost: 0`) + **1 Stock_Ledger YIELD entry** (positive, `unit_cost: 0`) |

**CRITICAL MATH in `ProductionForm` (useEffect, lines 23-68):**
```typescript
const multiplier = (Number(targetYield) || 0) / yieldPerBatch;
const defaultQty = Number(ing.quantity) * multiplier;
const roundedQty = Math.round(defaultQty * 100) / 100;
```

**CRITICAL STOCK LEDGER in `saveProductionOrder` (lines 49-76):**
- For each non-inventory ingredient: `Stock_Ledger` with `transaction_type: "PRODUCTION_CONSUME"`, `quantity_change: -qtyRequired`, `unit_cost: 0`
- One yield entry: `transaction_type: "PRODUCTION_YIELD"`, `quantity_change: target_yield`, `unit_cost: 0`

**Known issue (PRESERVED):** `unit_cost` is always 0 for both consumption and yield.

---

### Cross-Feature Dependency Map

```
PurchaseOrderForm.tsx
  |-- imports SupplierModal from components/SupplierForm.tsx (NOT in Wave 2)
  |-- imports savePurchaseOrder, addPurchaseSource from app/actions/purchase-orders.ts
  |-- imports SearchableSelect, CustomDatePicker

InventoryForms.tsx (PurchasedItemForm)
  |-- imports addPurchasedItem, updatePurchasedItem from app/actions/inventory.ts
  |-- imports SearchableSelect
  |-- also contains ItemCategoryForm, DeleteBtn, ActionGroup (NOT in Wave 2)

SemiProductForm.tsx
  |-- imports saveSemiProduct from app/actions/recipes.ts
  |-- imports SearchableSelect, CustomDatePicker

ProductionForm.tsx
  |-- imports saveProductionOrder from app/actions/production.ts
```

### Files NOT to Modify

| File | Reason |
|------|--------|
| `components/SupplierForm.tsx` | Contains `SupplierModal` used by `PurchaseOrderForm` |
| `app/actions/suppliers.ts` | Imported by old `SupplierForm.tsx` |
| `components/InventoryForms.tsx` | Still contains `ItemCategoryForm`, `DeleteBtn`, `ActionGroup` for non-Wave-2 pages |
| `app/actions/inventory.ts` | Still contains `addItemCategory`, `updateItemCategory`, `deleteItemCategory`, `addUnit`, `updateUnit`, `deleteUnit` for non-Wave-2 pages |
| `components/HistoryModal.tsx` | Shared by multiple pages, stays in `components/` |
| `app/actions/reports.ts` | Contains MAC/COGS logic -- NOT in any wave |
| `app/actions/pos.ts` | Contains POS order logic -- NOT in any wave |
| `app/actions/order-edit.ts` | Contains order edit logic -- NOT in any wave |

---

## Part 2: Execution Plan

### Task 1: Purchased Items

**Files to create:**
- `app/admin/inventory/items/actions.ts`
- `app/admin/inventory/items/components/PurchasedItemForm.tsx`
- `app/admin/inventory/items/components/ItemsClient.tsx`

**Files to modify:**
- `app/admin/inventory/items/page.tsx`

**Files NOT to modify:**
- `components/InventoryForms.tsx` -- KEEP (ItemCategoryForm, DeleteBtn for other pages)
- `app/actions/inventory.ts` -- KEEP (items/categories/units functions for other pages)

---

- [ ] **Step 1.1: Create `app/admin/inventory/items/actions.ts`**

Extract `addPurchasedItem`, `updatePurchasedItem`, `deletePurchasedItem` from `app/actions/inventory.ts`. **Copy the EXACT function bodies** -- no logic changes, no refactoring of the double-update bug on PO lines.

```typescript
"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBBaseIngredient, DBUnit } from "@/types/db";

const SHEET = "Purchased_Items";
const PATH = "/admin/inventory/items";

export async function getItemsData(): Promise<{
  categories: DBItemCategory[];
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}> {
  try {
    const [categories, baseIngredients, items, conversions, allUnits] = await Promise.all([
      findAll("Item_Categories") as Promise<DBItemCategory[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll(SHEET) as Promise<DBPurchasedItem[]>,
      findAll("UOM_Conversions") as Promise<DBUOMConversion[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { categories, baseIngredients, items, conversions, units };
  } catch (error) {
    console.error("Loi getItemsData:", error);
    return { categories: [], baseIngredients: [], items: [], conversions: [], units: [] };
  }
}

// --- COPY addPurchasedItem EXACTLY from app/actions/inventory.ts lines 119-160 ---
// No logic changes. Preserve: ID prefix "SPM", conversion creation with prefix "QD",
// the condition (base_ingredient_id && unitsJson && base_unit), revalidation of both paths.
export async function addPurchasedItem(formData: FormData): Promise<ActionResponse> {
  // ... exact copy of original function body ...
}

// --- COPY updatePurchasedItem EXACTLY from app/actions/inventory.ts lines 162-237 ---
// PRESERVE: double update bug on PO lines (lines 195-197), conversion upsert+delete pattern,
// update_history cascade, the condition check for conversion handling.
export async function updatePurchasedItem(formData: FormData): Promise<ActionResponse> {
  // ... exact copy of original function body ...
}

// --- COPY deletePurchasedItem EXACTLY from app/actions/inventory.ts lines 239-248 ---
// PRESERVE: no cascading deletes, revalidation of items path only.
export async function deletePurchasedItemAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
```

**Named `deletePurchasedItemAction`** to avoid collision with `deletePurchasedItem` in the old `inventory.ts`.

**CRITICAL:** The `addPurchasedItem` and `updatePurchasedItem` functions must be copied **byte-for-byte** from the original. Do not rename variables, do not refactor the double-update pattern, do not add validation. The only changes allowed are:
1. Function signature: add `Promise<ActionResponse>` return type
2. Error catch: change `error: any` to `error: unknown` with type narrowing
3. Return values: use `ok()` / `fail()` wrappers

- [ ] **Step 1.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.3: Create `app/admin/inventory/items/components/PurchasedItemForm.tsx`**

New form component using shared UI primitives. Preserves the `isRaw` conditional rendering, unit name-to-ID round-trip, batch unit validation (fixes items[0]-only bug from Wave 1 pattern), and `update_history` checkbox.

**Props interface:**
```typescript
interface PurchasedItemFormProps {
  itemCategories: DBItemCategory[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
  initialData?: DBPurchasedItem;
  initialConversions?: DBUOMConversion[];
}
```

**Structure:**
- Named export `PurchasedItemForm`
- Uses `FormModal`, `LoadingButton`
- State: `isOpen`, `loading`, `selectedCategoryId`, `selectedBaseIngredientId`, `unitsState` (array of `{id?, name, conversion_rate}`)
- Derived: `isRaw` from selected category's `system_type`, `baseUnitId`/`baseUnitName` from selected base ingredient
- `handleSubmit`: validates ALL unit rows (not just first), resolves unit names to IDs, builds `units_json` and `base_unit` FormData fields
- In edit mode: `update_history` checkbox (default checked)
- Form fields: name (text), item_category_id (select with category options), base_ingredient_id (SearchableSelect, shown only when `isRaw`), unit conversion rows (shown only when `isRaw`)

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { addPurchasedItem, updatePurchasedItem } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBBaseIngredient, DBUnit } from "@/types/db";
```

- [ ] **Step 1.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.5: Create `app/admin/inventory/items/components/ItemsClient.tsx`**

**Props interface:**
```typescript
interface ItemsClientProps {
  categories: DBItemCategory[];
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}
```

**Structure:**
- State: `search` (string), `categoryFilter` (string, default "ALL")
- `useMemo`: filter items by name matching search, by `item_category_id` matching category filter
- `StickyFilterBar` with `title="Quan ly Hang Mua Vao"`, `rightContent={<PurchasedItemForm ... />}`
- Filter children: text input + category dropdown
- Table columns: ID, Ten, Phan Loai (category name), Nguyen Lieu Goc (base ingredient name), Thao Tac
- Per-row: `<PurchasedItemForm initialData={item} ... />` (edit) + delete button using `DeleteConfirmModal`
- Delete button is a local component calling `deletePurchasedItemAction`

- [ ] **Step 1.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.7: Update `app/admin/inventory/items/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { PurchasedItemForm, DeleteBtn } from "@/components/InventoryForms";
import { deletePurchasedItem } from "@/app/actions/inventory";
import Link from "next/link";
```

**New imports:**
```typescript
import { getItemsData } from "./actions";
import ItemsClient from "./components/ItemsClient";
```

**New page body:**
```typescript
export default async function ItemsPage() {
  const data = await getItemsData();
  return <ItemsClient {...data} />;
}
```

- [ ] **Step 1.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/inventory/items` -- table loads, filters work
Test: add item (RAW with conversions, non-RAW without), edit item (verify `update_history` checkbox), delete
Verify: conversion rows display and save correctly

- [ ] **Step 1.9: Commit**

```bash
rtk git add app/admin/inventory/items/
rtk git commit -m "refactor(items): colocate actions, forms, add StickyFilterBar and type safety"
```

---

### Task 2: Purchase Orders (MOST CRITICAL)

**This is the highest-risk task.** The `savePurchaseOrder` function creates Stock Ledger entries with cost calculations. Every line of math must be preserved.

**Files to create:**
- `app/admin/inventory/purchase-orders/actions.ts`
- `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`
- `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`

**Files to modify:**
- `app/admin/inventory/purchase-orders/page.tsx`
- `app/admin/inventory/purchase-orders/new/page.tsx`
- `app/admin/inventory/purchase-orders/[id]/page.tsx`

**Files NOT to modify:**
- `components/PurchaseOrderForm.tsx` -- KEEP (will be cleaned up later)
- `app/actions/purchase-orders.ts` -- KEEP (old form still imports from here)
- `components/SupplierForm.tsx` -- KEEP (SupplierModal used by PO form)

---

- [ ] **Step 2.1: Create `app/admin/inventory/purchase-orders/actions.ts`**

Copy `savePurchaseOrder` and `addPurchaseSource` **exactly** from `app/actions/purchase-orders.ts`. No logic changes. No variable renames. No arithmetic refactoring.

```typescript
"use server";

import { findAll, insert, update, generateNewId, remove } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPurchaseOrder, DBSupplier, DBPurchaseSource } from "@/types/db";

const PATH = "/admin/inventory/purchase-orders";

export async function getPurchaseOrdersData(): Promise<{
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
}> {
  try {
    const [orders, suppliers] = await Promise.all([
      findAll("Purchase_Orders") as Promise<DBPurchaseOrder[]>,
      findAll("Suppliers") as Promise<DBSupplier[]>,
    ]);
    return { orders, suppliers };
  } catch (error) {
    console.error("Loi getPurchaseOrdersData:", error);
    return { orders: [], suppliers: [] };
  }
}

export async function getPurchaseOrderDetail(poId: string) {
  // Fetches PO + lines + items + ingredients + units + suppliers + conversions + sources
  // Returns typed data for the detail/edit page
  // ... exact data fetching logic from [id]/page.tsx ...
}

// --- COPY savePurchaseOrder EXACTLY from app/actions/purchase-orders.ts ---
// PRESERVE ALL: 
//   - effectiveDate calculation
//   - status validation (COMPLETED only)
//   - total_amount = subtotal + shipping + tax - voucher - discount
//   - total_extra_costs = shipping + tax - voucher - discount
//   - delete-all-old-lines + recreate pattern
//   - base unit conversion (item_reference = base_ingredient_id if exists)
//   - quantity_change *= conversion_rate
//   - proportional landed cost allocation
//   - unit_cost = landed_cost_total / quantity_change
//   - Stock_Ledger insert with PO_RECEIPT transaction_type
//   - revalidation path
export async function savePurchaseOrder(formData: FormData): Promise<ActionResponse> {
  // ... exact copy of original function body ...
}

// --- COPY addPurchaseSource EXACTLY ---
export async function addPurchaseSource(name: string): Promise<ActionResponse> {
  // ... exact copy ...
}
```

**CRITICAL VERIFICATION after copying:**
- Confirm the landed cost allocation formula is identical: `line_proportion = line_subtotal / subtotal_amount`
- Confirm `unit_cost = quantity_change > 0 ? landed_cost_total / quantity_change : 0`
- Confirm Stock Ledger `transaction_type: "PO_RECEIPT"` and `item_reference` resolution
- Confirm `quantity_change` conversion: `quantity_change = quantity_change * Number(convRate)`
- The ONLY allowed changes are: add return types, change `error: any` to `error: unknown`, wrap returns in `ok()`/`fail()`

- [ ] **Step 2.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.3: Create `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`**

New form using shared UI. This is a full-page form (NOT a modal), so `FormModal` is NOT used here. Preserves all line item management, landed cost calculation, and dual-submit-button pattern.

**Props interface:**
```typescript
interface PurchaseOrderFormProps {
  suppliers: DBSupplier[];
  sources: DBPurchaseSource[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
  initialData?: {
    po: DBPurchaseOrder;
    lines: DBPurchaseOrderLine[];
  };
}
```

**Structure:**
- Default export `PurchaseOrderForm`
- Uses `LoadingButton` for submit buttons (DRAFT and COMPLETED)
- Uses `CustomDatePicker` for `transaction_date`
- Uses `SearchableSelect` for supplier and source selection
- Uses `SupplierModal` from `@/components/SupplierForm` (import path unchanged)
- State: `loading`, `supplierId`, `sourceId`, `supplierInvoiceCode`, `transactionDate`, `notes`, `lines` (array), `shippingFee`, `taxAmount`, `voucherAmount`, `discountAmount`, `isSupplierModalOpen`, `newSupplierName`
- `addLine()`, `removeLine(index)`, `updateLine(index, field, value)` -- exact same logic as original
- Computed: `subtotalAmount`, `totalAmount` -- exact same formulas
- `handleSubmit(status)` -- exact same validation and FormData construction
- Two submit buttons: "Luu Nhap" (DRAFT) and "Tao (COMPLETED)"

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { savePurchaseOrder, addPurchaseSource } from "../actions";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/SearchableSelect";
import { SupplierModal } from "@/components/SupplierForm";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBSupplier, DBPurchaseSource, DBPurchasedItem, DBUOMConversion, DBBaseIngredient, DBUnit, DBPurchaseOrder, DBPurchaseOrderLine } from "@/types/db";
```

- [ ] **Step 2.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.5: Create `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`**

**Props interface:**
```typescript
interface PurchaseOrdersClientProps {
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
}
```

**Structure:**
- State: `search` (string), `statusFilter` (string, default "ALL"), `supplierFilter` (string, default "ALL")
- `useMemo`: filter orders by status, supplier, and text search (PO ID + supplier name)
- `StickyFilterBar` with `title="Quan ly Nhap Hang"`, `rightContent={Link to /admin/inventory/purchase-orders/new}`
- Filter children: text input + status select (ALL/DRAFT/COMPLETED) + supplier dropdown
- Table: reversed order, status badges, supplier name, date, total, action links

This is the **most filter-rich StickyFilterBar** in the system (3 filters).

- [ ] **Step 2.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.7: Update `app/admin/inventory/purchase-orders/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import Link from "next/link";
```

**New imports:**
```typescript
import { getPurchaseOrdersData } from "./actions";
import PurchaseOrdersClient from "./components/PurchaseOrdersClient";
import Link from "next/link";
```

**New page body:**
```typescript
export default async function PurchaseOrdersPage() {
  const { orders, suppliers } = await getPurchaseOrdersData();
  return <PurchaseOrdersClient orders={orders} suppliers={suppliers} />;
}
```

**Note:** Keep the `Link` import if still needed for the "new" button in the client component. Otherwise remove.

- [ ] **Step 2.8: Update `app/admin/inventory/purchase-orders/new/page.tsx`**

Change form import from old to new location:
```typescript
// Old: import PurchaseOrderForm from "@/components/PurchaseOrderForm";
// New: import PurchaseOrderForm from "../components/PurchaseOrderForm";
```

Data fetching stays the same (server component). Pass data to the new form component.

- [ ] **Step 2.9: Update `app/admin/inventory/purchase-orders/[id]/page.tsx`**

Change form import:
```typescript
// Old: import PurchaseOrderForm from "@/components/PurchaseOrderForm";
// New: import PurchaseOrderForm from "../components/PurchaseOrderForm";
```

All other logic stays identical.

- [ ] **Step 2.10: Verify full PO feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/inventory/purchase-orders` -- list loads, filters work (search, status, supplier)
Visit `/admin/inventory/purchase-orders/new` -- form loads
Test: create DRAFT PO, then edit it to COMPLETED
Verify: PO lines display correctly
Verify: Stock Ledger entries created for COMPLETED PO (check `Stock_Ledger` sheet)
Verify: landed cost calculation is correct (same results as before)
Visit `/admin/inventory/purchase-orders/[id]` for both DRAFT and COMPLETED POs

- [ ] **Step 2.11: Commit**

```bash
rtk git add app/admin/inventory/purchase-orders/
rtk git commit -m "refactor(purchase-orders): colocate actions, forms, add StickyFilterBar with filters - stock ledger logic preserved exactly"
```

---

### Task 3: Semi-products

**Files to create:**
- `app/admin/semi-products/actions.ts`
- `app/admin/semi-products/components/SemiProductForm.tsx`
- `app/admin/semi-products/components/SemiProductsClient.tsx`

**Files to modify:**
- `app/admin/semi-products/page.tsx`

**Files NOT to modify:**
- `components/SemiProductForm.tsx` -- KEEP until verified
- `app/actions/recipes.ts` -- KEEP (old form still imports from here)
- `components/InventoryForms.tsx` -- KEEP (DeleteBtn for other pages)
- `components/HistoryModal.tsx` -- KEEP (shared by 4 pages)

---

- [ ] **Step 3.1: Create `app/admin/semi-products/actions.ts`**

Copy `saveSemiProduct` and `deleteSemiProduct` **exactly** from `app/actions/recipes.ts`. Preserve recipe versioning logic byte-for-byte.

```typescript
"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";

const SP_SHEET = "Semi_Products";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/semi-products";

export async function getSemiProductsData(): Promise<{
  semiProducts: Array<DBSemiProduct & { activeRecipe?: DBRecipe; recipeHistory: any[] }>;
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}> {
  try {
    const [semiProducts, recipes, baseIngredients, allUnits] = await Promise.all([
      findAll(SP_SHEET) as Promise<DBSemiProduct[]>,
      findAll(RECIPE_SHEET) as Promise<DBRecipe[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const activeSP = semiProducts.filter(sp => sp.status !== "DELETED");
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

    const enriched = activeSP.map(sp => {
      const spRecipes = recipes.filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === sp.id);
      const activeRecipe = spRecipes.find(r => !r.end_date || r.end_date === "");
      const recipeHistory = spRecipes.map(r => {
        let ings: any[] = [];
        try { ings = JSON.parse(r.ingredients_json || "[]"); } catch {}
        return {
          ...r,
          ingredients: ings.map((ing: any) => {
            const bi = baseIngredients.find(b => b.id === ing.ingredient_id);
            const otherSP = activeSP.find(s => s.id === ing.ingredient_id);
            const source = bi || otherSP;
            const unitObj = units.find((u: any) => u.id === source?.base_unit);
            return { ...ing, name: source?.name || ing.ingredient_id, unit: unitObj?.name || "" };
          }),
        };
      }).sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      return { ...sp, activeRecipe, recipeHistory };
    });

    return { semiProducts: enriched, baseIngredients, units };
  } catch (error) {
    console.error("Loi getSemiProductsData:", error);
    return { semiProducts: [], baseIngredients: [], units: [] };
  }
}

// --- COPY saveSemiProduct EXACTLY from app/actions/recipes.ts ---
// PRESERVE: recipe versioning (close old, create new if ingredients_json changed),
// effectiveDate logic, is_edit branching, ID prefix "BTP" and "RC"
export async function saveSemiProduct(formData: FormData): Promise<ActionResponse> {
  // ... exact copy ...
}

// --- COPY deleteSemiProduct EXACTLY ---
// PRESERVE: soft delete, revalidation path (keep the WRONG path /admin/inventory/semi-products
// to maintain exact current behavior -- this is a known bug we document but do not fix)
export async function deleteSemiProductAction(formData: FormData): Promise<ActionResponse> {
  // ... exact copy ...
}
```

**Named `deleteSemiProductAction`** to avoid collision with `deleteSemiProduct` in old `recipes.ts`.

**PRESERVED BUG:** The revalidation path `/admin/inventory/semi-products` (wrong) is kept exactly as-is. Changing it would alter runtime behavior.

- [ ] **Step 3.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 3.3: Create `app/admin/semi-products/components/SemiProductForm.tsx`**

New form using shared UI. Preserves ingredient row management, self-reference prevention, batch_yield, unit resolution.

**Props interface:**
```typescript
interface SemiProductFormProps {
  units: DBUnit[];
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  initialData?: DBSemiProduct;
  initialRecipe?: DBRecipe;
}
```

**Structure:**
- Default export `SemiProductForm`
- Uses `FormModal`, `LoadingButton`
- State: `isOpen`, `loading`, `name`, `baseUnit`, `batchYield`, `status`, `effectiveDate`, `ingredients`
- `addIngredient()`, `removeIngredient(index)`, `updateIngredient(index, field, value)` -- same logic
- Self-reference filter: `semiProducts.filter(s => s.id !== initialData?.id)`
- `getUnitName()` / `getIngredientBaseUnit()` helpers for display
- `handleSubmit`: builds FormData with `is_edit`, `id`, `name`, `base_unit`, `batch_yield`, `status`, `ingredients_json`, `effective_date`
- Status dropdown (edit mode only): ACTIVE/INACTIVE

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { saveSemiProduct } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";
```

- [ ] **Step 3.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 3.5: Create `app/admin/semi-products/components/SemiProductsClient.tsx`**

**Props interface:**
```typescript
interface SemiProductsClientProps {
  semiProducts: Array<DBSemiProduct & { activeRecipe?: DBRecipe; recipeHistory: any[] }>;
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}
```

**Structure:**
- State: `search` (string)
- `useMemo`: filter semi-products by name matching search
- `StickyFilterBar` with `title="Quan ly Ban Thanh Pham"`, `rightContent={<SemiProductForm ... />}`
- Filter children: text input (search by name)
- Table columns: Ten, Don Vi, Cong Thuc (ingredient list from activeRecipe), Thao Tac
- Per-row: edit button (SemiProductForm with initialData), delete button (DeleteConfirmModal), history button (HistoryModal)
- Ingredient display: parse `activeRecipe.ingredients_json`, resolve names, display as badges

- [ ] **Step 3.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 3.7: Update `app/admin/semi-products/page.tsx`**

**Old imports (replace ALL 5):**
```typescript
import { findAll } from "@/lib/sheets_db";
import SemiProductForm from "@/components/SemiProductForm";
import { deleteSemiProduct } from "@/app/actions/recipes";
import { DeleteBtn } from "@/components/InventoryForms";
import HistoryModal from "@/components/HistoryModal";
```

**New imports:**
```typescript
import { getSemiProductsData } from "./actions";
import SemiProductsClient from "./components/SemiProductsClient";
```

**New page body:**
```typescript
export default async function SemiProductsPage() {
  const data = await getSemiProductsData();
  return <SemiProductsClient {...data} />;
}
```

This reduces the page from 165 lines to ~8 lines. All recipe joining and ingredient resolution moves to the action and client.

- [ ] **Step 3.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/semi-products` -- table loads, search works
Test: add semi-product with ingredients (both BASE_INGREDIENT and SEMI_PRODUCT types), edit (verify recipe versioning creates new version), delete (soft delete)
Verify: history modal shows recipe versions
Verify: self-reference prevention (can't add self as ingredient)

- [ ] **Step 3.9: Commit**

```bash
rtk git add app/admin/semi-products/
rtk git commit -m "refactor(semi-products): colocate actions, forms, add StickyFilterBar - recipe versioning preserved exactly"
```

---

### Task 4: Production

**Files to create:**
- `app/admin/production/actions.ts`
- `app/admin/production/components/ProductionForm.tsx`
- `app/admin/production/components/ProductionClient.tsx`

**Files to modify:**
- `app/admin/production/page.tsx`

**Files NOT to modify:**
- `components/ProductionForm.tsx` -- KEEP until verified
- `app/actions/production.ts` -- KEEP (old form still imports from here)

---

- [ ] **Step 4.1: Create `app/admin/production/actions.ts`**

Copy `saveProductionOrder` **exactly** from `app/actions/production.ts`. Preserve all Stock Ledger writes byte-for-byte.

```typescript
"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBProductionOrder, DBProductionItem, DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit, DBStockLedger } from "@/types/db";

const PATH = "/admin/production";

export async function getProductionData(): Promise<{
  orders: DBProductionOrder[];
  productionItems: DBProductionItem[];
  semiProducts: DBSemiProduct[];
  recipes: DBRecipe[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}> {
  try {
    const [orders, productionItems, semiProducts, recipes, baseIngredients, allUnits] = await Promise.all([
      findAll("Production_Orders") as Promise<DBProductionOrder[]>,
      findAll("Production_Items") as Promise<DBProductionItem[]>,
      findAll("Semi_Products") as Promise<DBSemiProduct[]>,
      findAll("Recipes") as Promise<DBRecipe[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const activeSP = semiProducts.filter(sp => sp.status !== "DELETED");
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { orders, productionItems, semiProducts: activeSP, recipes, baseIngredients, units };
  } catch (error) {
    console.error("Loi getProductionData:", error);
    return { orders: [], productionItems: [], semiProducts: [], recipes: [], baseIngredients: [], units: [] };
  }
}

// --- COPY saveProductionOrder EXACTLY from app/actions/production.ts ---
// PRESERVE ALL:
//   - user field extraction (even though form never sends it - preserved as dead code)
//   - semi_product_id lookup and validation
//   - Production_Orders insert with "PRD" prefix
//   - Production_Items insert with "PRI" prefix, total_cost: 0
//   - Stock Ledger CONSUME for each non-inventory ingredient: "PRODUCTION_CONSUME", -qty, unit_cost: 0
//   - Stock Ledger YIELD for semi-product: "PRODUCTION_YIELD", +target_yield, unit_cost: 0
//   - The `is_non_inventory` check: only consume if !ing.is_non_inventory
//   - The `apply_date` = new Date().toISOString()
//   - Revalidation of /admin/production only
export async function saveProductionOrder(formData: FormData): Promise<ActionResponse> {
  // ... exact copy of original function body ...
}
```

**CRITICAL VERIFICATION:**
- Confirm `transaction_type: "PRODUCTION_CONSUME"` with negative `quantity_change`
- Confirm `transaction_type: "PRODUCTION_YIELD"` with positive `quantity_change`
- Confirm `unit_cost: 0` for both types
- Confirm `is_non_inventory` check skips stock deduction
- Confirm `apply_date` used for `created_at` in all Stock Ledger entries

- [ ] **Step 4.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 4.3: Create `app/admin/production/components/ProductionForm.tsx`**

New form using shared UI. Preserves the ingredient multiplier calculation and manual override.

**Props interface:**
```typescript
interface ProductionFormProps {
  semiProducts: DBSemiProduct[];
  recipes: DBRecipe[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}
```

**Structure:**
- Default export `ProductionForm`
- Uses `FormModal`, `LoadingButton`
- State: `isOpen`, `loading`, `selectedSpId`, `targetYield`, `consumedIngredients`
- `useEffect` for ingredient calculation: `multiplier = targetYield / yieldPerBatch`, `roundedQty = Math.round(defaultQty * 100) / 100` -- **exact same formulas**
- `handleQtyChange(index, newQty)` for manual override -- same logic
- Validation: must select semi-product, targetYield > 0, consumedIngredients.length > 0
- FormData: `semi_product_id`, `target_yield`, `consumed_ingredients` (JSON)

**Imports:**
```typescript
"use client";
import { useState, useEffect } from "react";
import { saveProductionOrder } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";
```

- [ ] **Step 4.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 4.5: Create `app/admin/production/components/ProductionClient.tsx`**

**Props interface:**
```typescript
interface ProductionClientProps {
  orders: DBProductionOrder[];
  productionItems: DBProductionItem[];
  semiProducts: DBSemiProduct[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}
```

**Structure:**
- State: `search` (string)
- `useMemo`: filter orders by semi-product name matching search
- `StickyFilterBar` with `title="San Xuat / Nau Bep"`, `rightContent={<ProductionForm ... />}`
- Filter children: text input (search by semi-product name)
- History table: sorted by `created_at` descending, each row shows date, semi-product name, yield with unit, "Da tru kho" badge
- Per-row ingredient display from Production_Items (if needed)

- [ ] **Step 4.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 4.7: Update `app/admin/production/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import ProductionForm from "@/components/ProductionForm";
```

**New imports:**
```typescript
import { getProductionData } from "./actions";
import ProductionClient from "./components/ProductionClient";
```

**New page body:**
```typescript
export default async function ProductionPage() {
  const data = await getProductionData();
  return <ProductionClient {...data} />;
}
```

- [ ] **Step 4.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/production` -- history table loads, search works
Test: select a semi-product with a recipe, set target yield, verify ingredient quantities auto-calculate
Test: manually override a quantity, submit
Verify: Production_Orders, Production_Items, and Stock_Ledger entries created correctly
Verify: `PRODUCTION_CONSUME` entries have negative quantity, `PRODUCTION_YIELD` has positive
Verify: `unit_cost: 0` for all Stock Ledger entries

- [ ] **Step 4.9: Commit**

```bash
rtk git add app/admin/production/
rtk git commit -m "refactor(production): colocate actions, forms, add StickyFilterBar - stock ledger logic preserved exactly"
```

---

### Task 5: Validation Gate

- [ ] **Step 5.1: Full TypeScript check**

Run: `rtk tsc`
Expected: `Found 0 errors`

- [ ] **Step 5.2: Dev server starts**

Run: `npm run dev`
Expected: Server starts without errors

- [ ] **Step 5.3: Verify all 4 Wave 2 features**

| Page | URL | Tests |
|------|-----|-------|
| Items | `/admin/inventory/items` | Search, category filter, add (RAW + non-RAW), edit, delete |
| Purchase Orders | `/admin/inventory/purchase-orders` | Search, status filter, supplier filter, create DRAFT, edit to COMPLETED |
| PO Detail | `/admin/inventory/purchase-orders/[id]` | View COMPLETED (read-only), edit DRAFT |
| Semi-products | `/admin/semi-products` | Search, add with ingredients, edit (recipe versioning), delete, history |
| Production | `/admin/production` | Search, create production order, verify stock ledger |

- [ ] **Step 5.4: Verify non-Wave-2 pages still work**

| Page | URL | What to check |
|------|-----|---------------|
| Inventory Categories | `/admin/inventory/categories` | Loads, uses InventoryForms.ItemCategoryForm + DeleteBtn |
| Units | `/admin/inventory/units` | Loads, uses UnitForm |
| Products | `/admin/products` | Loads, uses HistoryModal |
| Orders | `/admin/orders` | Loads |
| Reports | `/admin/reports/sales` | Loads |
| Suppliers | `/admin/suppliers` | Loads, verify SupplierModal still works for PO form |

- [ ] **Step 5.5: Verify Stock Ledger integrity**

Create a COMPLETED PO and a Production order, then check the `Stock_Ledger` sheet:
- PO COMPLETED: should have `PO_RECEIPT` entries with correct `quantity_change`, `unit_cost`, and `item_reference`
- Production: should have `PRODUCTION_CONSUME` (negative) and `PRODUCTION_YIELD` (positive) entries with `unit_cost: 0`

- [ ] **Step 5.6: Commit final state**

```bash
rtk git add -A
rtk git commit -m "chore(wave2): final cleanup and verification"
```

---

## Part 3: File Manifest

### Files to Create (12 new files)

| File | Feature | Task |
|------|---------|------|
| `app/admin/inventory/items/actions.ts` | Items | 1 |
| `app/admin/inventory/items/components/PurchasedItemForm.tsx` | Items | 1 |
| `app/admin/inventory/items/components/ItemsClient.tsx` | Items | 1 |
| `app/admin/inventory/purchase-orders/actions.ts` | PO | 2 |
| `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx` | PO | 2 |
| `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx` | PO | 2 |
| `app/admin/semi-products/actions.ts` | Semi-products | 3 |
| `app/admin/semi-products/components/SemiProductForm.tsx` | Semi-products | 3 |
| `app/admin/semi-products/components/SemiProductsClient.tsx` | Semi-products | 3 |
| `app/admin/production/actions.ts` | Production | 4 |
| `app/admin/production/components/ProductionForm.tsx` | Production | 4 |
| `app/admin/production/components/ProductionClient.tsx` | Production | 4 |

### Files to Modify (5 files)

| File | Change | Task |
|------|--------|------|
| `app/admin/inventory/items/page.tsx` | Replace with slim server component | 1 |
| `app/admin/inventory/purchase-orders/page.tsx` | Replace with slim server component | 2 |
| `app/admin/inventory/purchase-orders/new/page.tsx` | Update form import path | 2 |
| `app/admin/inventory/purchase-orders/[id]/page.tsx` | Update form import path | 2 |
| `app/admin/semi-products/page.tsx` | Replace with slim server component | 3 |
| `app/admin/production/page.tsx` | Replace with slim server component | 4 |

### Files NOT Modified (Kept for Non-Wave-2 Consumers)

| File | Why kept |
|------|----------|
| `components/InventoryForms.tsx` | ItemCategoryForm, DeleteBtn, ActionGroup for categories page |
| `components/PurchaseOrderForm.tsx` | Old form -- cleaned up later |
| `components/SemiProductForm.tsx` | Old form -- cleaned up later |
| `components/ProductionForm.tsx` | Old form -- cleaned up later |
| `components/SupplierForm.tsx` | SupplierModal for PO form |
| `app/actions/inventory.ts` | addItemCategory, updateItemCategory, deleteItemCategory, addUnit, updateUnit, deleteUnit |
| `app/actions/purchase-orders.ts` | Old -- still imported by old form |
| `app/actions/recipes.ts` | Old -- still imported by old form |
| `app/actions/production.ts` | Old -- still imported by old form |
| `components/HistoryModal.tsx` | Shared by 4 pages |

---

## Part 4: Documented Bugs (PRESERVED, NOT FIXED)

Per the supreme constraint, these bugs exist in the current code and are preserved exactly:

| Bug | Feature | Description |
|-----|---------|-------------|
| Double update on PO lines | Items (`updatePurchasedItem`) | Each PO line gets two `update()` calls -- first is redundant |
| No cascading delete | Items (`deletePurchasedItem`) | Deleting an item orphans UOM_Conversions and PO line references |
| Wrong revalidation path | Semi-products (`deleteSemiProductAction`) | Revalidates `/admin/inventory/semi-products` instead of `/admin/semi-products` |
| Recipe not closed on delete | Semi-products (`deleteSemiProductAction`) | Soft delete leaves active recipe with empty `end_date` |
| `unit_cost` always 0 | Production | Both consumption and yield Stock Ledger entries have `unit_cost: 0` |
| `user` field never sent | Production | Action reads `formData.get("user")` but form never sends it |
| Recipe lookup without `end_date` | Production + Semi-products | `.find()` without `end_date` filter may return stale recipe |
| No status transition guard | PO | Server action allows COMPLETED -> DRAFT transition (UI prevents it) |
| `total_extra_costs` can be negative | PO | Large voucher/discount can produce negative allocated cost |

These bugs are documented for a future fix cycle. They are NOT fixed in this refactoring.

---

## Part 5: Expected Outcomes

### Before (Current State)

| Feature | Page Lines | Form Lines | Action Lines | `any` Count | Filters |
|---------|-----------|------------|-------------|-------------|---------|
| Items | 77 | ~200 | ~130 | ~15 | None |
| Purchase Orders | 85+45+142=272 | 428 | 157 | ~20 | None |
| Semi-products | 165 | 289 | 103 | ~18 | None |
| Production | 112 | 233 | 84 | ~12 | None |
| **Totals** | ~626 | ~1150 | ~474 | ~65 | 0 |

### After (Target State)

| Feature | Page Lines | Client Lines | Form Lines | Action Lines | `any` Count | Filters |
|---------|-----------|-------------|------------|-------------|-------------|---------|
| Items | ~8 | ~100 | ~180 | ~130 | 0 | Search + Category |
| Purchase Orders | ~8+8+8=24 | ~100 | ~380 | ~157 | 0 | Search + Status + Supplier |
| Semi-products | ~8 | ~120 | ~250 | ~103 | 0 | Search |
| Production | ~8 | ~90 | ~200 | ~84 | 0 | Search |
| **Totals** | ~48 | ~410 | ~1010 | ~474 | 0 | 4 features |

### Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Shared UI components used | 0 | FormModal, LoadingButton, DeleteConfirmModal across all 4 |
| TypeScript interfaces | 0 `any` props | All props typed with `types/db.ts` |
| Search/filter capability | None | Text search on all, status+supplier on PO |
| StickyFilterBar | Not used | Used on all 4 features |
| Stock Ledger logic changes | N/A | **ZERO changes** -- exact copies |
| Cost calculation changes | N/A | **ZERO changes** -- exact copies |
| Recipe versioning changes | N/A | **ZERO changes** -- exact copies |
