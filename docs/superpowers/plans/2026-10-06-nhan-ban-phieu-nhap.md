# Copy a purchase order (BR-INV-016) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Nhân bản" link on an order's page opens the new-order form already filled from that order. Nothing is written until "Lưu".

**Architecture:** A pure function turns a stored order and its lines into a seed. The seed applies the owner's rules:
- copy supplier, source, lines, prices, extra costs, notes and payment;
- keep the transaction time and invoice code only from a cancelled order.

The server function `getPurchaseOrderCopySeed` loads the order and returns the seed. The existing `/admin/inventory/purchase-orders/new` page reads `?copyFrom=<id>` and hands the seed to `PurchaseOrderForm` as its starting values; the form stays in "new order" mode. Saving goes through the unchanged `savePurchaseOrder`, so stock, cost, assets and the cash book behave exactly as for a typed order. No migration, no new route.

**Tech Stack:** Next.js App Router, TypeScript, Vitest.

**Spec:** `docs/02-rules/business-rules/purchasing.md` → `BR-INV-016` (owner 2026-10-05 *"1b"*, *"2 các phiếu huỷ thì lấy đúng thời điểm giao dịch của phiếu đó. Còn lại thì để trống"*, *"3a"*; 2026-10-06 *"1a 2a 3a"*). Changes an existing screen and adds no table or route, so the design lives here.

## Current state

Seen:
- `app/admin/inventory/purchase-orders/new/page.tsx`
- `app/admin/inventory/purchase-orders/[id]/page.tsx` (lines 1–90)
- `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx` (lines 1–300)
- `app/admin/inventory/purchase-orders/actions.ts` (`savePurchaseOrder` date handling)
- `migrations/0108` (the order's moment)

Not seen:
- `PurchaseOrderForm.tsx` after line 300 (the render)
- `po-draft.ts`
- how the "Thêm nhà cung cấp" round trip builds its return URL

1. **States, and how each is set.** The source order can be `COMPLETED`, `DRAFT` or `CANCELLED`. The copy always starts as a new, unsaved form. It becomes a draft or a completed order only through the existing "Lưu nháp" / "Hoàn thành" buttons, with all their checks.
2. **Buttons, and when to hide them.**
   - "Nhân bản" shows on an order's page for ADMIN and MANAGER (the roles that may create orders), on any status, cancelled included.
   - It is hidden while the edit form is on screen: a draft always shows the form, and so does `?edit=1`. Leaving an unsaved edit for a copy would drop the edit.
   - It is a plain link to `/admin/inventory/purchase-orders/new?copyFrom=<id>`. On the new-order page it adds no new button.
3. **What the copy contains, and what it leaves out.**

   | Field | From a cancelled order | From any other order |
   |---|---|---|
   | Supplier, source, notes | copied | copied |
   | Lines: item, unit, conversion, quantity, line total | copied, in the source's order | copied, in the source's order |
   | Shipping fee, tax, voucher, discount | copied | copied |
   | Payment method | copied | copied |
   | Bank account | copied if that account is still ACTIVE, else blank | copied if that account is still ACTIVE, else blank |
   | Supplier invoice code | copied | **blank** |
   | Transaction time | **copied exactly**: `transaction_date`, else `created_at` | **blank** |

   Never copied: the order code, status, created/cancelled fields, line ids, assets.
4. **Inputs, and values out of range.**
   - `copyFrom` with an unknown code: the page shows a notice above an empty form, "Không tìm thấy phiếu <code> để nhân bản."
   - `copyFrom` absent: the page is exactly as today.
   - A copied line whose item or conversion is no longer in use shows its item with an empty "Quy cách", the same as an old edit. The existing check then refuses "Hoàn thành" until one is chosen.
   - A blank transaction time is saved as the moment of "Lưu" (`savePurchaseOrder`, unchanged). The owner was told this.
5. **Data served, and data deliberately not served.**
   - **Served:** one order at a time, read once when the page opens.
   - **Not served:**
     - copying several orders at once;
     - copying from the list;
     - copying issue slips or sales orders;
     - any change to how an order is saved.

Extra questions for this job:

6. **Duplicate risk.** Copying a live order makes a second entry of the same purchase easier. The owner chose this knowing it (*"1b"*). The safeguards are the blank date and the blank invoice code. No extra warning is added.
7. **The draft-in-browser round trip.** If `?draft=1` is present ("Thêm nhà cung cấp" came back), the saved draft wins over the seed, because it is the newer of the two.
8. **Who can open `/new?copyFrom=`.** `getPurchaseOrderCopySeed` runs `requireAdmin`, as every purchase-order read does.

## Worked example (real data, measured 2026-10-06)

`PO-147`, 13/08/2026 00:00:
- bought from Cửa Hàng B&B Supplier Ly - Bar via Shopee;
- one line: Vòi rót rượu, 2 Cái, 55.200;
- voucher 35.000, total 20.200;
- paid in cash; no invoice code.

"Nhân bản" on `PO-147` today (it is COMPLETED) opens:
- the same supplier, source and line;
- voucher 35.000, total 20.200, payment "Tiền mặt";
- **Ngày nhập hàng thực tế blank**, invoice code blank.

Had `PO-147` been cancelled first, the copy would show the time **13/08/2026 00:00**.

Saving the copy as completed creates a new order code and a new Vòi rót rượu asset dated by the copy (`BR-COGS-008`). `PO-147` and its asset `TS-080` are untouched.

## Global Constraints

- On-screen text, exactly:
  - `Nhân bản`
  - `Nhân bản từ phiếu <code>`: a notice above the form, with a link to the source order
  - `Không tìm thấy phiếu <code> để nhân bản.`
- Code and comments in English.
- No popups (`BR-DATA-007`). The form's existing alerts are unchanged.
- The seed rules live in one pure function, never re-derived in the form.
- Desktop and phone both work (`.claude/rules/ui-devices.md`).

## Review Focus

1. **A cancelled order whose `transaction_date` is null** must copy `created_at`. Pinned in Task 1.
2. **A bank account that has since stopped** must come across blank while the method stays "Chuyển khoản". Pinned in Task 1.
3. **`?copyFrom=` together with `?draft=1`**: the draft wins. Pinned in Task 2.
4. **The copy saved must not carry the source's id.** The form must not send `id`, or it would overwrite the source. Pinned in Task 2.
5. **Lines keep the source's order** (`created_at`, then `id`). Pinned in Task 1.

---

### Task 1: Copy seed and server function (backend → Sonnet)

**Files:**
- Create: `lib/purchasing/purchase-order-copy.ts`, `lib/purchasing/purchase-order-copy.test.ts`
- Modify: `app/admin/inventory/purchase-orders/actions.ts` (add `getPurchaseOrderCopySeed`), plus its test file (`app/admin/inventory/purchase-orders/actions*.test.ts`; follow the existing pattern)

**Interfaces — Produces:**
```ts
export type PurchaseOrderCopySeed = {
  sourceOrderId: string;
  sourceCancelled: boolean;
  supplier_id: string;
  source_id: string;
  supplier_invoice_code: string;       // "" unless the source is CANCELLED
  transaction_date: string | null;     // ISO; null unless the source is CANCELLED
  notes: string;
  shipping_fee: number;
  tax_amount: number;
  voucher_amount: number;
  discount_amount: number;
  payment_method: "CASH" | "BANK_TRANSFER" | "";
  bank_account_id: string;             // "" when not in activeBankAccountIds
  lines: Array<{
    purchased_item_id: string;
    unit: string;
    quantity: number;
    subtotal: number;
    conversion_id: string;
  }>;
};

export function buildPurchaseOrderCopySeed(input: {
  order: { id: string; status: string; supplier_id?: string | null; source_id?: string | null;
           supplier_invoice_code?: string | null; transaction_date?: string | null; created_at: string;
           notes?: string | null; shipping_fee?: number | string | null; tax_amount?: number | string | null;
           voucher_amount?: number | string | null; discount_amount?: number | string | null;
           payment_method?: string | null; bank_account_id?: string | null };
  lines: Array<{ id: string; purchased_item_id: string; unit?: string | null; quantity: number | string;
                 subtotal: number | string; conversion_id?: string | null; created_at?: string | null }>;
  activeBankAccountIds: Set<string>;
}): PurchaseOrderCopySeed;
```
In `actions.ts`: `export async function getPurchaseOrderCopySeed(id: string): Promise<PurchaseOrderCopySeed | null>`.
- It runs `requireAdmin` and throws on failure, like the other reads.
- It loads the order, its lines (`purchase_order_id = id`) and `Bank_Accounts`.
- It returns null when the order does not exist.

- [ ] **Step 1: Failing tests** in `purchase-order-copy.test.ts`:
  - **`PO-147` as COMPLETED.** Supplier, source and the Vòi rót rượu line are copied, with quantity 2, subtotal 55200 and its conversion. Voucher is 35000 and payment is `CASH`. Transaction date is null and the invoice code is `""`.
  - **The same order as CANCELLED, with transaction date `2026-08-12T17:00:00Z`.** That date is kept exactly, and invoice code `"HD-1"` is kept.
  - CANCELLED with a null transaction date → `created_at`.
  - COMPLETED with invoice code `"HD-1"` → `""`.
  - `BANK_TRANSFER` with account `BA-2` not in the active set → method kept, account `""`. With `BA-1` active → `BA-1`.
  - Lines given out of order → sorted by `created_at`, then `id`.
  - Numeric strings (`"35000.000000"`) → numbers. A null extra cost → 0. A null notes → `""`. An unknown `payment_method` → `""`.
- [ ] **Step 2:** Run them. Expected red: the module is missing.
- [ ] **Step 3:** Implement. Make the tests green.
- [ ] **Step 4:** Test `getPurchaseOrderCopySeed`:
  - returns the seed for an existing order;
  - returns null for an unknown one;
  - throws for a non-admin.

  Red first (missing export), then green.
- [ ] **Step 5:** `npx tsc --noEmit`; `npx vitest run lib/purchasing app/admin/inventory/purchase-orders`. No commit.

### Task 2: "Nhân bản" link and the prefilled form (UI → Gemini via agy)

**Files:**
- Modify: `app/admin/inventory/purchase-orders/[id]/page.tsx`. Add a "Nhân bản" link, styled like "Huỷ phiếu", for ADMIN or MANAGER when `!showForm`, on any status. It points to `` `/admin/inventory/purchase-orders/new?copyFrom=${encodeURIComponent(po.id)}` ``.
- Modify: `app/admin/inventory/purchase-orders/new/page.tsx`:
  - Accept `searchParams?: { copyFrom?: string }`.
  - When it is set, call `getPurchaseOrderCopySeed`.
  - If the seed exists, pass `copySeed` to the form and show the notice "Nhân bản từ phiếu <code>", with the code linking to the source order.
  - If it is null, show "Không tìm thấy phiếu <code> để nhân bản." and an empty form.
- Modify: `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`:
  - New optional prop `copySeed?: PurchaseOrderCopySeed`.
  - When present and there is no `initialData`, the seed supplies every starting value:
    - supplier, source, invoice code, transaction date (`new Date(seed.transaction_date)` or null), notes, the four extra costs, payment method and bank account;
    - the lines, through the same conversion matching that `initialData.lines` uses today.
  - `isEdit` stays false, so no `id` is sent and the draft key stays the new-order key.
  - An existing `?draft=1` restore still runs after the seed and overrides it.
- Tests: the detail page test, a new-page test, and the form tests (follow the existing files beside each).

- [ ] **Step 1: Failing tests:**
  - A MANAGER on a COMPLETED order and an ADMIN on a CANCELLED order see "Nhân bản" with the right href. STAFF does not. A DRAFT order (the form is showing) does not.
  - The new page with `copyFrom=PO-147` shows "Nhân bản từ phiếu PO-147" and passes the seed. With an unknown code it shows the not-found text.
  - The form with the `PO-147` seed shows the supplier, the line and voucher 35.000. Submitting as draft sends no `id`, and sends `voucher_amount` 35000.
  - With `?draft=1` and a stored draft, the draft's supplier wins over the seed's.

  Red first: the link, prop and notice are missing.
- [ ] **Step 2:** Implement. Make the tests green. Run `npx tsc --noEmit`.

### Task 3: Review, gates, docs (Opus)

- [ ] Review both diffs against this plan.
- [ ] Run all five gates. Build in a throwaway worktree.
- [ ] Mark `BR-INV-016` built, with the date.
- [ ] Add a behaviour-change line to `docs/03-workflows/purchasing.md` and update its Q2 (buttons).
- [ ] Commit.
