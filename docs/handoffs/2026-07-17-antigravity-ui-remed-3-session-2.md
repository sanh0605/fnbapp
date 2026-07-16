# Task: UI-REMED-3 Session 2 — Bulk Migrate Native alert()/confirm() to Dialog API

## Context

Session 1 (`commit dd51dae`) shipped the imperative Dialog API (`lib/dialog.ts`) + `Dialog` component + `DialogHost` mount + 2 proof-of-concept migrations in `app/admin/inventory/sync/page.tsx`. API verified working.

Session 2: migrate the remaining ~52 native `alert()` / `confirm()` call sites across 18 source files. Mechanical work using the proven API.

## Migration pattern

### Before → After

```tsx
// BEFORE
import React from "react";

function handleSubmit() {
  if (!name) {
    alert("Vui lòng nhập tên");
    return;
  }
  if (confirm("Lưu thay đổi?")) {
    save();
  }
}

// AFTER
import React from "react";
import { alert, confirm } from "@/lib/dialog";

async function handleSubmit() {
  if (!name) {
    await alert({ title: "Thiếu thông tin", message: "Vui lòng nhập tên.", variant: "warning" });
    return;
  }
  if (await confirm({ title: "Xác nhận lưu", message: "Lưu thay đổi?" })) {
    save();
  }
}
```

### Rules

1. **Import**: add `import { alert, confirm } from "@/lib/dialog"` at top of file (merge with existing imports).
2. **Async**: function containing the call MUST be `async`. Add `async` keyword if missing.
3. **`alert()` migration**:
   - `alert("X")` → `await alert({ message: "X" })` (minimal)
   - Add `title` if context suggests category (validation error, success, etc.)
   - Add `variant: "warning" | "danger" | "info"` based on intent:
     - Validation error → `variant: "warning"`
     - Critical error / failure → `variant: "danger"`
     - Success / info → `variant: "info"` (or omit, default)
4. **`confirm()` migration**:
   - `confirm("X?")` → `await confirm({ message: "X?" })` (minimal)
   - For delete/destructive: `await confirm({ title: "Xác nhận xóa", message: "...", variant: "danger" })`
   - For save/action: default `variant: "warning"` is fine
5. **String concatenation**: preserve existing message text. If message uses template literals (`${var}`), keep as-is.
6. **No behavior change**: replace ONLY the dialog mechanism. Do NOT refactor surrounding logic.

## Files to migrate (18 source files, ~52 call sites)

Per-file alert/confirm counts (from Phase 1 audit grep):

| File | Calls | Notes |
|---|---:|---|
| `components/PurchaseOrderForm.tsx` | 9 | Form validation + submit confirm |
| `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx` | 9 | (verify if duplicate of above or separate file) |
| `components/ProductionForm.tsx` | 5 | Form validation |
| `components/POSScreen.tsx` | 5 | Cart checkout flow — critical UX |
| `components/SemiProductForm.tsx` | 5 | Form validation |
| `components/ProductForm.tsx` | 4 | Form validation |
| `components/ModifierForm.tsx` | 3 | Form validation |
| `app/admin/inventory/stock-adjustments/components/StockAdjustmentsClient.tsx` | 2 | Has confirm() for delete |
| `app/admin/inventory/units/UnitForm.tsx` | 1 | Form validation |
| `components/InventoryForms.tsx` | 1 | |
| `components/pos/CartPanel.tsx` | 1 | Critical POS flow |
| `components/inventory/PurchasedItemForm.tsx` | 1 | |
| `components/inventory/ConversionForm.tsx` | 1 | |
| `components/UserForm.tsx` | 1 | |
| `components/inventory/BaseIngredientForm.tsx` | 1 | |
| `components/ProductCategoryForm.tsx` | 1 | |
| `components/ToppingsManager.tsx` | 1 | |
| `components/SupplierForm.tsx` | 1 | |

**Total: ~52 call sites** (54 from Phase 1 audit minus 2 already migrated in Session 1).

## Scope

### In scope

1. Migrate all 52 native `alert()` / `confirm()` calls to imperative API per pattern above.
2. For each file:
   - Add `import { alert, confirm } from "@/lib/dialog"` (if not already imported).
   - Make containing functions `async` where needed.
   - Replace calls per rules above.
   - Preserve all surrounding logic, validation, control flow.
3. Visual verify critical flows at desktop (1280px) AND mobile (375px):
   - POS checkout: add items to cart, click checkout, see confirmation dialog
   - Purchase Order submit: fill form, submit, see validation/success dialogs
   - Stock adjustment delete: click delete, see confirm dialog
   - Form validation errors: trigger validation, see error dialog
4. Ensure no remaining `\balert\(['\"]` or `\bconfirm\(['\"]` patterns in source (excluding strings/comments).

### Out of scope

- Do NOT change validation logic, error messages, or control flow.
- Do NOT refactor function signatures beyond making them `async`.
- Do NOT touch existing `FormModal` / `DeleteConfirmModal` components (they work for their use cases).
- Do NOT add new Dialog variants or extend `lib/dialog.ts` API.
- Do NOT migrate calls inside test files (those intentionally test the lib).
- Do NOT push to remote.

## Constraints

- **Behavior preservation**: every migration must keep identical user-facing behavior. Only the dialog UI changes.
- **Message text preservation**: do NOT rewrite validation messages, even for typos. Separate task.
- **Mobile-first**: visual verify at 375px for at least 3 critical flows (POS checkout, form submit, delete confirm).
- **No new dependencies**: use existing Dialog API.
- **Atomic commit**: all 18 files migrated in single commit (or split per concern if needed — but ideally atomic for "all alert/confirm migrated").
- **TS clean**: every migrated file must pass `tsc --noEmit`.
- **Tests pass**: existing 391+ tests must pass (no test files modified in this session).

## Verification

1. **Per-file**: `tsc --noEmit` clean after each file migration (incremental check).
2. **Final grep**: `rg "\balert\(['\"]|\bconfirm\(['\"]" app/ components/` should return ZERO matches in source (excluding strings/comments).
3. **Build**: `npm run build` success.
4. **Tests**: `vitest run` — baseline pass, no test files modified.
5. **Visual smoke (desktop + mobile)**:
   - `/pos` — add to cart, checkout
   - `/admin/inventory/purchase-orders` — new PO, fill form, submit
   - `/admin/inventory/stock-adjustments` — delete entry
   - `/admin/products` — new product, submit with empty name
6. **`git diff --check`**: clean.

## Expected output

- 18 modified source files.
- Commit: `Antigravity ui: migrate alert/confirm to Dialog API (UI-REMED-3 Session 2)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P1 — completes UI-REMED-3 saga. Antigravity pickup. ~1 session (mechanical work, ~3-4 hours).

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (High)` — bulk mechanical refactor across many files. High effort tier because volume + need to maintain correctness across async conversions.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Any file has `confirm()` call inside non-async callback that can't easily be made async (e.g., prop callback with strict signature). Flag for case-by-case decision.
- Any file has complex control flow where async migration would change behavior (race condition risk).
- Visual regression at 375px (dialog overflow, layout break).
- Existing tests fail after migration (would indicate behavior change).
- The 2 PurchaseOrderForm.tsx files (root components/ + app/admin/.../components/) are actually duplicates — flag for consolidation decision.

## Questions before starting

- For long validation messages with concatenation (`"X: " + err.message`), preserve exactly or use template literal? Recommend PRESERVE exactly (no refactor).
- For `confirm()` inside `onClick` props passed from parent: make the prop type async, or wrap with internal async function? Recommend WRAP internally (preserve prop signature).
- Group commits per file group (forms / POS / inventory) OR single atomic commit? Recommend ATOMIC for "all migrated" clarity.
