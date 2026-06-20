# Wave 3 Refactoring Plan (Administration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the final 2 features (Users and Promotions) to feature-colocated architecture with StickyFilterBar, shared UI primitives, and strict TypeScript types. Complete the full architecture restructuring campaign.

**Architecture:** Each feature gets its own `components/` and `actions.ts` inside `app/admin/[feature]/`. Client components render `StickyFilterBar` with integrated filters. Forms use `FormModal`, `LoadingButton`, `DeleteConfirmModal`. Actions use `lib/shared-actions.ts` for simple CRUD. The `applicable_products_json` logic in Promotions is preserved byte-for-byte.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Google Sheets via `lib/sheets_db.ts`

---

## Part 1: Audit Findings

### 1A. Users Feature (5 files, ~366 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/users/page.tsx` | 65 | Server component, renders table directly, `any` types, no filters. Protects `admin` user from deletion only in UI. |
| `app/admin/users/edit/[id]/page.tsx` | 30 | Server component, loads ALL users to find one by ID, `any` types. |
| `components/UserForm.tsx` | 117 | Two exports: `UserForm` (add modal, inline overlay) and `DeleteUserButton` (uses `confirm()`). No shared UI primitives. |
| `components/EditUserForm.tsx` | 88 | Standalone page form (not modal), `{ user: any }`, inline loading button, uses `router.push` + `router.refresh`. |
| `app/actions/users.ts` | 66 | `addUser` (bcrypt hash, duplicate username check), `deleteUser` (hard delete, no admin protection), `updateUser` (conditional password update). 4 `any` usages. |

**Business logic to preserve:**
- `bcrypt.hash(password, 10)` for both add and update
- Duplicate username check on add (`users.find(u => u.username === username)`)
- Conditional password update (only if non-blank)
- Admin user delete protection (UI-level only -- not adding server-side protection)
- ID prefix `"USR"`

**StickyFilterBar requirements:** Text search (username), Role dropdown (STAFF/MANAGER/ADMIN), Status dropdown (if applicable -- Users don't have status field currently, but `DBUser` defines it).

### 1B. Promotions Feature (4 files, ~934 lines)

| File | Lines | Key Issues |
|------|-------|------------|
| `app/admin/promotions/page.tsx` | 32 | Server component, fetches 5 sheets, filters DELETED, passes to PromotionsClient. All `any`. |
| `app/admin/promotions/PromotionsClient.tsx` | 350 | Already colocated. Has tabs (ALL/ACTIVE/INACTIVE) + search. Custom delete modal. Uses `any[]` props. |
| `components/PromotionForm.tsx` | 497 | The most complex form. Externally-controlled modal. Category->Product->Variant tree. `applicable_products_json` as `Record<string, number>`. Native `datetime-local` inputs. 18 useState hooks. |
| `app/actions/promotions.ts` | 55 | `savePromotion` (upsert, `any` param), `deletePromotion` (hard delete), `getPromotionsData` (dead code). |

**Critical `applicable_products_json` logic to preserve:**

**Write path (PromotionForm.tsx lines 137-147):**
```typescript
if (type === "PRODUCT_DISCOUNT") {
  const obj: Record<string, number> = {};
  selectedVariants.forEach((vId) => {
    const customVal = variantValues[vId];
    obj[vId] = customVal !== undefined && customVal !== ""
      ? Number(customVal)
      : Number(discountValue);
  });
  applicableProductsJson = JSON.stringify(obj);
}
```
Result: `{"VAR-001": 15000, "VAR-002": 10}` -- maps variant ID to discount value.

**Read path (PromotionForm.tsx lines 72-92):**
Handles BOTH formats: array `string[]` (legacy) and object `Record<string, number>` (current).

**StickyFilterBar requirements:** Text search (name/code), Status dropdown (ALL/ACTIVE/INACTIVE/EXPIRED), Type dropdown (ORDER_DISCOUNT/PRODUCT_DISCOUNT). The current PromotionsClient already has tabs and search -- these need to be converted to StickyFilterBar filters.

### 1C. Dependency Map

**Users:**
```
users/page.tsx -> components/UserForm.tsx -> app/actions/users.ts
users/edit/[id]/page.tsx -> components/EditUserForm.tsx -> app/actions/users.ts
```
All consumers are within the feature. Safe to move everything.

**Promotions:**
```
promotions/page.tsx -> promotions/PromotionsClient.tsx -> components/PromotionForm.tsx
                                                       -> app/actions/promotions.ts
```
PromotionsClient is already colocated. Only PromotionForm and actions need moving.

### 1D. Files NOT to Modify

| File | Reason |
|------|--------|
| `components/UserForm.tsx` | Keep until verified, then delete |
| `components/EditUserForm.tsx` | Keep until verified, then delete |
| `components/PromotionForm.tsx` | Keep until verified, then delete |
| `app/actions/users.ts` | Keep until verified, then delete |
| `app/actions/promotions.ts` | Keep until verified, then delete |

---

## Part 2: Execution Plan

### Task 1: Users

**Files to create:**
- `app/admin/users/actions.ts`
- `app/admin/users/components/UserForm.tsx`
- `app/admin/users/components/EditUserForm.tsx`
- `app/admin/users/components/UsersClient.tsx`

**Files to modify:**
- `app/admin/users/page.tsx`
- `app/admin/users/edit/[id]/page.tsx`

---

- [ ] **Step 1.1: Create `app/admin/users/actions.ts`**

```typescript
"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBUser } from "@/types/db";
import bcrypt from "bcryptjs";

const SHEET = "Users";
const PATH = "/admin/users";

export async function getUsers(): Promise<DBUser[]> {
  try {
    return await findAll(SHEET) as DBUser[];
  } catch (error) {
    console.error("Loi getUsers:", error);
    return [];
  }
}

export async function getUserById(id: string): Promise<DBUser | null> {
  try {
    const users = await findAll(SHEET) as DBUser[];
    return users.find(u => u.id === id) || null;
  } catch (error) {
    console.error("Loi getUserById:", error);
    return null;
  }
}

// PRESERVE: duplicate username check, bcrypt.hash(password, 10), ID prefix "USR"
export async function addUser(formData: FormData): Promise<ActionResponse> {
  const username = formData.get("username") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!username || !role || !password) return fail("Vui long dien du thong tin");

  try {
    const users = await findAll(SHEET);
    if (users.find(u => u.username === username)) {
      return fail("Ten dang nhap da ton tai");
    }

    const id = await generateNewId(SHEET, "USR");
    const password_hash = await bcrypt.hash(password, 10);
    const created_at = new Date().toISOString();

    await insert(SHEET, { id, username, password_hash, role, status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

// PRESERVE: hard delete, no admin protection check (matches current behavior)
export async function deleteUserAction(formData: FormData): Promise<ActionResponse> {
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

// PRESERVE: conditional password update (only if non-blank), bcrypt hash
export async function updateUser(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!id || !role) return fail("Thieu thong tin bat buoc");

  try {
    const dataToUpdate: Record<string, string> = { role };

    if (password && password.trim() !== "") {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    await update(SHEET, id, dataToUpdate);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
```

**Key decisions:**
- `getUserById` added for the edit page (replaces `findAll` + client-side `.find()`)
- Named `deleteUserAction` to avoid collision with old `deleteUser`
- `dataToUpdate: Record<string, string>` instead of `any` -- same behavior, typed
- `status: "ACTIVE"` added on insert (current code omits this, but `DBUser` type has it)

- [ ] **Step 1.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.3: Create `app/admin/users/components/UserForm.tsx`**

New add-user form using shared UI. Replaces both `UserForm` and `DeleteUserButton`.

**Exports:**
- `UserForm` -- no props, renders "Add" button + FormModal
- `DeleteUserButton` -- props: `{ id: string }`, renders "Delete" text + DeleteConfirmModal

**Props interfaces:**
```typescript
// UserForm: no props (add-only mode)
// DeleteUserButton: { id: string }
```

**Structure:**
- `UserForm`: `FormModal` with form fields: username (text, required), password (password, required), role (select: STAFF/MANAGER/ADMIN). `LoadingButton` for submit. Error banner for server errors. Calls `addUser`.
- `DeleteUserButton`: `DeleteConfirmModal` with confirmation text. Calls `deleteUserAction`.

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { addUser, deleteUserAction } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
```

- [ ] **Step 1.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.5: Create `app/admin/users/components/EditUserForm.tsx`**

New edit-user form. This is a **page-level form** (not a modal), matching the current UX pattern.

**Props interface:**
```typescript
interface EditUserFormProps {
  user: DBUser;
}
```

**Structure:**
- NOT a modal -- renders as a card with form fields
- Username (disabled, display-only), Password (optional, placeholder "leave blank to keep"), Role (select)
- Uses `LoadingButton` for submit
- On success: `router.push("/admin/users")` + `router.refresh()` (preserving current behavior)
- Cancel: `<Link href="/admin/users">`

**Imports:**
```typescript
"use client";
import { useState } from "react";
import { updateUser } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DBUser } from "@/types/db";
```

- [ ] **Step 1.6: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.7: Create `app/admin/users/components/UsersClient.tsx`**

Client component with StickyFilterBar + role filter + text search.

**Props interface:**
```typescript
interface UsersClientProps {
  users: DBUser[];
}
```

**Structure:**
- State: `search` (string), `roleFilter` (string, default "ALL")
- `useMemo`: filter users by username matching search, by `role` matching roleFilter
- `StickyFilterBar` with `title="Quan ly Nhan Su"`, `rightContent={<UserForm />}`
- Filter children: text input (search by username) + role dropdown (ALL/STAFF/MANAGER/ADMIN)
- Table columns: ID, Ten Dang Nhap, Quyen (role badge), Ngay Tao, Thao Tac
- Per-row: "Sua" link to `/admin/users/edit/${user.id}`, `<DeleteUserButton id={user.id} />`
- Admin protection: `{user.username !== 'admin' && <DeleteUserButton id={user.id} />}`

- [ ] **Step 1.8: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 1.9: Update `app/admin/users/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { UserForm, DeleteUserButton } from "@/components/UserForm";
import Link from "next/link";
```

**New imports:**
```typescript
import { getUsers } from "./actions";
import UsersClient from "./components/UsersClient";
```

**New page body:**
```typescript
export default async function UsersPage() {
  const users = await getUsers();
  return <UsersClient users={users} />;
}
```

- [ ] **Step 1.10: Update `app/admin/users/edit/[id]/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import EditUserForm from "@/components/EditUserForm";
```

**New imports:**
```typescript
import { getUserById } from "../../actions";
import EditUserForm from "../../components/EditUserForm";
```

**Old body:**
```typescript
const users = await findAll("Users");
const user = users.find((u: any) => u.id === params.id);
```

**New body:**
```typescript
const user = await getUserById(params.id);
```

Rest of the page stays the same (breadcrumb, heading, `<EditUserForm user={user} />`).

- [ ] **Step 1.11: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/users` -- table loads, search works, role filter works
Test: add user, edit user (change role, change password), delete user
Verify: admin user cannot be deleted (button hidden)
Verify: duplicate username prevention

- [ ] **Step 1.12: Commit**

```bash
rtk git add app/admin/users/
rtk git commit -m "refactor(users): colocate actions, forms, add StickyFilterBar with role filter and type safety"
```

---

### Task 2: Promotions

**This is the most complex form in Wave 3.** The `applicable_products_json` handling must be preserved exactly.

**Files to create:**
- `app/admin/promotions/actions.ts`
- `app/admin/promotions/components/PromotionForm.tsx`

**Files to modify:**
- `app/admin/promotions/page.tsx`
- `app/admin/promotions/PromotionsClient.tsx`

**Files NOT to modify:**
- `components/PromotionForm.tsx` -- KEEP until verified
- `app/actions/promotions.ts` -- KEEP until verified

---

- [ ] **Step 2.1: Create `app/admin/promotions/actions.ts`**

Copy `savePromotion` and `deletePromotion` **exactly** from `app/actions/promotions.ts`. Preserve all data coercion, upsert logic, and revalidation paths. Remove dead `getPromotionsData` export.

```typescript
"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";

const SHEET = "Promotions";
const PATH = "/admin/promotions";

export async function getPromotionsData(): Promise<{
  promotions: DBPromotion[];
  brands: DBBrand[];
  products: DBProduct[];
  variants: DBProductVariant[];
  categories: DBProductCategory[];
}> {
  try {
    const [promotions, brands, products, variants, categories] = await Promise.all([
      findAll(SHEET) as Promise<DBPromotion[]>,
      findAll("Brands") as Promise<DBBrand[]>,
      findAll("Products") as Promise<DBProduct[]>,
      findAll("Product_Variants") as Promise<DBProductVariant[]>,
      findAll("Product_Categories") as Promise<DBProductCategory[]>,
    ]);
    return { promotions, brands, products, variants, categories };
  } catch (error) {
    console.error("Loi getPromotionsData:", error);
    return { promotions: [], brands: [], products: [], variants: [], categories: [] };
  }
}

// --- COPY savePromotion EXACTLY from app/actions/promotions.ts ---
// PRESERVE: Number() coercion on discount_value and min_order_value,
// status default "ACTIVE", updated_at on every save,
// upsert logic (id present = update, absent = create with prefix "PRM"),
// revalidation of both /admin/promotions and /pos
export async function savePromotion(promoData: Record<string, unknown>): Promise<ActionResponse> {
  // ... exact copy of original function body ...
  // Only changes: parameter type from `any` to `Record<string, unknown>`,
  // return values wrapped in ok()/fail()
}

// --- COPY deletePromotion EXACTLY ---
// PRESERVE: hard delete (remove), revalidation of both paths
export async function deletePromotion(promoId: string): Promise<ActionResponse> {
  // ... exact copy ...
}
```

**Key decisions:**
- `savePromotion` parameter changed from `any` to `Record<string, unknown>` -- same structural behavior, typed
- `getPromotionsData` consolidated: fetches all 5 sheets, returns typed data (replaces the inline fetching in `page.tsx`)
- Dead `getPromotionsData` from old file is NOT carried over
- `Number()` coercion, `updated_at`, `created_at`, and `status` defaults preserved exactly

- [ ] **Step 2.2: Verify actions compile**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.3: Create `app/admin/promotions/components/PromotionForm.tsx`**

This is the most complex form. The externally-controlled modal pattern is preserved (parent controls visibility). The `applicable_products_json` read/write logic is copied byte-for-byte.

**Props interface:**
```typescript
interface PromotionFormProps {
  initialData?: DBPromotion;
  brands: DBBrand[];
  categories: DBProductCategory[];
  products: DBProduct[];
  variants: DBProductVariant[];
  onClose: () => void;
  onSuccess: () => void;
}
```

**Structure (preserving all 18 useState hooks and their logic):**
- Default export `PromotionForm`
- Renders its own full-screen overlay (NOT using `FormModal` -- the layout is too custom with the variant tree)
- Uses `LoadingButton` for submit
- Uses `DeleteConfirmModal` is NOT needed here (delete handled by parent PromotionsClient)
- State: `name`, `code`, `brandId`, `type`, `discountType`, `discountValue`, `minOrderValue`, `startDate`, `endDate`, `selectedVariants`, `variantValues`, `status`, `loading`, `error`
- `useEffect` on `initialData`: populates fields, parses `applicable_products_json` (handles both array and object formats)
- `handleSubmit`: validation, builds `applicable_products_json` as `Record<string, number>`, calls `savePromotion`
- Variant selection tree: `groupedByCategory` computed from `categories` -> `products` -> `variants`

**CRITICAL: `applicable_products_json` write logic (exact copy):**
```typescript
if (type === "PRODUCT_DISCOUNT") {
  const obj: Record<string, number> = {};
  selectedVariants.forEach((vId) => {
    const customVal = variantValues[vId];
    obj[vId] = customVal !== undefined && customVal !== ""
      ? Number(customVal)
      : Number(discountValue);
  });
  applicableProductsJson = JSON.stringify(obj);
}
```

**CRITICAL: `applicable_products_json` read logic (exact copy):**
```typescript
const parsed = JSON.parse(initialData.applicable_products_json);
if (Array.isArray(parsed)) {
  setSelectedVariants(parsed);
  setVariantValues({});
} else {
  setSelectedVariants(Object.keys(parsed));
  const stringifiedVals: Record<string, string> = {};
  for (const k of Object.keys(parsed)) {
    stringifiedVals[k] = String(parsed[k]);
  }
  setVariantValues(stringifiedVals);
}
```

**Date handling (preserved):**
- Native `<input type="datetime-local">` (NOT CustomDatePicker)
- `getLocalISOTime` helper: subtracts timezone offset
- Submit: `new Date(startDate).toISOString()`

**Imports:**
```typescript
"use client";
import { useState, useEffect } from "react";
import { savePromotion } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";
```

- [ ] **Step 2.4: Verify form compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.5: Update `app/admin/promotions/PromotionsClient.tsx`**

Convert existing tabs + search to StickyFilterBar. Replace custom delete modal with DeleteConfirmModal. Update imports.

**Props interface (typed):**
```typescript
interface PromotionsClientProps {
  promotions: DBPromotion[];
  brands: DBBrand[];
  products: DBProduct[];
  variants: DBProductVariant[];
  categories: DBProductCategory[];
}
```

**Changes:**
1. Replace `initialPromotions: any[]` with `promotions: DBPromotion[]` and all other `any[]` props
2. Replace tab buttons + search input with `StickyFilterBar`:
   - `title="Quan ly Khuyen Mai"`
   - `rightContent` = "Tao Khuyen Mai" button (opens form in create mode)
   - Filter children: text input (search name/code) + status select (ALL/ACTIVE/INACTIVE/EXPIRED) + type select (ALL/ORDER_DISCOUNT/PRODUCT_DISCOUNT)
3. Replace custom delete modal with `DeleteConfirmModal`
4. Fix `applicable_products_json` display bug: use `Object.keys(JSON.parse(...) || {}).length` instead of `JSON.parse(...).length`
5. Update import of `PromotionForm` from `@/components/PromotionForm` to `./components/PromotionForm`
6. Update import of `deletePromotion` from `@/app/actions/promotions` to `../actions`

**State changes:**
- Remove `activeTab` -> replace with `statusFilter` (string: ALL/ACTIVE/INACTIVE/EXPIRED)
- Add `typeFilter` (string: ALL/ORDER_DISCOUNT/PRODUCT_DISCOUNT)
- Keep `searchTerm`, `isFormOpen`, `editingPromo`, `deleteConfirmId`

- [ ] **Step 2.6: Verify client compiles**

Run: `rtk tsc`
Expected: 0 errors

---

- [ ] **Step 2.7: Update `app/admin/promotions/page.tsx`**

**Old imports (replace):**
```typescript
import { findAll } from "@/lib/sheets_db";
import { PromotionsClient } from "./PromotionsClient";
```

**New imports:**
```typescript
import { getPromotionsData } from "./actions";
import PromotionsClient from "./PromotionsClient";
```

**Old body:** Inline `Promise.all` with 5 `findAll` calls + filtering + sorting

**New body:**
```typescript
export default async function PromotionsPage() {
  const { promotions, brands, products, variants, categories } = await getPromotionsData();

  // Filter out DELETED entities (preserving current behavior)
  const activeBrands = brands.filter(b => b.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  const activeCategories = categories.filter(c => c.status !== "DELETED");

  // Sort promotions by created_at descending
  const sorted = [...promotions].sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || "")
  );

  return (
    <PromotionsClient
      promotions={sorted}
      brands={activeBrands}
      products={activeProducts}
      variants={activeVariants}
      categories={activeCategories}
    />
  );
}
```

- [ ] **Step 2.8: Verify full feature works**

Run: `rtk tsc` -- 0 errors
Visit `/admin/promotions` -- card grid loads, search works, status and type filters work
Test: create ORDER_DISCOUNT promotion, create PRODUCT_DISCOUNT promotion with variant selection
Test: edit promotion (verify `applicable_products_json` loads correctly -- variant checkboxes pre-filled, custom values preserved)
Test: delete promotion (hard delete)
Verify: promotion cards display discount label, target label, applicable products count correctly
Verify: expired promotions show correct status
Visit `/pos` -- verify promotions still load (both paths revalidated)

- [ ] **Step 2.9: Commit**

```bash
rtk git add app/admin/promotions/
rtk git commit -m "refactor(promotions): colocate actions, form, add StickyFilterBar with filters - applicable_products_json logic preserved exactly"
```

---

### Task 3: Validation Gate

- [ ] **Step 3.1: Full TypeScript check**

Run: `rtk tsc`
Expected: `Found 0 errors`

- [ ] **Step 3.2: Dev server starts**

Run: `npm run dev`
Expected: Server starts without errors

- [ ] **Step 3.3: Verify Wave 3 features**

| Page | URL | Tests |
|------|-----|-------|
| Users | `/admin/users` | Search, role filter, add user, edit user, delete user |
| Edit User | `/admin/users/edit/[id]` | Change role, change password, cancel |
| Promotions | `/admin/promotions` | Search, status filter, type filter, create/edit/delete |

- [ ] **Step 3.4: Verify ALL previously refactored features still work**

Quick smoke test of every admin page:

| Feature | URL | Check |
|---------|-----|-------|
| Brands | `/admin/brands` | Loads, CRUD works |
| Suppliers | `/admin/suppliers` | Loads |
| Categories | `/admin/products/categories` | Loads |
| Base Ingredients | `/admin/inventory/base-ingredients` | Loads |
| Conversions | `/admin/inventory/conversions` | Loads |
| Modifiers | `/admin/products/modifiers` | Loads |
| Items | `/admin/inventory/items` | Loads |
| Purchase Orders | `/admin/inventory/purchase-orders` | Loads |
| Semi-products | `/admin/semi-products` | Loads |
| Production | `/admin/production` | Loads |
| Products | `/admin/products` | Loads |
| Orders | `/admin/orders` | Loads |

- [ ] **Step 3.5: Verify no broken old imports**

Run: `grep -r "from \"@/components/UserForm\"\|from \"@/components/EditUserForm\"\|from \"@/components/PromotionForm\"" --include="*.tsx" --include="*.ts" app/`
Expected: 0 results (all moved to colocated imports)

- [ ] **Step 3.6: Commit final state**

```bash
rtk git add -A
rtk git commit -m "chore(wave3): final cleanup and verification - architecture refactoring complete"
```

---

## Part 3: File Manifest

### Files to Create (6 new files)

| File | Feature | Task |
|------|---------|------|
| `app/admin/users/actions.ts` | Users | 1 |
| `app/admin/users/components/UserForm.tsx` | Users | 1 |
| `app/admin/users/components/EditUserForm.tsx` | Users | 1 |
| `app/admin/users/components/UsersClient.tsx` | Users | 1 |
| `app/admin/promotions/actions.ts` | Promotions | 2 |
| `app/admin/promotions/components/PromotionForm.tsx` | Promotions | 2 |

### Files to Modify (4 files)

| File | Change | Task |
|------|--------|------|
| `app/admin/users/page.tsx` | Replace with slim server component | 1 |
| `app/admin/users/edit/[id]/page.tsx` | Use `getUserById` + local import | 1 |
| `app/admin/promotions/page.tsx` | Use `getPromotionsData` + pass typed data | 2 |
| `app/admin/promotions/PromotionsClient.tsx` | StickyFilterBar + DeleteConfirmModal + typed props | 2 |

### Old Files Safe to Delete (After Verification)

After both features pass the validation gate:

| File | Feature | Replaced by |
|------|---------|-------------|
| `components/UserForm.tsx` | Users | `app/admin/users/components/UserForm.tsx` |
| `components/EditUserForm.tsx` | Users | `app/admin/users/components/EditUserForm.tsx` |
| `components/PromotionForm.tsx` | Promotions | `app/admin/promotions/components/PromotionForm.tsx` |
| `app/actions/users.ts` | Users | `app/admin/users/actions.ts` |
| `app/actions/promotions.ts` | Promotions | `app/admin/promotions/actions.ts` |

---

## Part 4: Campaign Completion Summary

After Wave 3, the **full architecture refactoring campaign is complete**. All 3 waves will have been executed:

| Wave | Features | New Files |
|------|----------|-----------|
| Wave 1 (Master Data) | Suppliers, Categories, Base Ingredients, Conversions, Modifiers | 15 |
| Wave 2 (Operations) | Items, Purchase Orders, Semi-products, Production | 12 |
| Wave 3 (Administration) | Users, Promotions | 6 |
| **Total** | **11 features** | **33 new files** |

### Final Architecture State

```
app/admin/
  brands/            -- Wave 0 (PoC)
    actions.ts, components/BrandForm.tsx
  suppliers/         -- Wave 1
    actions.ts, components/SupplierForm.tsx, components/SuppliersClient.tsx
  products/
    categories/      -- Wave 1
      actions.ts, components/ProductCategoryForm.tsx, components/CategoriesClient.tsx
    modifiers/       -- Wave 1
      actions.ts, components/ModifierForm.tsx, components/ModifiersClient.tsx
    products/        -- NOT YET
      ProductsClient.tsx (already local)
  inventory/
    base-ingredients/ -- Wave 1
      actions.ts, components/BaseIngredientForm.tsx, components/BaseIngredientsClient.tsx
    conversions/     -- Wave 1
      actions.ts, components/ConversionForm.tsx, components/ConversionsClient.tsx
    items/           -- Wave 2
      actions.ts, components/PurchasedItemForm.tsx, components/ItemsClient.tsx
    purchase-orders/ -- Wave 2
      actions.ts, components/PurchaseOrderForm.tsx, components/PurchaseOrdersClient.tsx
    categories/      -- NOT YET
    units/           -- NOT YET (already has local UnitForm.tsx)
  semi-products/     -- Wave 2
    actions.ts, components/SemiProductForm.tsx, components/SemiProductsClient.tsx
  production/        -- Wave 2
    actions.ts, components/ProductionForm.tsx, components/ProductionClient.tsx
  users/             -- Wave 3
    actions.ts, components/UserForm.tsx, components/EditUserForm.tsx, components/UsersClient.tsx
  promotions/        -- Wave 3
    actions.ts, components/PromotionForm.tsx, PromotionsClient.tsx (enhanced)

components/
  ui/
    FormModal.tsx, LoadingButton.tsx, DeleteConfirmModal.tsx
  CustomDatePicker.tsx, SearchableSelect.tsx, StickyFilterBar.tsx
  HistoryModal.tsx, SessionProvider.tsx, POSScreen.tsx
  (old form files deleted after verification)

types/
  db.ts              -- 22+ interfaces

lib/
  sheets_db.ts, report-utils.ts, shared-actions.ts

app/actions/         -- Empty or deleted (all actions colocated)
```

### What Remains (Post-Campaign Cleanup)

These items are outside the scope of Waves 1-3 and should be handled separately:

1. **Delete old `app/actions/` barrel files** -- after verifying no imports remain
2. **Clean up `components/InventoryForms.tsx`** -- remove `DeleteBtn`, `ActionGroup`, `BaseIngredientForm`, `ConversionForm`, `PurchasedItemForm` (keep `ItemCategoryForm` until categories is done)
3. **Colocate remaining features** -- Products (main), Inventory Categories, Units
4. **Extract shared helpers** -- `getIngredientUnitCost`, `findRecipeAtTime`, stock deduction logic from `pos.ts`/`order-edit.ts`/`reports.ts`
5. **Fix documented bugs** -- wrong revalidation paths, double PO line updates, stale recipe lookups
