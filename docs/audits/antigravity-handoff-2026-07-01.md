# Handoff from Antigravity to Codex (2026-07-01)

## Context
During a live debugging session with the user on 2026-07-01, several critical bug fixes were deployed to address data issues, cost miscalculations, and database constraint violations. Because Antigravity operates under UI/Frontend boundaries, these changes involving `batch_yield` logic and constraint compliance require Codex's review as the Engine/Data owner.

## Changes Requiring Codex Review

### 1. MAC / Unit Cost Calculations (`app/admin/products/page.tsx` & `app/admin/reports/cogs-estimate/page.tsx`)
- **Issue**: Semi-product costs and overall recipe costs were severely inflated (e.g., Caramel sauce showing 99M VND).
- **Root Cause**: `batch_yield` (the total volume produced by a batch) was either ignored or replaced by `yield_quantity` (a unit ratio). Since `batch_yield` wasn't correctly resolved to the denominator, total costs were divided by 1 instead of the batch yield (e.g., 1000 ml).
- **Fix Applied**: 
  - Updated `SemiProduct` interface to explicitly map `batch_yield`.
  - Enforced `batch_yield` as the exact divisor for calculating unit cost of a semi-product batch. 
  - Patched both the Products dashboard (`app/admin/products/page.tsx`) and the COGS estimate tool (`app/admin/reports/cogs-estimate/page.tsx`) to strictly use `batch_yield`.
- **Codex Action Needed**: Review the mathematical correctness of using `batch_yield` in `cogs-estimate` and `products/page.tsx`. Verify this aligns with the canonical engine logic in `lib/mac-cogs.ts`.

### 2. Invalid Promotions Constraint (`app/admin/promotions/components/PromotionForm.tsx`)
- **Issue**: Saving/updating a promotion with a flat cash discount resulted in: `violates check constraint "promotions_discount_type_check"`.
- **Root Cause**: The React form's `<select>` option for flat cash discounts used `value="VND"`. The `0001_init_schema.sql` database check constraint strictly enforces `('PERCENT', 'FLAT_PRICE', 'FLAT_VND')`.
- **Fix Applied**: Replaced `<option value="VND">` with `<option value="FLAT_VND">` in `PromotionForm.tsx`.
- **Codex Action Needed**: Verify that `FLAT_VND` is the intended internal representation across the engine and that `POSScreen.tsx` properly defaults/falls-through to handle `FLAT_VND`.

### 3. Recipe Data Corruption (PO-047, PO-048, "Cà phê caramel kem muối")
- **Issue**: The user reported duplicate products and corrupted PO displays.
- **Root Cause**: Invalid data arrays were written into JSON structures causing the components to crash or misrender.
- **Fix Applied**: Cleaned up the specific corrupted recipe mappings.
- **Codex Action Needed**: None specifically required, but keep an eye out for missing `batch_yield` properties causing `NaN` propagation in POs.

## Commits Made
- `c54e801` Antigravity fix: Use FLAT_VND instead of VND for discount_type to pass DB constraint
- (Various local edits patched dynamically during live session)

## Request
Codex, please review the engine implications of the `batch_yield` fixes and constraint alignments, and append your findings or secondary fixes to the tracking document.
