# Architecture Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate ~1,200 lines of duplicated code across `components/` and `app/actions/` by introducing shared UI primitives, a CRUD action factory, strict TypeScript types, and feature-colocated directory structure.

**Architecture:** Feature Colocation -- each admin feature owns its actions, components, and types inside `app/admin/[feature]/`. Shared UI primitives (`FormModal`, `DeleteConfirmModal`, `LoadingButton`) live in `components/ui/`. A shared action factory in `lib/shared-actions.ts` collapses repetitive CRUD boilerplate. All `any` types replaced with strict interfaces from `types/db.ts`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Google Sheets via `lib/sheets_db.ts`

---

## Part 1: Audit Findings

### 1A. Component Duplication (`components/` -- 22 files, ~3,455 lines)

| Pattern | Occurrences | Wasted lines |
|---------|-------------|--------------|
| Modal overlay (`fixed inset-0 bg-black/50`) | 14+ | ~70 |
| Modal card shell (header/body/footer zones) | 5 | ~100 |
| Close X SVG icon (`M6 18L18 6M6 6l12 12`) | 12+ | ~36 |
| `[isOpen, setIsOpen]` + `[loading, setLoading]` | 15+ | ~60 |
| Delete confirmation modal (styled, ~35 lines each) | 4 | ~140 |
| Warning triangle SVG in delete modal | 4 | ~12 |
| `isEdit = !!initialData` toggle pattern | 8 | ~24 |
| Form footer (Cancel + Submit buttons) | 10+ | ~100 |
| Loading button text (`{loading ? "..." : "Label"}`) | 15+ | ~15 |
| **Estimated total** | | **~557 lines** |

**Inconsistencies found:**

1. **Two modal styles**: Style A (simple overlay, no header/body/footer zones) in BrandForm, UserForm, InventoryForms. Style B (structured 3-zone) in ModifierForm, ProductCategoryForm, ProductForm, ProductionForm, SemiProductForm. No shared base.
2. **Two submission patterns**: `form action={fn}` (Variant A) vs `onSubmit + e.preventDefault() + new FormData()` (Variant B). Chosen arbitrarily.
3. **Three delete patterns**: `confirm()` browser dialog (ModifierForm, BrandForm, UserForm), dedicated styled modal (ProductCategoryForm, ProductForm, SupplierForm, InventoryForms.ActionGroup), separate component export (BrandForm, UserForm, SupplierForm).
4. **BrandForm violates project convention**: uses 3 separate exported components (BrandForm, EditBrandButton, DeleteBrandButton) while all other forms combine add/edit into one component with `isEdit = !!initialData`.
5. **SupplierForm has redundant SupplierModal** duplicating the same fields as SupplierForm.
6. **PromotionForm uses externally-controlled open/close** (`onClose`/`onSuccess` props), inconsistent with all other forms that manage `isOpen` internally.
7. **`any` prop types** in 10 of 12 form components. Only PromotionForm and some InventoryForms sub-components have proper TypeScript interfaces.

### 1B. Server Action Duplication (`app/actions/` -- 17 files, ~2,423 lines)

| Pattern | Occurrences | Wasted lines |
|---------|-------------|--------------|
| Simple create (FormData -> validate -> insert -> revalidate -> return) | 8 | ~160 |
| Simple update (FormData -> validate -> update -> revalidate -> return) | 6 | ~100 |
| Simple delete (FormData -> validate -> remove -> revalidate -> return) | 7 | ~90 |
| Soft delete (`status: "DELETED"`) | 4 | ~40 |
| Recipe versioning block | 3 | ~90 |
| Duplicated `getIngredientUnitCost` helper | 2 | ~25 |
| Duplicated `findRecipeAtTime` helper | 2 | ~50 |
| Duplicated stock deduction logic (~90 lines) | 2 | ~90 |
| **Estimated total** | | **~645 lines** |

**Critical bugs found:**

1. **Name collision in `index.ts`**: Both `orders.ts` and `pos.ts` export functions that could shadow each other. The barrel file uses the OLD `@/lib/sheets` API.
2. **Inconsistent error response shapes**: Some return `{ error }`, others `{ success: false, error }`, others nothing at all.
3. **Inconsistent parameter types**: Most accept `FormData`, but `promotions.ts`, `stock.ts`, `orders.ts:deleteOrder`, and `order-edit.ts` accept typed objects.
4. **`auth.ts` uses raw Sheets API** (`@/lib/sheets`) instead of `sheets_db`, and uses SHA-256 while `users.ts` uses bcrypt.
5. **`pos.ts` uses dynamic `require()`** inside function body.
6. **`reports.ts` has no error handling** at all.

### 1C. Directory Structure Problems

11 of 22 component files are used by exactly ONE feature. They belong in that feature's directory, not in a shared `components/` folder.

| Component | Used ONLY by | Should live in |
|-----------|-------------|----------------|
| `BrandForm.tsx` | `app/admin/brands/` | `app/admin/brands/components/` |
| `UserForm.tsx` + `EditUserForm.tsx` | `app/admin/users/` | `app/admin/users/components/` |
| `SupplierForm.tsx` | `app/admin/suppliers/` | `app/admin/suppliers/components/` |
| `ProductionForm.tsx` | `app/admin/production/` | `app/admin/production/components/` |
| `SemiProductForm.tsx` | `app/admin/semi-products/` | `app/admin/semi-products/components/` |
| `ProductCategoryForm.tsx` | `app/admin/products/categories/` | `app/admin/products/categories/components/` |
| `ModifierForm.tsx` | `app/admin/products/modifiers/` | `app/admin/products/modifiers/components/` |
| `InventoryForms.tsx` | `app/admin/inventory/` sub-routes | `app/admin/inventory/components/` |
| `PurchaseOrderForm.tsx` | `app/admin/inventory/purchase-orders/` | `app/admin/inventory/purchase-orders/components/` |
| `PromotionForm.tsx` | `app/admin/promotions/` | `app/admin/promotions/components/` |
| `ProductForm.tsx` | `app/admin/products/` | `app/admin/products/components/` |

---

## Part 2: Target Architecture

### 2A. New Directory Structure (After Full Refactoring)

```
app/admin/
  layout.tsx                             # KEEP
  brands/
    page.tsx                             # MODIFY (update imports)
    components/
      BrandForm.tsx                      # MOVED from components/BrandForm.tsx, REFACTORED
    actions.ts                           # MOVED from app/actions/brands.ts, REFACTORED

  orders/
    page.tsx                             # KEEP
    OrderTable.tsx                       # KEEP (already local)
    OrderDetailModal.tsx                 # KEEP (already local)
    OrderEditModal.tsx                   # KEEP (already local)
    actions/
      orders.ts                          # MOVED from app/actions/orders.ts
      order-edit.ts                      # MOVED from app/actions/order-edit.ts
      pos.ts                             # MOVED from app/actions/pos.ts

  products/
    page.tsx                             # KEEP
    ProductsClient.tsx                   # KEEP (already local)
    components/
      ProductForm.tsx                    # MOVED from components/ProductForm.tsx
    actions.ts                           # MOVED from app/actions/products.ts

    categories/
      page.tsx                           # KEEP
      components/
        ProductCategoryForm.tsx          # MOVED from components/ProductCategoryForm.tsx

    modifiers/
      page.tsx                           # KEEP
      components/
        ModifierForm.tsx                 # MOVED from components/ModifierForm.tsx
      actions.ts                         # MOVED from app/actions/modifiers.ts

  inventory/
    page.tsx                             # KEEP
    categories/page.tsx                  # KEEP
    base-ingredients/page.tsx            # KEEP
    items/page.tsx                       # KEEP
    conversions/page.tsx                 # KEEP
    units/
      page.tsx                           # KEEP
      UnitForm.tsx                       # KEEP (already local)
    purchase-orders/
      new/page.tsx                       # KEEP
      [id]/page.tsx                      # KEEP
      components/
        PurchaseOrderForm.tsx            # MOVED from components/PurchaseOrderForm.tsx
    sync/page.tsx                        # KEEP
    components/
      InventoryForms.tsx                 # MOVED from components/InventoryForms.tsx
    actions.ts                           # MOVED from app/actions/inventory.ts + purchase-orders.ts

  suppliers/
    page.tsx                             # KEEP
    components/
      SupplierForm.tsx                   # MOVED from components/SupplierForm.tsx
    actions.ts                           # MOVED from app/actions/suppliers.ts

  production/
    page.tsx                             # KEEP
    components/
      ProductionForm.tsx                 # MOVED from components/ProductionForm.tsx
    actions.ts                           # MOVED from app/actions/production.ts

  semi-products/
    page.tsx                             # KEEP
    components/
      SemiProductForm.tsx                # MOVED from components/SemiProductForm.tsx
    actions.ts                           # MOVED from app/actions/recipes.ts

  users/
    page.tsx                             # KEEP
    edit/[id]/page.tsx                   # KEEP
    components/
      UserForm.tsx                       # MOVED from components/UserForm.tsx
      EditUserForm.tsx                   # MOVED from components/EditUserForm.tsx
    actions.ts                           # MOVED from app/actions/users.ts

  promotions/
    page.tsx                             # KEEP
    PromotionsClient.tsx                 # KEEP (already local)
    components/
      PromotionForm.tsx                  # MOVED from components/PromotionForm.tsx
    actions.ts                           # MOVED from app/actions/promotions.ts

  reports/
    sales/page.tsx                       # KEEP
    pnl/page.tsx                         # KEEP
    stock/page.tsx                       # KEEP
    components/
      SalesFilter.tsx                    # MOVED from components/SalesFilter.tsx
      SalesCharts.tsx                    # MOVED from components/SalesCharts.tsx
      CategoryPieChart.tsx               # MOVED from components/CategoryPieChart.tsx
      StockTable.tsx                     # MOVED from components/StockTable.tsx
    actions/
      reports.ts                         # MOVED from app/actions/reports.ts
      stock.ts                           # MOVED from app/actions/stock.ts

components/
  ui/
    FormModal.tsx                        # NEW -- shared modal wrapper
    DeleteConfirmModal.tsx               # NEW -- shared delete confirmation
    LoadingButton.tsx                    # NEW -- shared loading-state button
  CustomDatePicker.tsx                   # KEEP (shared across 5+ features)
  SearchableSelect.tsx                   # KEEP (shared across 3+ features)
  StickyFilterBar.tsx                    # KEEP (shared across 3+ features)
  HistoryModal.tsx                       # KEEP (shared across 2+ features)
  SessionProvider.tsx                     # KEEP (shared layout)
  POSScreen.tsx                          # KEEP (do not refactor -- separate project)

types/
  db.ts                                  # EXTEND with 15+ new interfaces

lib/
  sheets_db.ts                           # KEEP (no changes)
  report-utils.ts                        # KEEP
  shared-actions.ts                      # NEW -- CRUD factory + shared helpers
```

### 2B. New Shared UI Components

#### `components/ui/FormModal.tsx`

Replaces 14+ duplicated modal instances across all forms.

```typescript
"use client";

import React from "react";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = "max-w-md",
  children,
  footer,
}: FormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### `components/ui/DeleteConfirmModal.tsx`

Replaces 4 identical styled delete confirmation modals + 3 `confirm()` browser dialogs.

```typescript
"use client";

import { useState } from "react";
import { FormModal } from "./FormModal";
import { LoadingButton } from "./LoadingButton";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xac nhan xoa",
  description = "Hanh dong nay khong the hoan tac. Ban co chac chan muon tiep tuc?",
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-sm"
    >
      <div className="text-center py-2">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition"
        >
          Huy
        </button>
        <LoadingButton
          loading={loading}
          loadingText="Dang xoa..."
          onClick={handleConfirm}
          variant="danger"
        >
          Xoa
        </LoadingButton>
      </div>
    </FormModal>
  );
}
```

#### `components/ui/LoadingButton.tsx`

Replaces 15+ loading-state button instances across all forms.

```typescript
"use client";

import React from "react";

interface LoadingButtonProps {
  loading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "danger" | "secondary";
  form?: string;
  className?: string;
  disabled?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100",
};

export function LoadingButton({
  loading,
  loadingText = "Dang xu ly...",
  children,
  onClick,
  type = "button",
  variant = "primary",
  form,
  className = "",
  disabled = false,
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      form={form}
      disabled={loading || disabled}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition ${variantStyles[variant]} ${className}`}
    >
      {loading ? loadingText : children}
    </button>
  );
}
```

### 2C. Shared Action Utilities (`lib/shared-actions.ts`)

```typescript
import { insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export interface ActionResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export function ok(extra?: Record<string, unknown>): ActionResponse {
  return { success: true, ...extra };
}

export function fail(error: string): ActionResponse {
  return { error };
}

export async function createEntity(
  sheetName: string,
  idPrefix: string,
  fields: Record<string, unknown>,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    const id = await generateNewId(sheetName, idPrefix);
    const created_at = new Date().toISOString();
    await insert(sheetName, { id, ...fields, created_at });
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updateEntity(
  sheetName: string,
  id: string,
  fields: Record<string, unknown>,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    await update(sheetName, id, fields);
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteEntity(
  sheetName: string,
  id: string,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    await remove(sheetName, id);
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function softDeleteEntity(
  sheetName: string,
  id: string,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    await update(sheetName, id, { status: "DELETED" });
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
```

### 2D. TypeScript Model Extensions (`types/db.ts`)

Add to the existing `types/db.ts` file:

```typescript
// Fix existing DBBrand -- add missing fields
export interface DBBrand {
  id: string;
  name: string;
  code: string;
  start_date: string;
  status: string;
  created_at: string;
}

// New interfaces
export interface DBSupplier {
  id: string;
  name: string;
  phone: string;
  tax_id: string;
  address: string;
  links: string;
  status: string;
  created_at: string;
}

export interface DBUser {
  id: string;
  username: string;
  password: string;
  role: "STAFF" | "MANAGER" | "ADMIN";
  status: string;
  created_at: string;
}

export interface DBUnit {
  id: string;
  name: string;
  abbreviation: string;
  status: string;
  created_at: string;
}

export interface DBItemCategory {
  id: string;
  name: string;
  system_type: "RAW" | "CONSUMABLE" | "EQUIPMENT";
  status: string;
  created_at: string;
}

export interface DBBaseIngredient {
  id: string;
  name: string;
  unit_id: string;
  is_non_inventory: string;
  status: string;
  created_at: string;
}

export interface DBPurchasedItem {
  id: string;
  name: string;
  item_category_id: string;
  base_ingredient_id: string;
  default_unit_id: string;
  status: string;
  created_at: string;
}

export interface DBUOMConversion {
  id: string;
  purchased_item_id: string;
  from_unit_id: string;
  to_unit_id: string;
  factor: string;
  status: string;
  created_at: string;
}

export interface DBRecipe {
  id: string;
  target_type: "PRODUCT_VARIANT" | "SEMI_PRODUCT" | "MODIFIER";
  target_id: string;
  ingredients_json: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface DBStockLedger {
  id: string;
  item_type: string;
  item_id: string;
  transaction_type: string;
  quantity: string;
  unit_cost: string;
  reference_id: string;
  notes: string;
  created_at: string;
}

export interface DBPurchaseOrder {
  id: string;
  supplier_id: string;
  source_id: string;
  transaction_date: string;
  subtotal: string;
  shipping_cost: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  status: string;
  created_at: string;
}

export interface DBPurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  item_id: string;
  quantity: string;
  unit_id: string;
  unit_cost: string;
  subtotal: string;
  created_at: string;
}

export interface DBSemiProduct {
  id: string;
  name: string;
  unit_id: string;
  status: string;
  created_at: string;
}

export interface DBProductionOrder {
  id: string;
  semi_product_id: string;
  target_yield: string;
  status: string;
  created_at: string;
}

export interface DBProductionItem {
  id: string;
  production_order_id: string;
  ingredient_type: string;
  ingredient_id: string;
  quantity: string;
  unit_id: string;
  created_at: string;
}

export interface DBPriceHistory {
  id: string;
  variant_id: string;
  price: string;
  effective_date: string;
  created_at: string;
}
```

---

## Part 3: Execution Plan -- Brands Proof-of-Concept

### Task 1: Create Shared UI Components

**Files:**
- Create: `components/ui/FormModal.tsx`
- Create: `components/ui/DeleteConfirmModal.tsx`
- Create: `components/ui/LoadingButton.tsx`

- [ ] **Step 1.1: Create `components/ui/` directory**

Run: `mkdir -p components/ui`

- [ ] **Step 1.2: Create `components/ui/FormModal.tsx`**

Write the complete FormModal component as shown in section 2B above. Key interface:

```typescript
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;         // Tailwind class, default "max-w-md"
  children: React.ReactNode; // body content
  footer?: React.ReactNode;  // optional footer buttons
}
```

- [ ] **Step 1.3: Create `components/ui/LoadingButton.tsx`**

Write the complete LoadingButton component as shown in section 2B above. Key interface:

```typescript
interface LoadingButtonProps {
  loading: boolean;
  loadingText?: string;      // default: "Dang xu ly..."
  children: React.ReactNode; // idle state label
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "danger" | "secondary";
  form?: string;
  className?: string;
  disabled?: boolean;
}
```

- [ ] **Step 1.4: Create `components/ui/DeleteConfirmModal.tsx`**

Write the complete DeleteConfirmModal component as shown in section 2B above. Key interface:

```typescript
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;            // default: "Xac nhan xoa"
  description?: string;      // default: "Hanh dong nay khong the hoan tac..."
}
```

Note: DeleteConfirmModal uses FormModal and LoadingButton internally.

- [ ] **Step 1.5: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 1.6: Commit**

```bash
rtk git add components/ui/FormModal.tsx components/ui/LoadingButton.tsx components/ui/DeleteConfirmModal.tsx
rtk git commit -m "feat: add shared UI components (FormModal, LoadingButton, DeleteConfirmModal)"
```

---

### Task 2: Extend TypeScript Models

**Files:**
- Modify: `types/db.ts`

- [ ] **Step 2.1: Update existing `DBBrand` interface**

Replace the current `DBBrand` (lines 71-76) to add missing fields:

```typescript
export interface DBBrand {
  id: string;
  name: string;
  code: string;
  start_date: string;
  status: string;
  created_at: string;
}
```

- [ ] **Step 2.2: Add all new interfaces**

Append the new interfaces after the existing `DBModifier` interface (line 84):

`DBSupplier`, `DBUser`, `DBUnit`, `DBItemCategory`, `DBBaseIngredient`, `DBPurchasedItem`, `DBUOMConversion`, `DBRecipe`, `DBStockLedger`, `DBPurchaseOrder`, `DBPurchaseOrderLine`, `DBSemiProduct`, `DBProductionOrder`, `DBProductionItem`, `DBPriceHistory`

Complete code for each interface is in section 2D above.

- [ ] **Step 2.3: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors (the new interfaces are purely additive -- no existing code references them yet)

- [ ] **Step 2.4: Commit**

```bash
rtk git add types/db.ts
rtk git commit -m "feat: extend types/db.ts with 15 new interfaces and fix DBBrand"
```

---

### Task 3: Create Shared Action Utilities

**Files:**
- Create: `lib/shared-actions.ts`

- [ ] **Step 3.1: Create `lib/shared-actions.ts`**

Write the complete shared action utilities as shown in section 2C above. Exports:

| Export | Purpose |
|--------|---------|
| `ActionResponse` | Type for all action return values |
| `ok(extra?)` | Success response factory |
| `fail(error)` | Error response factory |
| `createEntity(sheet, prefix, fields, path)` | Generic create with ID generation |
| `updateEntity(sheet, id, fields, path)` | Generic update |
| `deleteEntity(sheet, id, path)` | Generic hard delete |
| `softDeleteEntity(sheet, id, path)` | Generic soft delete |

- [ ] **Step 3.2: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 3.3: Commit**

```bash
rtk git add lib/shared-actions.ts
rtk git commit -m "feat: add shared action utilities (createEntity, updateEntity, deleteEntity)"
```

---

### Task 4: Create Colocated Brands Actions

**Files:**
- Create: `app/admin/brands/actions.ts`
- Delete: `app/actions/brands.ts` (after verification)

- [ ] **Step 4.1: Create `app/admin/brands/` directory for actions**

Run: `mkdir -p app/admin/brands` (already exists, just confirming)

- [ ] **Step 4.2: Create `app/admin/brands/actions.ts`**

Refactored brands server actions using shared utilities:

```typescript
"use server";

import { findAll } from "@/lib/sheets_db";
import { createEntity, updateEntity, deleteEntity, type ActionResponse } from "@/lib/shared-actions";

const SHEET = "Brands";
const PATH = "/admin/brands";

export async function getBrands() {
  try {
    return await findAll(SHEET);
  } catch (error) {
    console.error("Loi getBrands:", error);
    return [];
  }
}

export async function addBrand(formData: FormData): Promise<ActionResponse> {
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const start_date = formData.get("start_date") as string;

  if (!name) return { error: "Ten thuong hieu khong duoc de trong" };

  return createEntity(SHEET, "BR", { name, code: code?.toUpperCase(), start_date }, PATH);
}

export async function editBrand(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const start_date = formData.get("start_date") as string;

  if (!id || !name) return { error: "ID va Ten khong hop le" };

  return updateEntity(SHEET, id, { name, code: code?.toUpperCase(), start_date }, PATH);
}

export async function deleteBrand(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return { error: "ID khong hop le" };

  return deleteEntity(SHEET, id, PATH);
}
```

**Result:** 63 lines -> ~35 lines. Same functionality, consistent error handling via `shared-actions.ts`.

- [ ] **Step 4.3: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 4.4: Commit**

```bash
rtk git add app/admin/brands/actions.ts
rtk git commit -m "feat: create colocated brands actions using shared utilities"
```

---

### Task 5: Refactor and Relocate BrandForm

**Files:**
- Create: `app/admin/brands/components/BrandForm.tsx`
- Delete: `components/BrandForm.tsx` (after verification)

- [ ] **Step 5.1: Create `app/admin/brands/components/` directory**

Run: `mkdir -p app/admin/brands/components`

- [ ] **Step 5.2: Create `app/admin/brands/components/BrandForm.tsx`**

This is the key refactoring task. The three current exports (`BrandForm`, `EditBrandButton`, `DeleteBrandButton`) consolidate into ONE component following the `isEdit = !!initialData` pattern used by all other forms in the project. Uses the new shared UI components.

```typescript
"use client";

import { useState } from "react";
import { addBrand, deleteBrand, editBrand } from "../actions";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { FormModal } from "@/components/ui/FormModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBBrand } from "@/types/db";

interface BrandFormProps {
  initialData?: DBBrand;
}

function formatDateToYYYYMMDD(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

export function BrandForm({ initialData }: BrandFormProps) {
  const isEdit = !!initialData;

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialData?.start_date ? new Date(initialData.start_date) : null
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    if (selectedDate) {
      formData.set("start_date", formatDateToYYYYMMDD(selectedDate));
    } else {
      formData.delete("start_date");
    }
    const fn = isEdit ? editBrand : addBrand;
    await fn(formData);
    setLoading(false);
    setIsOpen(false);
    if (!isEdit) setSelectedDate(null);
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-4"
        >
          Sua
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          + Them Thuong Hieu
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          if (!isEdit) setSelectedDate(null);
        }}
        title={isEdit ? "Sua Thuong Hieu" : "Them Thuong Hieu Moi"}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (!isEdit) setSelectedDate(null);
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
              Huy
            </button>
            <LoadingButton
              type="submit"
              form="brand-form"
              loading={loading}
              loadingText="Dang luu..."
            >
              {isEdit ? "Cap nhat" : "Luu Thuong Hieu"}
            </LoadingButton>
          </>
        }
      >
        <form id="brand-form" action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ten Thuong Hieu
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={initialData?.name}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
              placeholder="VD: Phin Di"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ma Don Hang (3 ky tu)
            </label>
            <input
              type="text"
              name="code"
              maxLength={3}
              required
              defaultValue={initialData?.code}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 uppercase text-gray-900"
              placeholder="VD: PHD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ngay bat dau hoat dong
            </label>
            <CustomDatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              showTimeSelect={false}
              placeholderText="DD/MM/YYYY"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}

interface DeleteBrandButtonProps {
  id: string;
}

export function DeleteBrandButton({ id }: DeleteBrandButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", id);
    await deleteBrand(formData);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50"
      >
        {loading ? "..." : "Xoa"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description="Ban co chac chan muon xoa thuong hieu nay?"
      />
    </>
  );
}
```

**Result:** 207 lines (3 exports) -> ~155 lines (2 exports). Uses FormModal, LoadingButton, DeleteConfirmModal. Follows the `isEdit` pattern consistent with all other forms. `any` replaced with `DBBrand`.

**Note:** `DeleteBrandButton` remains a separate export because it's used as an inline table action (no `initialData`). The add/edit forms are merged into `BrandForm`.

- [ ] **Step 5.3: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 5.4: Commit**

```bash
rtk git add app/admin/brands/components/BrandForm.tsx
rtk git commit -m "feat: create colocated BrandForm using shared UI components"
```

---

### Task 6: Update Brands Page Imports

**Files:**
- Modify: `app/admin/brands/page.tsx`

- [ ] **Step 6.1: Update imports in `app/admin/brands/page.tsx`**

Replace the two import lines at the top of the file:

**Old (lines 1-2):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { BrandForm, DeleteBrandButton, EditBrandButton } from "@/components/BrandForm";
```

**New:**
```typescript
import { findAll } from "@/lib/sheets_db";
import { BrandForm, DeleteBrandButton } from "./components/BrandForm";
import type { DBBrand } from "@/types/db";
```

- [ ] **Step 6.2: Fix the table rendering to use `DBBrand` type**

Replace `(brand: any)` with `(brand: DBBrand)` on line 37:

**Old:**
```typescript
brands.map((brand: any) => (
```

**New:**
```typescript
brands.map((brand: DBBrand) => (
```

- [ ] **Step 6.3: Replace `EditBrandButton` with `BrandForm` (edit mode)**

**Old (line 46):**
```typescript
<EditBrandButton brand={brand} />
```

**New:**
```typescript
<BrandForm initialData={brand} />
```

- [ ] **Step 6.4: Fix the colSpan bug**

**Old (line 32):**
```typescript
<td colSpan={4} className="px-6 py-8 text-center text-gray-500">
```

**New:**
```typescript
<td colSpan={5} className="px-6 py-8 text-center text-gray-500">
```

(The table has 5 columns: ID, Ten, Ma, Ngay, Thao tac -- colSpan should be 5.)

- [ ] **Step 6.5: Fix the `allBrands` filter type**

**Old (line 6):**
```typescript
const brands = allBrands.filter((b:any) => b.status !== "DELETED");
```

**New:**
```typescript
const brands = allBrands.filter((b: DBBrand) => b.status !== "DELETED");
```

- [ ] **Step 6.6: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 6.7: Commit**

```bash
rtk git add app/admin/brands/page.tsx
rtk git commit -m "refactor: update brands page to use colocated components and DBBrand type"
```

---

### Task 7: Remove Old Files and Clean Up

**Files:**
- Delete: `app/actions/brands.ts`
- Delete: `components/BrandForm.tsx`

- [ ] **Step 7.1: Verify no remaining references to old paths**

Run: `grep -r "@/app/actions/brands" --include="*.tsx" --include="*.ts" .`
Run: `grep -r "@/components/BrandForm" --include="*.tsx" --include="*.ts" .`
Expected: 0 results for both

- [ ] **Step 7.2: Delete old files**

```bash
rm app/actions/brands.ts
rm components/BrandForm.tsx
```

- [ ] **Step 7.3: Check `app/actions/index.ts` for brands re-exports**

Read `app/actions/index.ts`. If it re-exports from `brands.ts`, remove those lines. Based on current audit, it does NOT re-export from brands.ts (it uses the old `@/lib/sheets` API inline), so no changes needed.

- [ ] **Step 7.4: Verify TypeScript compiles**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 7.5: Commit**

```bash
rtk git add -A
rtk git commit -m "refactor: remove old brands files after colocation"
```

---

### Task 8: End-to-End Validation Gate

This is the **validation gate** before considering the Brands PoC complete.

- [ ] **Step 8.1: TypeScript compilation**

Run: `rtk tsc`
Expected: `Found 0 errors`

- [ ] **Step 8.2: Dev server starts cleanly**

Run: `npm run dev`
Expected: Server starts without errors, no ERROR-level logs

- [ ] **Step 8.3: Brands page loads**

Visit `http://localhost:3000/admin/brands` (or the correct port).
Expected: Table renders with all existing brands, "Them Thuong Hieu" button visible.

- [ ] **Step 8.4: Add brand works**

Click "+ Them Thuong Hieu" -> FormModal opens -> Fill name, code, date -> Click "Luu Thuong Hieu".
Expected: Modal closes, new brand appears in table.

- [ ] **Step 8.5: Edit brand works**

Click "Sua" on any brand -> FormModal opens with pre-filled data -> Change name -> Click "Cap nhat".
Expected: Modal closes, brand name updated in table.

- [ ] **Step 8.6: Delete brand works**

Click "Xoa" on any brand -> DeleteConfirmModal opens with warning icon -> Click "Xoa".
Expected: Modal closes, brand removed from table.

- [ ] **Step 8.7: Other pages unaffected**

Visit each of these pages and verify they load without errors:
- `/admin/orders`
- `/admin/products`
- `/admin/inventory/units`
- `/admin/suppliers`
- `/admin/users`

- [ ] **Step 8.8: No broken imports remain**

Run: `grep -r "@/components/BrandForm\|@/app/actions/brands" --include="*.tsx" --include="*.ts" .`
Expected: 0 results

---

## Part 4: Post-PoC Rollout Plan

After the Brands PoC passes the validation gate (Task 8), apply the same pattern to each remaining feature. Order by complexity (simplest first):

### Rollout Phases

| Phase | Feature | Action File | Form File(s) | Complexity | Est. Savings |
|-------|---------|-------------|--------------|------------|-------------|
| 4A | Suppliers | `suppliers.ts` (55 lines) | `SupplierForm.tsx` (340 lines) | Low: simple CRUD, merge duplicate SupplierModal | ~180 lines |
| 4B | Users | `users.ts` (66 lines) | `UserForm.tsx` (117) + `EditUserForm.tsx` (89) | Low: simple CRUD, bcrypt hashing | ~100 lines |
| 4C | Inventory sub-routes | `inventory.ts` (362 lines) | `InventoryForms.tsx` (605) | Medium: 5 entity types, cascading logic | ~250 lines |
| 4D | Product Categories + Modifiers | `products.ts` (226) + `modifiers.ts` (91) | `ProductCategoryForm.tsx` (148) + `ModifierForm.tsx` (184) | Medium: recipe versioning in modifiers | ~150 lines |
| 4E | Products (main) | (same `products.ts`) | `ProductForm.tsx` (310) | Medium-High: multi-entity save, variants, ingredients | ~100 lines |
| 4F | Semi-products | `recipes.ts` (103) | `SemiProductForm.tsx` (289) | Medium: recipe versioning, ingredient rows | ~120 lines |
| 4G | Production | `production.ts` (83) | `ProductionForm.tsx` (232) | Medium: multi-entity creation | ~80 lines |
| 4H | Purchase Orders | `purchase-orders.ts` (156) | `PurchaseOrderForm.tsx` (427) | High: financial calculations, landed cost | ~100 lines |
| 4I | Promotions | `promotions.ts` (55) | `PromotionForm.tsx` (497) | High: externally controlled modal, complex UI | ~80 lines |
| 4J | Reports | `reports.ts` (339) + `stock.ts` (116) | 4 chart/filter components | Medium: analytics, no CRUD | ~50 lines |
| 4K | Orders | `orders.ts` (91) + `order-edit.ts` (233) | Already colocated | Low: move actions only | ~30 lines |
| 4L | Fix legacy issues | `auth.ts`, `pos.ts`, `index.ts` | N/A | Medium: auth rewrite, collision fix, shared helpers | N/A |

### Rollout Template (Apply to Each Phase)

Each phase follows these exact steps:

1. **Create feature `components/` directory** (if not exists)
2. **Move action file** to `app/admin/[feature]/actions.ts`
3. **Refactor action** using `shared-actions.ts` utilities where applicable
4. **Move form component(s)** to `app/admin/[feature]/components/`
5. **Refactor form** to use `FormModal`, `LoadingButton`, `DeleteConfirmModal`
6. **Replace `any`** with proper `types/db.ts` interfaces
7. **Update imports** in the feature's `page.tsx`
8. **Verify TypeScript** compiles (`rtk tsc`)
9. **Run validation gate** (TypeScript + dev server + feature CRUD + other pages)
10. **Delete old files**
11. **Commit**

**Between each phase:** Run full validation gate. Do not roll forward with broken state.

### Phase 4A Specifics: Suppliers

Key challenge: `SupplierForm.tsx` has THREE exports (`SupplierForm`, `SupplierModal`, `DeleteSupplierButton`).
- `SupplierModal` is a variant of `SupplierForm` used by `PurchaseOrderForm` for inline creation
- After refactoring, `SupplierModal` can be removed: `PurchaseOrderForm` can import `SupplierForm` directly
- `DeleteSupplierButton` uses a custom styled delete modal -- replace with `DeleteConfirmModal`
- `SupplierForm` uses `isEdit = !!initialData` pattern already -- just needs FormModal + LoadingButton

### Phase 4C Specifics: Inventory

Key challenge: `InventoryForms.tsx` is 604 lines with 5 exported components.
- `ActionGroup` already abstracts delete confirmation -- replace with `DeleteConfirmModal`
- The file should be SPLIT into separate files per entity: `ItemCategoryForm.tsx`, `BaseIngredientForm.tsx`, `PurchasedItemForm.tsx`, `ConversionForm.tsx`
- Each goes into its own sub-route directory under `app/admin/inventory/`

### Phase 4E Specifics: Products (Main)

Key challenge: `ProductForm.tsx` (310 lines) has complex nested variants with ingredient arrays.
- The ingredient row pattern should be extracted into a shared `IngredientRow` component
- This same pattern is used by `SemiProductForm` and `ModifierForm`
- Plan: extract `IngredientRow` into `components/ui/IngredientRow.tsx` during Phase 4E or 4F

### Phase 4L Specifics: Fix Legacy Issues

1. **`auth.ts`**: Rewrite to use `sheets_db` instead of raw `@/lib/sheets`. Migrate SHA-256 hashing to bcrypt (consistent with `users.ts`).
2. **`pos.ts`**: Extract duplicated `getIngredientUnitCost` helper to `lib/shared-actions.ts`. Remove dynamic `require()`.
3. **`order-edit.ts`**: Extract duplicated `getIngredientUnitCost` and `findRecipeAtTime` to `lib/shared-actions.ts`. Extract duplicated stock deduction logic (~90 lines) to a shared `computeStockDeduction` function.
4. **`reports.ts`**: Add error handling (try/catch). Extract duplicated `findRecipeAtTime` to `lib/shared-actions.ts`.
5. **`index.ts`**: Evaluate if still needed. If `createOrder` and `syncOrders` are replaced by `pos.ts:submitOrder`, the entire file can be deleted.

---

## Part 5: What NOT to Do

1. **Do not refactor business-logic-heavy actions** (`pos.ts:submitOrder`, `order-edit.ts:editOrder`, `products.ts:saveProduct`, `purchase-orders.ts`, `production.ts`, `reports.ts`). Move them to feature directories, but do not attempt to abstract their internals. The custom logic is too unique.

2. **Do not change the database layer** (`lib/sheets_db.ts`). It already provides the correct abstraction. The refactoring targets the boilerplate AROUND it, not the library itself.

3. **Do not change page-level data fetching patterns.** All server pages use `findAll` from `sheets_db`. This is correct and consistent. Leave it.

4. **Do not touch `POSScreen.tsx`** (1,056 lines). It is a massive self-contained component. Refactoring it is a separate project.

5. **Do not change routing.** All `/admin/*` routes stay the same. We are only moving where the code lives, not the URL structure.

6. **Do not refactor and add features simultaneously.** Each commit should be purely structural. No new functionality during the refactoring.

7. **Do not touch `lib/report-utils.ts`** -- it is already correctly factored out and used by `reports.ts`.

---

## Part 6: Expected Outcomes

### Before (Current State)

| Metric | Value |
|--------|-------|
| `components/` files | 22 files, flat, no organization |
| `app/actions/` files | 17 files, flat, no organization |
| Total form code | ~3,455 lines across 12 files |
| Total action code | ~2,423 lines across 17 files |
| Duplicated modal code | ~557 lines |
| Duplicated CRUD boilerplate | ~645 lines |
| `any` types | ~50+ occurrences across forms and pages |
| Shared UI components | 0 |

### After (Target State)

| Metric | Value |
|--------|-------|
| `components/` files | 6 shared files + `ui/` subfolder with 3 primitives |
| Feature-local components | 12+ components moved to their feature directory |
| `app/actions/` | Empty or removed (actions live in feature directories) |
| Estimated line savings | ~800 lines (forms) + ~400 lines (actions) = ~1,200 lines total |
| `any` types | Near zero (replaced with `types/db.ts` interfaces) |
| Shared UI components | 3 (`FormModal`, `DeleteConfirmModal`, `LoadingButton`) |
| Shared action utilities | 1 (`lib/shared-actions.ts` with CRUD helpers) |
| Bug fixes along the way | `index.ts` name collision, `auth.ts` inconsistency, `reports.ts` error handling, colSpan bug |

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Broken imports after file moves | Grep for every old path before deleting originals (Step 7.1) |
| TypeScript errors from new types | Define interfaces incrementally, feature by feature |
| Runtime differences from FormModal | Visual comparison before/after for each refactored form |
| CRUD factory edge cases | Brands PoC validates the factory before wider rollout |
| Merge conflicts with parallel work | Each feature is independent -- can merge sequentially |

---

## Appendix A: Complete File Manifest

### Files to Create (Phase 1-2: Brands PoC)

| File | Type | Lines (est.) | Task |
|------|------|-------------|------|
| `components/ui/FormModal.tsx` | New shared component | ~55 | Task 1 |
| `components/ui/LoadingButton.tsx` | New shared component | ~40 | Task 1 |
| `components/ui/DeleteConfirmModal.tsx` | New shared component | ~65 | Task 1 |
| `lib/shared-actions.ts` | New shared utility | ~75 | Task 3 |
| `app/admin/brands/actions.ts` | Move + refactor | ~35 | Task 4 |
| `app/admin/brands/components/BrandForm.tsx` | Move + refactor | ~155 | Task 5 |

### Files to Modify (Phase 1-2: Brands PoC)

| File | Change | Task |
|------|--------|------|
| `types/db.ts` | Fix DBBrand, add 15 new interfaces | Task 2 |
| `app/admin/brands/page.tsx` | Update imports, fix types, fix colSpan | Task 6 |

### Files to Delete (Phase 1-2: Brands PoC)

| File | Reason | Task |
|------|--------|------|
| `app/actions/brands.ts` | Moved to `app/admin/brands/actions.ts` | Task 7 |
| `components/BrandForm.tsx` | Moved to `app/admin/brands/components/BrandForm.tsx` | Task 7 |
