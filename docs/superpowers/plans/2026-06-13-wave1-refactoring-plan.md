# Wave 1 Refactoring Plan (Master Data)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 5 Master Data features (Suppliers, Base Ingredients, Categories, Conversions, Modifiers) to feature-colocated architecture with StickyFilterBar, shared UI primitives, strict TypeScript, and shared action utilities.

**Architecture:** Each feature gets its own `components/` and `actions.ts` inside `app/admin/[feature]/`. Pages become slim server components that pass typed data to a client component. Client components render `StickyFilterBar` with integrated text search + status filter. Forms use `FormModal`, `LoadingButton`, `DeleteConfirmModal` from `components/ui/`. Actions use `lib/shared-actions.ts` helpers where applicable.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Google Sheets via `lib/sheets_db.ts`

**Supreme Criterion:** Code quality and type safety above all. Slow and correct beats fast and broken.

---

## Part 1: Audit Findings Summary

### Cross-Cutting Issues Across All 5 Features

| Issue | Impact | Fix |
|-------|--------|-----|
| All props typed as `any` | No type safety, runtime surprises | Replace with `types/db.ts` interfaces |
| No search/filter in tables | Can't find records in growing datasets | Add `StickyFilterBar` with text search + status filter |
| Inline modal overlays (14+ copies) | Maintenance burden, inconsistent UX | Replace with `FormModal` |
| Inline delete modals / `confirm()` dialogs | Inconsistent UX, some use browser `alert()` | Replace with `DeleteConfirmModal` |
| Inline loading button patterns | Duplicated 15+ times | Replace with `LoadingButton` |
| `DeleteBtn`/`ActionGroup` from InventoryForms | Used by 6 pages, untyped `actionFn: any` | Replace with local components using `DeleteConfirmModal` |
| No error handling on some form submits | Errors silently swallowed | Add error handling in all submit handlers |
| Server pages render tables directly | No client-side interactivity | Extract to `*Client.tsx` components |

### Per-Feature Audit Summary

#### 1. Suppliers (3 files, ~462 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/suppliers/page.tsx` | 65 | `any` types, no filters, renders table as server component |
| `components/SupplierForm.tsx` | 341 | 3 exports: `SupplierForm` (`any` props), `SupplierModal` (used by PurchaseOrderForm -- NOT in Wave 1), `DeleteSupplierButton` (custom delete modal). `SupplierModal` must remain accessible for PurchaseOrderForm. |
| `app/actions/suppliers.ts` | 56 | `addSupplier` handles both create+update in one function. Has duplicate name check (case-insensitive). `deleteSupplier` is hard delete. 5 `any` usages. |

**Critical constraint:** `SupplierModal` is imported by `components/PurchaseOrderForm.tsx` (not in Wave 1). The OLD `components/SupplierForm.tsx` must remain in place to serve `SupplierModal`. The new colocated file will contain `SupplierForm` and `DeleteSupplierButton` only.

#### 2. Base Ingredients (3 files, ~276 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/inventory/base-ingredients/page.tsx` | 55 | Imports `BaseIngredientForm` and `DeleteBtn` from `InventoryForms`. Passes `deleteBaseIngredient` action as prop to `DeleteBtn`. |
| `components/InventoryForms.tsx` (BaseIngredientForm, lines 64-189) | ~125 | Batch add mode (multiple rows). Unit name-to-ID round-trip via `SearchableSelect`. `is_non_inventory` field. All props `any`. Batch unit validation only checks `items[0]` (bug). |
| `app/actions/inventory.ts` (add/update/delete, lines 49-116) | ~67 | `addBaseIngredient` supports batch via `items_json`. Fallback single-item path missing `is_non_inventory`. `updateBaseIngredient` has no validation. Hard delete. |

**Critical constraint:** `InventoryForms.tsx` also contains `ItemCategoryForm`, `PurchasedItemForm`, `ActionGroup`, `DeleteBtn` which are used by non-Wave-1 pages. Do NOT modify `InventoryForms.tsx`. Extract BaseIngredientForm into a new file.

#### 3. Categories (3 files, ~264 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/products/categories/page.tsx` | 66 | Fetches both `Product_Categories` and `Products` (latter just for count). `any` types. |
| `components/ProductCategoryForm.tsx` | 148 | Default export. Props `{ initialData }: any`. Single field (name). Has both add/edit modal AND delete confirmation modal inline. No error handling on submit (errors silently swallowed). Form state not cleared on modal close. |
| `app/actions/products.ts` (category functions, lines 6-49) | ~43 | `saveProductCategory`, `updateProductCategory`, `deleteProductCategory` (soft delete). `remove` imported but unused. No duplicate name check on create. |

**Critical constraint:** `app/actions/products.ts` also contains `saveProduct`, `deleteProduct` (not in Wave 1). Do NOT modify this file. Create new colocated actions for categories only.

#### 4. Conversions (3 files, ~310 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/inventory/conversions/page.tsx` | ~65 | Fetches 4 sheets. Resolves item names and unit names from IDs. All `any`. Uses `ConversionForm` and `DeleteBtn` from InventoryForms. |
| `components/InventoryForms.tsx` (ConversionForm, lines 391-514) | ~123 | Complex derived values: selectedItem -> baseIngredient -> baseUnit chain. `update_history` checkbox in edit mode retroactively updates PO lines. Orphaned `<datalist>` dead code. Unit name-to-ID round-trip. |
| `app/actions/inventory.ts` (conversion functions, lines 251-319) | ~68 | `addConversion`, `updateConversion` (with `update_history` PO line rewrite), `deleteConversion` (hard delete). Full-table scans in updateConversion. Duplicate `update_history` logic also exists in `updatePurchasedItem`. |

**Critical constraint:** Same as Base Ingredients -- do NOT modify `app/actions/inventory.ts`. Create new colocated actions. `update_history` PO line rewrite must be preserved exactly.

#### 5. Modifiers (3 files, ~424 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/products/modifiers/page.tsx` | 150 | Fetches 5 sheets. Joins modifiers with active recipes. Resolves ingredient names/units inline. 7 `any` usages. Uses `DeleteBtn` from InventoryForms + `HistoryModal`. |
| `components/ModifierForm.tsx` | 183 | Default export, all props `any`. Ingredient rows (type + item + quantity + remove). Dual delete paths: form has `handleDelete` AND page renders `DeleteBtn`. Uses `confirm()` for delete. |
| `app/actions/modifiers.ts` | 91 | `saveModifier` (upsert with `is_edit` flag + recipe versioning). `deleteModifier` (soft delete, does NOT close active recipe). Recipe versioning: close old recipe (set `end_date`), create new one if ingredients changed. |

**Critical constraints:**
- `HistoryModal` is shared by 4 pages (modifiers, semi-products, products x2). Do NOT move it.
- Recipe versioning logic is complex business logic that must be preserved exactly.
- Modifiers page currently renders TWO delete buttons per row (form's `handleDelete` AND `DeleteBtn`). Refactoring must consolidate to ONE.

---

## Part 2: Dependency Map (What NOT to Touch)

### Files that MUST NOT be modified during Wave 1

| File | Reason |
|------|--------|
| `app/actions/inventory.ts` | Contains `addItemCategory`, `updateItemCategory`, `deleteItemCategory`, `addPurchasedItem`, `updatePurchasedItem`, `deletePurchasedItem`, `addUnit`, `updateUnit`, `deleteUnit` used by non-Wave-1 pages. |
| `app/actions/products.ts` | Contains `saveProduct`, `deleteProduct` used by `ProductForm.tsx`. |
| `components/InventoryForms.tsx` | Contains `ItemCategoryForm`, `PurchasedItemForm`, `ActionGroup`, `DeleteBtn` used by non-Wave-1 pages (items, categories, semi-products). |
| `components/SupplierForm.tsx` | Contains `SupplierModal` used by `PurchaseOrderForm.tsx`. Must remain in place. |
| `components/PurchaseOrderForm.tsx` | Not in Wave 1. |
| `components/HistoryModal.tsx` | Shared by 4 pages. Leave in `components/`. |
| `components/ModifierForm.tsx` | Will be replaced, but old file must be kept until importers are updated. |
| `components/ProductCategoryForm.tsx` | Same -- replaced but kept until verified. |

### Strategy: Create-then-switch

For maximum safety, each feature follows this pattern:

1. **Create** new colocated files (actions, components)
2. **Update** only the feature's `page.tsx` to import from new locations
3. **Verify** with `tsc` + dev server + manual testing
4. **Old files remain untouched** until a final cleanup phase

This means temporary duplication is acceptable. The old action functions and form components stay in their original files, serving as a rollback point.

---

## Part 3: Execution Plan

### Task 1: Suppliers

**Files to create:**
- `app/admin/suppliers/actions.ts`
- `app/admin/suppliers/components/SupplierForm.tsx`
- `app/admin/suppliers/components/SuppliersClient.tsx`

**Files to modify:**
- `app/admin/suppliers/page.tsx`

**Files NOT to modify or delete:**
- `components/SupplierForm.tsx` -- KEEP (SupplierModal needed by PurchaseOrderForm)
- `app/actions/suppliers.ts` -- KEEP (SupplierModal imports addSupplier from here)

---

- [ ] **Step 1.1: Create `app/admin/suppliers/actions.ts`**

New colocated action file. Splits the combined `addSupplier` into separate `addSupplier` and `editSupplier` for clarity (matching Brands PoC pattern). Preserves all existing business logic: duplicate name check (case-insensitive), `parent_id: ""` on insert, `status: "ACTIVE"` on insert.

```typescript
"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, deleteEntity, type ActionResponse } from "@/lib/shared-actions";
import type { DBSupplier } from "@/types/db";

const SHEET = "Suppliers";
const PATH = "/admin/suppliers";

export async function getSuppliers(): Promise<DBSupplier[]> {
  try {
    return await findAll(SHEET) as DBSupplier[];
  } catch (error) {
    console.error("Loi getSuppliers:", error);
    return [];
  }
}

export async function addSupplier(formData: FormData): Promise<ActionResponse> {
  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || "";
  const tax_id = (formData.get("tax_id") as string) || "";
  const address = (formData.get("address") as string) || "";
  const links = (formData.get("links") as string) || "";

  if (!name) return fail("Ten nha cung cap khong duoc de trong");

  try {
    const suppliers = await findAll(SHEET);
    const existing = suppliers.find(
      (s: DBSupplier) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return fail("Da ton tai nha cung cap voi ten nay");

    const id = await generateNewId(SHEET, "NCC");
    const created_at = new Date().toISOString();
    await insert(SHEET, { id, name, phone, tax_id, address, links, parent_id: "", status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok({ id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function editSupplier(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || "";
  const tax_id = (formData.get("tax_id") as string) || "";
  const address = (formData.get("address") as string) || "";
  const links = (formData.get("links") as string) || "";

  if (!id || !name) return fail("Du lieu khong hop le");

  try {
    const suppliers = await findAll(SHEET);
    const existing = suppliers.find(
      (s: DBSupplier) => s.name.toLowerCase() === name.toLowerCase() && s.id !== id
    );
    if (existing) return fail("Da ton tai nha cung cap khac voi ten nay");

    await update(SHEET, id, { name, phone, tax_id, address, links });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteSupplierAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID khong hop le");
  return deleteEntity(SHEET, id, PATH);
}
```

**Key decisions:**
- Named `deleteSupplierAction` to avoid collision with the old `deleteSupplier` (which is still imported by the old SupplierForm.tsx via the old actions file).
- Preserves case-insensitive duplicate name check exactly as current.
- Preserves `parent_id: ""` on insert exactly as current.
- Adds `status: "ACTIVE"` on insert (current code omits this, but the DBSupplier type includes it).
- Split create/update into separate functions (current code handles both in one function via `id` presence check).

- [ ] **Step 1.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.3: Create `app/admin/suppliers/components/SupplierForm.tsx`**

New form component using shared UI primitives. Replaces the old `SupplierForm` + `DeleteSupplierButton` pattern with the Brands PoC pattern (single `SupplierForm` with `isEdit` + separate `DeleteSupplierButton`).

**Props interface:**
```typescript
interface SupplierFormProps {
  initialData?: DBSupplier;
}

interface DeleteSupplierButtonProps {
  id: string;
}
```

**Structure:**
- Named export `SupplierForm` -- handles both add (no `initialData`) and edit (with `initialData`)
- Named export `DeleteSupplierButton` -- uses `DeleteConfirmModal`
- Uses `FormModal` for the modal wrapper
- Uses `LoadingButton` for submit button
- Uses `DeleteConfirmModal` for delete confirmation
- State: `isOpen`, `loading`, `name`, `phone`, `taxId`, `address`, `links`
- In edit mode, initialize state from `initialData`
- On submit: build FormData, call `addSupplier` or `editSupplier` based on `isEdit`
- Error handling: display inline error banner (preserving current behavior)
- Warning text on delete: "Cac lien ket hang hoa co the bi anh huong" (preserving current text)

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { addSupplier, editSupplier, deleteSupplierAction } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import type { DBSupplier } from "@/types/db";
```

**Form fields (preserving current field set):**
- name (text, required)
- phone (tel)
- tax_id (text)
- address (text)
- links (textarea, 2 rows)

- [ ] **Step 1.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.5: Create `app/admin/suppliers/components/SuppliersClient.tsx`**

Client component with `StickyFilterBar` + text search + table. Receives pre-fetched data from server page.

**Props interface:**
```typescript
interface SuppliersClientProps {
  suppliers: DBSupplier[];
}
```

**Structure:**
- State: `search` (string), `statusFilter` (string, default "ALL")
- `useMemo` for filtered list: matches search against `name`, `phone`, `address`; matches statusFilter against `status`
- Renders `StickyFilterBar` with `title="Quan ly Nha Cung Cap"`, `rightContent={<SupplierForm />}`
- Filter children: text input + status select
- Renders table with columns: ID, Ten, Lien He (phone + address), Ma So Thue, Ghi Chu, Thao Tac
- Per-row: `<SupplierForm initialData={supplier} />` (edit) + `<DeleteSupplierButton id={supplier.id} />`
- Empty state when filtered list is empty

**Imports:**
```typescript
"use client";
import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { SupplierForm, DeleteSupplierButton } from "./SupplierForm";
import type { DBSupplier } from "@/types/db";
```

- [ ] **Step 1.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.7: Update `app/admin/suppliers/page.tsx`**

Transform from server-rendered table to slim server component that passes data to client.

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { SupplierForm, DeleteSupplierButton } from "@/components/SupplierForm";
```

**New imports:**
```typescript
import { getSuppliers } from "./actions";
import SuppliersClient from "./components/SuppliersClient";
```

**New page body:**
```typescript
export default async function SuppliersPage() {
  const suppliers = await getSuppliers();
  return <SuppliersClient suppliers={suppliers} />;
}
```

- [ ] **Step 1.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Run: `npm run dev` -- server starts
Visit `/admin/suppliers` -- table loads, search works, add/edit/delete modals work
Visit `/admin/inventory/purchase-orders/new` -- SupplierModal still works (imports from old file)

- [ ] **Step 1.9: Commit**

```bash
rtk git add app/admin/suppliers/
rtk git commit -m "refactor(suppliers): colocate actions, forms, add StickyFilterBar and type safety"
```

---

### Task 2: Categories (Product Categories)

**Files to create:**
- `app/admin/products/categories/actions.ts`
- `app/admin/products/categories/components/ProductCategoryForm.tsx`
- `app/admin/products/categories/components/CategoriesClient.tsx`

**Files to modify:**
- `app/admin/products/categories/page.tsx`

**Files NOT to modify or delete:**
- `app/actions/products.ts` -- KEEP (saveProduct, deleteProduct used by ProductForm)
- `components/ProductCategoryForm.tsx` -- KEEP (will be cleaned up in final phase)

---

- [ ] **Step 2.1: Create `app/admin/products/categories/actions.ts`**

New colocated actions. Extracts category functions from `app/actions/products.ts`. Preserves soft delete behavior exactly.

```typescript
"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, softDeleteEntity, type ActionResponse } from "@/lib/shared-actions";
import type { DBProductCategory, DBProduct } from "@/types/db";

const SHEET = "Product_Categories";
const PATH = "/admin/products/categories";

export async function getCategoriesWithCounts(): Promise<{
  categories: DBProductCategory[];
  counts: Record<string, number>;
}> {
  try {
    const [categories, products] = await Promise.all([
      findAll(SHEET) as Promise<DBProductCategory[]>,
      findAll("Products") as Promise<DBProduct[]>,
    ]);
    const activeCategories = categories.filter(c => c.status !== "DELETED");
    const counts: Record<string, number> = {};
    for (const cat of activeCategories) {
      counts[cat.id] = products.filter(
        p => p.category_id === cat.id && p.status !== "DELETED"
      ).length;
    }
    return { categories: activeCategories, counts };
  } catch (error) {
    console.error("Loi getCategories:", error);
    return { categories: [], counts: {} };
  }
}

export async function saveCategory(formData: FormData): Promise<ActionResponse> {
  const name = formData.get("name") as string;
  if (!name) return fail("Vui long nhap ten danh muc");

  try {
    const id = await generateNewId(SHEET, "CAT");
    const created_at = new Date().toISOString();
    await insert(SHEET, { id, name, status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updateCategory(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (!id || !name) return fail("Du lieu khong hop le");

  try {
    await update(SHEET, id, { name });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteCategory(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID khong hop le");
  return softDeleteEntity(SHEET, id, PATH);
}
```

**Key decisions:**
- `getCategoriesWithCounts` combines data fetching and count computation (moved from page to action for clean separation).
- Uses `softDeleteEntity` from shared-actions (current behavior: sets `status: "DELETED"`).
- Function names: `saveCategory`, `updateCategory`, `deleteCategory` (shorter, no "Product" prefix needed since colocated).

- [ ] **Step 2.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.3: Create `app/admin/products/categories/components/ProductCategoryForm.tsx`**

New form using shared UI. Single-field form (name only). Fixes: adds error handling on submit (currently silently swallowed), adds form reset on modal close.

**Props interface:**
```typescript
interface ProductCategoryFormProps {
  initialData?: DBProductCategory;
}
```

**Structure:**
- Named export `ProductCategoryForm`
- Uses `FormModal` for add/edit modal
- Uses `DeleteConfirmModal` for delete confirmation (replaces inline delete modal)
- Uses `LoadingButton` for submit
- State: `isOpen`, `isDeleteOpen`, `loading`, `name`
- On submit: call `saveCategory` or `updateCategory`. Check result for errors and display inline.
- On delete: call `deleteCategory`. Uses `DeleteConfirmModal`.
- On modal close: reset `name` to `initialData?.name || ""`
- Warning text on delete: mentions the category name

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { saveCategory, updateCategory, deleteCategory } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import type { DBProductCategory } from "@/types/db";
```

- [ ] **Step 2.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.5: Create `app/admin/products/categories/components/CategoriesClient.tsx`**

**Props interface:**
```typescript
interface CategoriesClientProps {
  categories: DBProductCategory[];
  counts: Record<string, number>;
}
```

**Structure:**
- State: `search` (string)
- No status filter needed (server already filters out DELETED)
- `useMemo`: filter categories by name matching search
- `StickyFilterBar` with `title="Quan ly Danh muc"`, `rightContent={<ProductCategoryForm />}`
- Filter children: text input (search by name)
- Table columns: STT, Ten Danh Muc, So luong Mon (count badge), Thao Tac
- Per-row: `<ProductCategoryForm initialData={cat} />` (includes edit + delete buttons)

- [ ] **Step 2.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.7: Update `app/admin/products/categories/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import ProductCategoryForm from "@/components/ProductCategoryForm";
```

**New imports:**
```typescript
import { getCategoriesWithCounts } from "./actions";
import CategoriesClient from "./components/CategoriesClient";
```

**New page body:**
```typescript
export default async function ProductCategoriesPage() {
  const { categories, counts } = await getCategoriesWithCounts();
  return <CategoriesClient categories={categories} counts={counts} />;
}
```

- [ ] **Step 2.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/products/categories` -- table loads, search works, add/edit/delete modals work
Verify: adding a category, editing its name, deleting it (soft delete -- disappears from active list)
Verify: product counts still display correctly

- [ ] **Step 2.9: Commit**

```bash
rtk git add app/admin/products/categories/
rtk git commit -m "refactor(categories): colocate actions, forms, add StickyFilterBar and type safety"
```

---

### Task 3: Base Ingredients

**Files to create:**
- `app/admin/inventory/base-ingredients/actions.ts`
- `app/admin/inventory/base-ingredients/components/BaseIngredientForm.tsx`
- `app/admin/inventory/base-ingredients/components/BaseIngredientsClient.tsx`

**Files to modify:**
- `app/admin/inventory/base-ingredients/page.tsx`

**Files NOT to modify:**
- `components/InventoryForms.tsx` -- KEEP (contains ItemCategoryForm, PurchasedItemForm, DeleteBtn, ActionGroup for non-Wave-1 consumers)
- `app/actions/inventory.ts` -- KEEP (contains functions for items, categories, units)

---

- [ ] **Step 3.1: Create `app/admin/inventory/base-ingredients/actions.ts`**

New colocated actions. Preserves batch-add logic exactly. Fixes: adds `is_non_inventory` to fallback path, adds validation to `updateBaseIngredient`.

```typescript
"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBBaseIngredient, DBUnit } from "@/types/db";

const SHEET = "Base_Ingredients";
const PATH = "/admin/inventory/base-ingredients";

export async function getBaseIngredientsData(): Promise<{
  ingredients: DBBaseIngredient[];
  units: DBUnit[];
}> {
  try {
    const [ingredients, allUnits] = await Promise.all([
      findAll(SHEET) as Promise<DBBaseIngredient[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { ingredients, units };
  } catch (error) {
    console.error("Loi getBaseIngredientsData:", error);
    return { ingredients: [], units: [] };
  }
}

export async function addBaseIngredient(formData: FormData): Promise<ActionResponse> {
  try {
    const itemsJson = formData.get("items_json") as string;

    if (itemsJson) {
      const items = JSON.parse(itemsJson) as Array<{
        name: string;
        base_unit: string;
        is_non_inventory: boolean;
      }>;

      for (const item of items) {
        if (!item.name || !item.base_unit) continue;
        const id = await generateNewId(SHEET, "NNL");
        await insert(SHEET, {
          id,
          name: item.name,
          base_unit: item.base_unit,
          is_non_inventory: item.is_non_inventory ? "TRUE" : "FALSE",
          status: "ACTIVE",
          created_at: new Date().toISOString(),
        });
      }
      revalidatePath(PATH);
      return ok();
    }

    // Fallback single-item path
    const name = formData.get("name") as string;
    const base_unit = formData.get("base_unit") as string;
    if (!name || !base_unit) return fail("Thieu thong tin nguyen lieu");

    const id = await generateNewId(SHEET, "NNL");
    await insert(SHEET, {
      id,
      name,
      base_unit,
      is_non_inventory: "FALSE",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updateBaseIngredient(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;
  const is_non_inventory = formData.get("is_non_inventory") as string;

  if (!id || !name || !base_unit) return fail("Thieu thong tin");

  try {
    const nonInv = is_non_inventory === "true" ? "TRUE" : "FALSE";
    await update(SHEET, id, { name, base_unit, is_non_inventory: nonInv });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteBaseIngredientAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID khong hop le");

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

**Key decisions:**
- Named `deleteBaseIngredientAction` to avoid collision with `deleteBaseIngredient` in `app/actions/inventory.ts`.
- Preserves batch-add via `items_json` exactly.
- Fixed: fallback path now includes `is_non_inventory: "FALSE"`.
- Added validation to `updateBaseIngredient` (current code has none).
- Data fetching combined into `getBaseIngredientsData` (returns both ingredients and filtered units).

- [ ] **Step 3.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 3.3: Create `app/admin/inventory/base-ingredients/components/BaseIngredientForm.tsx`**

New form using shared UI. Preserves batch-add pattern with `SearchableSelect` for unit selection. Uses `FormModal` for the modal wrapper.

**Props interface:**
```typescript
interface BaseIngredientFormProps {
  initialData?: DBBaseIngredient;
  units: DBUnit[];
}
```

**Structure:**
- Named export `BaseIngredientForm`
- State: `isOpen`, `loading`, `items` (array of `{ name, base_unit, is_non_inventory }`)
- `isEdit = !!initialData`
- Edit mode: single row only, initialized from `initialData`. Unit resolved from ID to name for SearchableSelect.
- Create mode: supports multiple rows via `addItemRow` / `removeItemRow` / `updateItem`
- Unit validation in `handleSubmit`: case-insensitive name-to-ID lookup for ALL items (fixes bug where only `items[0]` was validated)
- `SearchableSelect` options: `units.map(u => ({ id: u.name, label: u.name }))` (preserves current name-as-ID pattern in the select, then translates to actual ID on submit)

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { addBaseIngredient, updateBaseIngredient } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBBaseIngredient, DBUnit } from "@/types/db";
```

**Bug fix:** In `handleSubmit`, validate units for ALL items in the array, not just `items[0]`:

```typescript
async function handleSubmit(formData: FormData) {
  setLoading(true);
  // Validate ALL items' units, not just items[0]
  for (let i = 0; i < items.length; i++) {
    if (items[i].base_unit) {
      const unitObj = units.find(
        u => u.name.toLowerCase() === items[i].base_unit.toLowerCase()
      );
      if (!unitObj) {
        alert(`Don vi "${items[i].base_unit}" khong hop le o dong ${i + 1}`);
        setLoading(false);
        return;
      }
      items[i].base_unit = unitObj.id; // Replace name with ID
    }
  }
  // ... rest of submit logic
}
```

- [ ] **Step 3.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 3.5: Create `app/admin/inventory/base-ingredients/components/BaseIngredientsClient.tsx`**

**Props interface:**
```typescript
interface BaseIngredientsClientProps {
  ingredients: DBBaseIngredient[];
  units: DBUnit[];
}
```

**Structure:**
- State: `search` (string)
- `useMemo`: filter ingredients by name matching search
- `StickyFilterBar` with `title="Quan ly Nhom Nguyen Lieu"`, `rightContent={<BaseIngredientForm units={units} />}`
- Filter children: text input (search by name)
- Table columns: ID, Ten Nguyen Lieu, Don Vi (resolved from unit_id to unit name), Thao Tac
- Per-row: `<BaseIngredientForm initialData={ing} units={units} />` (edit) + delete button using `DeleteConfirmModal`
- Empty state

**Delete button pattern (inline, using DeleteConfirmModal):**
```typescript
function DeleteBaseIngredientButton({ id }: { id: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteBaseIngredientAction(fd);
    setLoading(false);
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-red-600 ...">Xoa</button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description="Ban co chac chan muon xoa nguyen lieu nay?"
      />
    </>
  );
}
```

This replaces `DeleteBtn` from InventoryForms.tsx with a local component using the shared `DeleteConfirmModal`.

- [ ] **Step 3.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 3.7: Update `app/admin/inventory/base-ingredients/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { BaseIngredientForm, DeleteBtn } from "@/components/InventoryForms";
import { deleteBaseIngredient } from "@/app/actions/inventory";
```

**New imports:**
```typescript
import { getBaseIngredientsData } from "./actions";
import BaseIngredientsClient from "./components/BaseIngredientsClient";
```

**New page body:**
```typescript
export default async function BaseIngredientsPage() {
  const { ingredients, units } = await getBaseIngredientsData();
  return <BaseIngredientsClient ingredients={ingredients} units={units} />;
}
```

- [ ] **Step 3.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/inventory/base-ingredients` -- table loads, search works
Test: add single ingredient, add multiple (batch), edit, delete
Verify: unit name displays correctly in table
Verify: `is_non_inventory` works in form (even though not displayed in table)

- [ ] **Step 3.9: Commit**

```bash
rtk git add app/admin/inventory/base-ingredients/
rtk git commit -m "refactor(base-ingredients): colocate actions, forms, add StickyFilterBar and type safety"
```

---

### Task 4: Conversions

**Files to create:**
- `app/admin/inventory/conversions/actions.ts`
- `app/admin/inventory/conversions/components/ConversionForm.tsx`
- `app/admin/inventory/conversions/components/ConversionsClient.tsx`

**Files to modify:**
- `app/admin/inventory/conversions/page.tsx`

**Files NOT to modify:**
- `components/InventoryForms.tsx` -- KEEP
- `app/actions/inventory.ts` -- KEEP

---

- [ ] **Step 4.1: Create `app/admin/inventory/conversions/actions.ts`**

New colocated actions. Preserves `update_history` PO line rewrite logic exactly. This is the most critical business logic to preserve.

```typescript
"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBUOMConversion, DBPurchasedItem, DBBaseIngredient, DBUnit } from "@/types/db";

const SHEET = "UOM_Conversions";
const PATH = "/admin/inventory/conversions";

export async function getConversionsData(): Promise<{
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}> {
  try {
    const [baseIngredients, items, conversions, allUnits] = await Promise.all([
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
      findAll(SHEET) as Promise<DBUOMConversion[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { baseIngredients, items, conversions, units };
  } catch (error) {
    console.error("Loi getConversionsData:", error);
    return { baseIngredients: [], items: [], conversions: [], units: [] };
  }
}

export async function addConversion(formData: FormData): Promise<ActionResponse> {
  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!purchased_item_id || !purchased_unit || !conversion_rate || !base_unit) {
    return fail("Thieu thong tin quy doi");
  }

  try {
    const id = await generateNewId(SHEET, "QD");
    await insert(SHEET, {
      id,
      purchased_item_id,
      purchased_unit,
      conversion_rate,
      base_unit,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updateConversion(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;
  const update_history = formData.get("update_history") === "true";

  if (!id || !purchased_item_id || !purchased_unit || !conversion_rate || !base_unit) {
    return fail("Thieu thong tin");
  }

  try {
    // Preserve update_history logic exactly
    if (update_history) {
      const allConvs = await findAll(SHEET);
      const oldConv = allConvs.find((c: DBUOMConversion) => c.id === id);
      if (oldConv && oldConv.purchased_unit !== purchased_unit) {
        const poLines = await findAll("Purchase_Order_Lines");
        for (const line of poLines) {
          if (line.purchased_item_id === purchased_item_id && line.unit === oldConv.purchased_unit) {
            await update("Purchase_Order_Lines", line.id, { ...line, unit: purchased_unit });
          }
        }
      }
    }

    await update(SHEET, id, { purchased_item_id, purchased_unit, conversion_rate, base_unit });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteConversionAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID khong hop le");

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

**Critical:** The `update_history` PO line rewrite in `updateConversion` must be preserved exactly. This retroactively updates Purchase_Order_Lines when the purchased unit changes. The logic is: find old conversion, compare old vs new `purchased_unit` (unit IDs), if changed then scan all PO lines for matching `purchased_item_id` + old unit, update each to new unit.

- [ ] **Step 4.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 4.3: Create `app/admin/inventory/conversions/components/ConversionForm.tsx`**

New form using shared UI. Preserves the complex derived value chain: selectedItem -> baseIngredient -> baseUnit.

**Props interface:**
```typescript
interface ConversionFormProps {
  items: DBPurchasedItem[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
  initialData?: DBUOMConversion;
}
```

**Structure:**
- Named export `ConversionForm`
- Uses `FormModal`, `LoadingButton`
- State: `isOpen`, `loading`, `selectedItemId`, `selectedUnit` (display name)
- Derived: `convertibleItems`, `selectedItem`, `baseIngredient`, `baseUnitId`, `baseUnitName`
- Edit mode: `selectedItemId` from `initialData.purchased_item_id`, `selectedUnit` resolved from unit ID to name
- `SearchableSelect` for purchased item selection
- `SearchableSelect` for unit selection (options = unit names, translates to ID on submit)
- `update_history` checkbox (edit mode only, default checked) -- preserves current behavior
- Unit validation on submit: case-insensitive name-to-ID lookup
- Auto-derived `base_unit` from the item -> base ingredient -> base unit chain

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { addConversion, updateConversion } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBPurchasedItem, DBBaseIngredient, DBUnit, DBUOMConversion } from "@/types/db";
```

- [ ] **Step 4.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 4.5: Create `app/admin/inventory/conversions/components/ConversionsClient.tsx`**

**Props interface:**
```typescript
interface ConversionsClientProps {
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}
```

**Structure:**
- State: `search` (string)
- `useMemo`: filter conversions by resolved item name matching search
- `StickyFilterBar` with `title="Quan ly Bang Quy Doi"`, `rightContent={<ConversionForm ... />}`
- Filter children: text input (search by item name)
- Table columns: ID, Hang Hoa (item name, resolved from purchased_item_id), Don Vi Mua, Don Vi Co Ban, Ty Le Quy Doi, Thao Tac
- Unit name resolution: `units.find(u => u.id === conv.purchased_unit)?.name || conv.purchased_unit`
- Per-row: `<ConversionForm initialData={conv} ... />` (edit) + local delete button using `DeleteConfirmModal`
- Helper function to build unit lookup map (avoids repeated `.find()` calls)

- [ ] **Step 4.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 4.7: Update `app/admin/inventory/conversions/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { ConversionForm, DeleteBtn } from "@/components/InventoryForms";
import { deleteConversion } from "@/app/actions/inventory";
```

**New imports:**
```typescript
import { getConversionsData } from "./actions";
import ConversionsClient from "./components/ConversionsClient";
```

**New page body:**
```typescript
export default async function ConversionsPage() {
  const data = await getConversionsData();
  return <ConversionsClient {...data} />;
}
```

- [ ] **Step 4.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/inventory/conversions` -- table loads, search works
Test: add conversion, edit (with update_history checked), delete
Verify: item name and unit names display correctly
Verify: `update_history` PO line update still works (if testable)

- [ ] **Step 4.9: Commit**

```bash
rtk git add app/admin/inventory/conversions/
rtk git commit -m "refactor(conversions): colocate actions, forms, add StickyFilterBar and type safety"
```

---

### Task 5: Modifiers

This is the most complex feature. Recipe versioning logic must be preserved exactly. The dual-delete-path bug must be fixed (consolidate to single delete button per row).

**Files to create:**
- `app/admin/products/modifiers/actions.ts`
- `app/admin/products/modifiers/components/ModifierForm.tsx`
- `app/admin/products/modifiers/components/ModifiersClient.tsx`

**Files to modify:**
- `app/admin/products/modifiers/page.tsx`

**Files NOT to modify:**
- `components/ModifierForm.tsx` -- KEEP until verified
- `app/actions/modifiers.ts` -- KEEP (still imported by old ModifierForm.tsx)
- `components/HistoryModal.tsx` -- KEEP (shared by 4 pages)

---

- [ ] **Step 5.1: Create `app/admin/products/modifiers/actions.ts`**

New colocated actions. Preserves recipe versioning logic exactly (close old recipe, create new one if ingredients changed). Preserves soft delete. Fixes: soft delete now also closes active recipe.

```typescript
"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";

const MODIFIER_SHEET = "Modifiers";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/products/modifiers";

export async function getModifiersData(): Promise<{
  modifiers: Array<DBModifier & { activeRecipe?: DBRecipe; recipeHistory: Array<any> }>;
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
}> {
  try {
    const [modifiers, recipes, baseIngredients, semiProducts, allUnits] = await Promise.all([
      findAll(MODIFIER_SHEET) as Promise<DBModifier[]>,
      findAll(RECIPE_SHEET) as Promise<DBRecipe[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Semi_Products") as Promise<DBSemiProduct[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);

    const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    const activeBI = baseIngredients.filter(b => b.status !== "DELETED");
    const activeSP = semiProducts.filter(s => s.status !== "DELETED");

    const enriched = activeModifiers.map(m => {
      const modifierRecipes = recipes.filter(
        r => r.target_type === "MODIFIER" && r.target_id === m.id
      );

      const activeRecipe = modifierRecipes.find(
        r => !r.end_date || r.end_date === ""
      ) || undefined;

      const recipeHistory = modifierRecipes.map(r => {
        let ings: any[] = [];
        try { ings = JSON.parse(r.ingredients_json || "[]"); } catch {}
        return {
          ...r,
          ingredients: ings.map((ing: any) => {
            const bi = activeBI.find(b => b.id === ing.ingredient_id);
            const sp = activeSP.find(s => s.id === ing.ingredient_id);
            const source = bi || sp;
            const unitObj = units.find((u: any) => u.id === source?.base_unit);
            return {
              ...ing,
              name: source?.name || ing.ingredient_id,
              unit: unitObj?.name || "",
            };
          }),
        };
      }).sort((a: any, b: any) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );

      return { ...m, activeRecipe, recipeHistory };
    });

    return { modifiers: enriched, baseIngredients: activeBI, semiProducts: activeSP, units };
  } catch (error) {
    console.error("Loi getModifiersData:", error);
    return { modifiers: [], baseIngredients: [], semiProducts: [], units: [] };
  }
}

export async function saveModifier(formData: FormData): Promise<ActionResponse> {
  const isEdit = formData.get("is_edit") === "true";
  const modifier_id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const group_name = formData.get("group_name") as string;
  const price = formData.get("price") as string;
  const ingredientsJson = formData.get("ingredients_json") as string;

  if (!name || !group_name) return fail("Vui long nhap day du thong tin");

  try {
    let finalId = modifier_id;
    const nowIso = new Date().toISOString();

    if (isEdit && modifier_id) {
      await update(MODIFIER_SHEET, modifier_id, { name, group_name, price });
    } else {
      finalId = await generateNewId(MODIFIER_SHEET, "MOD");
      await insert(MODIFIER_SHEET, {
        id: finalId,
        group_name,
        name,
        price,
        status: "ACTIVE",
        created_at: nowIso,
      });
    }

    // Recipe versioning -- preserve exactly
    const allRecipes = await findAll(RECIPE_SHEET);
    const existingActive = allRecipes.find(
      (r: DBRecipe) =>
        r.target_type === "MODIFIER" &&
        r.target_id === finalId &&
        (!r.end_date || r.end_date === "")
    );

    if (existingActive) {
      if (existingActive.ingredients_json !== ingredientsJson) {
        // Close old recipe
        await update(RECIPE_SHEET, existingActive.id, { end_date: nowIso });
        // Create new version
        const recipeId = await generateNewId(RECIPE_SHEET, "RC");
        await insert(RECIPE_SHEET, {
          id: recipeId,
          target_type: "MODIFIER",
          target_id: finalId,
          ingredients_json: ingredientsJson,
          status: "ACTIVE",
          start_date: nowIso,
          end_date: "",
          created_at: nowIso,
        });
      }
      // else: no change, no-op
    } else {
      // No active recipe, create one
      const recipeId = await generateNewId(RECIPE_SHEET, "RC");
      await insert(RECIPE_SHEET, {
        id: recipeId,
        target_type: "MODIFIER",
        target_id: finalId,
        ingredients_json: ingredientsJson,
        status: "ACTIVE",
        start_date: nowIso,
        end_date: "",
        created_at: nowIso,
      });
    }

    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteModifierAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID khong hop le");

  try {
    // Soft delete modifier
    await update(MODIFIER_SHEET, id, { status: "DELETED" });

    // Also close the active recipe (fixes current bug where recipe is left open)
    const allRecipes = await findAll(RECIPE_SHEET);
    const activeRecipe = allRecipes.find(
      (r: DBRecipe) =>
        r.target_type === "MODIFIER" &&
        r.target_id === id &&
        (!r.end_date || r.end_date === "")
    );
    if (activeRecipe) {
      await update(RECIPE_SHEET, activeRecipe.id, { end_date: new Date().toISOString() });
    }

    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
```

**Key decisions:**
- `getModifiersData` combines all 5 sheet fetches and recipe joining into one function (moved from page).
- Recipe versioning logic preserved exactly: close old (set `end_date`), create new if `ingredients_json` changed.
- **Bug fix:** `deleteModifierAction` now also closes the active recipe when soft-deleting a modifier. Current code leaves the recipe's `end_date` empty after deletion.
- Named `deleteModifierAction` to avoid collision with `deleteModifier` in `app/actions/modifiers.ts`.

- [ ] **Step 5.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 5.3: Create `app/admin/products/modifiers/components/ModifierForm.tsx`**

New form using shared UI. Preserves ingredient row pattern. Removes the dual-delete-path (form no longer has its own delete button -- delete is handled by the client component).

**Props interface:**
```typescript
interface ModifierFormProps {
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
  initialData?: DBModifier & { activeRecipe?: DBRecipe };
}
```

**Structure:**
- Named export `ModifierForm`
- Uses `FormModal`, `LoadingButton`
- State: `isOpen`, `loading`, `name`, `groupName` (default "Them Topping"), `price`, `ingredients`
- Edit mode: initialize from `initialData` and `initialData.activeRecipe.ingredients_json`
- Ingredient rows: type select (BASE_INGREDIENT/SEMI_PRODUCT), ingredient select (plain `<select>` matching current behavior), quantity input, remove button
- `addIngredient` / `updateIngredient` / `removeIngredient` for array management
- On submit: build FormData with `is_edit`, `id`, `name`, `group_name`, `price`, `ingredients_json`
- **NO delete button in the form** -- delete is handled by a separate `DeleteModifierButton` in the client component

**Form fields (preserving current set):**
- group_name (select: "Them Topping", "Chon Size", "Chon Duong", "Chon Da")
- name (text, required)
- price (number)
- Ingredients section (dynamic rows)

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { saveModifier } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";
```

- [ ] **Step 5.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 5.5: Create `app/admin/products/modifiers/components/ModifiersClient.tsx`**

The most complex client component. Handles modifier table with ingredient display, history modal, and search.

**Props interface:**
```typescript
interface ModifiersClientProps {
  modifiers: Array<DBModifier & { activeRecipe?: DBRecipe; recipeHistory: Array<any> }>;
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
}
```

**Structure:**
- State: `search` (string)
- `useMemo`: filter modifiers by `name` or `group_name` matching search
- `StickyFilterBar` with `title="Quan ly Tuy Chon"`, `rightContent={<ModifierForm ... />}`
- Filter children: text input (search by name/group)
- Table columns: Nhom, Ten, Gia, Cong Thuc (ingredient list), Thao Tac
- Ingredient display: parse `activeRecipe.ingredients_json`, resolve ingredient names, display as badges
- Per-row actions: `<ModifierForm initialData={m} ... />` (edit) + `<DeleteModifierButton id={m.id} />` + `<HistoryModal>` (if recipe history exists)
- `DeleteModifierButton`: local component using `DeleteConfirmModal`

**Imports:**
```typescript
"use client";
import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import HistoryModal from "@/components/HistoryModal";
import { deleteModifierAction } from "../actions";
import { ModifierForm } from "./ModifierForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";
```

**Key fix:** Only ONE delete button per row (using `DeleteModifierButton`), removing the dual-delete-path bug from the current code.

- [ ] **Step 5.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 5.7: Update `app/admin/products/modifiers/page.tsx`**

This is the biggest page transformation. Current page (150 lines) does recipe joining and ingredient resolution inline. All of that moves to the action and client.

**Old imports (replace ALL 5 lines):**
```typescript
import { findAll } from "@/lib/sheets_db";
import ModifierForm from "@/components/ModifierForm";
import { deleteModifier } from "@/app/actions/modifiers";
import { DeleteBtn } from "@/components/InventoryForms";
import HistoryModal from "@/components/HistoryModal";
```

**New imports:**
```typescript
import { getModifiersData } from "./actions";
import ModifiersClient from "./components/ModifiersClient";
```

**New page body:**
```typescript
export default async function ModifiersPage() {
  const data = await getModifiersData();
  return <ModifiersClient {...data} />;
}
```

This reduces the page from ~150 lines to ~8 lines.

- [ ] **Step 5.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/products/modifiers` -- table loads, search works, ingredient names display
Test: add modifier with ingredients, edit (change ingredients -- verify recipe versioning), delete
Verify: history modal shows recipe versions
Verify: ingredient names and units resolve correctly
Verify: delete soft-deletes modifier AND closes active recipe (bug fix)

- [ ] **Step 5.9: Commit**

```bash
rtk git add app/admin/products/modifiers/
rtk git commit -m "refactor(modifiers): colocate actions, forms, add StickyFilterBar, fix dual-delete and recipe close bugs"
```

---

### Task 6: Cleanup and Validation Gate

- [ ] **Step 6.1: Full TypeScript check**

Run: `rtk tsc`
Expected: `Found 0 errors`

- [ ] **Step 6.2: Dev server starts**

Run: `npm run dev`
Expected: Server starts without errors

- [ ] **Step 6.3: Verify all 5 Wave 1 features**

Visit each page and test CRUD operations:

| Page | URL | Test |
|------|-----|------|
| Suppliers | `/admin/suppliers` | Search, add, edit, delete |
| Categories | `/admin/products/categories` | Search, add, edit, soft delete |
| Base Ingredients | `/admin/inventory/base-ingredients` | Search, add (single + batch), edit, delete |
| Conversions | `/admin/inventory/conversions` | Search, add, edit (with update_history), delete |
| Modifiers | `/admin/products/modifiers` | Search, add with ingredients, edit, delete, history modal |

- [ ] **Step 6.4: Verify non-Wave-1 pages still work**

Visit these pages to confirm old imports still function:

| Page | URL | What to check |
|------|-----|---------------|
| Inventory Items | `/admin/inventory/items` | Loads, uses InventoryForms.PurchasedItemForm + DeleteBtn |
| Inventory Categories | `/admin/inventory/categories` | Loads, uses InventoryForms.ItemCategoryForm + DeleteBtn |
| Semi-products | `/admin/semi-products` | Loads, uses DeleteBtn from InventoryForms |
| Products | `/admin/products` | Loads, uses HistoryModal |
| Purchase Orders | `/admin/inventory/purchase-orders/new` | Loads, SupplierModal works |

- [ ] **Step 6.5: Verify no broken old imports**

Run: `grep -r "from \"@/components/SupplierForm\"" --include="*.tsx" --include="*.ts" app/ components/`
Expected: Only `components/PurchaseOrderForm.tsx` (SupplierModal import -- OK)

Run: `grep -r "from \"@/app/actions/suppliers\"" --include="*.tsx" --include="*.ts" app/ components/`
Expected: Only `components/SupplierForm.tsx` (old SupplierModal uses old addSupplier -- OK)

- [ ] **Step 6.6: Commit final state**

```bash
rtk git add -A
rtk git commit -m "chore(wave1): final cleanup and verification"
```

---

## Part 4: File Manifest

### Files to Create (15 new files)

| File | Feature | Task |
|------|---------|------|
| `app/admin/suppliers/actions.ts` | Suppliers | 1 |
| `app/admin/suppliers/components/SupplierForm.tsx` | Suppliers | 1 |
| `app/admin/suppliers/components/SuppliersClient.tsx` | Suppliers | 1 |
| `app/admin/products/categories/actions.ts` | Categories | 2 |
| `app/admin/products/categories/components/ProductCategoryForm.tsx` | Categories | 2 |
| `app/admin/products/categories/components/CategoriesClient.tsx` | Categories | 2 |
| `app/admin/inventory/base-ingredients/actions.ts` | Base Ingredients | 3 |
| `app/admin/inventory/base-ingredients/components/BaseIngredientForm.tsx` | Base Ingredients | 3 |
| `app/admin/inventory/base-ingredients/components/BaseIngredientsClient.tsx` | Base Ingredients | 3 |
| `app/admin/inventory/conversions/actions.ts` | Conversions | 4 |
| `app/admin/inventory/conversions/components/ConversionForm.tsx` | Conversions | 4 |
| `app/admin/inventory/conversions/components/ConversionsClient.tsx` | Conversions | 4 |
| `app/admin/products/modifiers/actions.ts` | Modifiers | 5 |
| `app/admin/products/modifiers/components/ModifierForm.tsx` | Modifiers | 5 |
| `app/admin/products/modifiers/components/ModifiersClient.tsx` | Modifiers | 5 |

### Files to Modify (5 files)

| File | Change | Task |
|------|--------|------|
| `app/admin/suppliers/page.tsx` | Replace imports + body with slim server component | 1 |
| `app/admin/products/categories/page.tsx` | Replace imports + body with slim server component | 2 |
| `app/admin/inventory/base-ingredients/page.tsx` | Replace imports + body with slim server component | 3 |
| `app/admin/inventory/conversions/page.tsx` | Replace imports + body with slim server component | 4 |
| `app/admin/products/modifiers/page.tsx` | Replace imports + body with slim server component | 5 |

### Files NOT Modified (Kept for Non-Wave-1 Consumers)

| File | Why kept |
|------|----------|
| `components/SupplierForm.tsx` | Contains `SupplierModal` used by `PurchaseOrderForm.tsx` |
| `components/InventoryForms.tsx` | Contains `ItemCategoryForm`, `PurchasedItemForm`, `DeleteBtn`, `ActionGroup` for non-Wave-1 pages |
| `components/ModifierForm.tsx` | Old form -- will be deleted in cleanup wave after all consumers migrated |
| `components/ProductCategoryForm.tsx` | Old form -- will be deleted in cleanup wave |
| `app/actions/suppliers.ts` | Old actions -- still imported by old `SupplierForm.tsx` |
| `app/actions/modifiers.ts` | Old actions -- still imported by old `ModifierForm.tsx` |
| `app/actions/products.ts` | Contains product (non-category) actions |
| `app/actions/inventory.ts` | Contains items, categories, units actions |
| `components/HistoryModal.tsx` | Shared by 4 pages, stays in `components/` |

---

## Part 5: Bug Fixes Included in This Plan

| Bug | Feature | Fix | Task |
|-----|---------|-----|------|
| Batch unit validation only checks `items[0]` | Base Ingredients | Validate ALL items in the array | 3 |
| Fallback add path missing `is_non_inventory` | Base Ingredients | Add `is_non_inventory: "FALSE"` to fallback | 3 |
| No validation in `updateBaseIngredient` | Base Ingredients | Add `!id \|\| !name \|\| !base_unit` check | 3 |
| Submit errors silently swallowed | Categories | Add error handling with inline display | 2 |
| Form state not cleared on modal close | Categories | Reset name on close | 2 |
| Dual delete buttons per row | Modifiers | Consolidate to single `DeleteModifierButton` | 5 |
| Soft delete leaves active recipe open | Modifiers | Close active recipe on delete | 5 |
| `confirm()` and `alert()` dialogs | All | Replace with `DeleteConfirmModal` + inline errors | 1-5 |

---

## Part 6: Expected Outcomes

### Before (Current State)

| Feature | Page Lines | Form Lines | Action Lines | `any` Count | Filters |
|---------|-----------|------------|-------------|-------------|---------|
| Suppliers | 65 | 341 | 56 | 5 | None |
| Categories | 66 | 148 | 43 | 3 | None |
| Base Ingredients | 55 | ~125 | ~67 | ~8 | None |
| Conversions | ~65 | ~123 | ~68 | ~6 | None |
| Modifiers | 150 | 183 | 91 | 14 | None |
| **Totals** | ~401 | ~920 | ~325 | ~36 | 0 |

### After (Target State)

| Feature | Page Lines | Client Lines | Form Lines | Action Lines | `any` Count | Filters |
|---------|-----------|-------------|------------|-------------|-------------|---------|
| Suppliers | ~8 | ~90 | ~120 | ~70 | 0 | Search + Status |
| Categories | ~8 | ~70 | ~100 | ~55 | 0 | Search |
| Base Ingredients | ~8 | ~80 | ~130 | ~80 | 0 | Search |
| Conversions | ~8 | ~100 | ~130 | ~95 | 0 | Search |
| Modifiers | ~8 | ~140 | ~140 | ~120 | 0 | Search |
| **Totals** | ~40 | ~480 | ~620 | ~420 | 0 | 5 |

### Improvements Summary

| Metric | Before | After |
|--------|--------|-------|
| Shared UI components used | 0 | FormModal, LoadingButton, DeleteConfirmModal across all 5 |
| TypeScript interfaces | 0 `any` props | All props typed with `types/db.ts` |
| Search/filter capability | None | Text search on all 5 features |
| StickyFilterBar | Not used | Used on all 5 features |
| Bug fixes | 0 | 8 bugs fixed |
| Page line count | ~401 | ~40 (90% reduction) |
