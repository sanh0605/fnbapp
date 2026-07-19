# Task: Feature-Completeness FC-1 — POS Split/Mixed Payment UI (functional only)

## Tóm tắt cho chủ doanh nghiệp

Backend đã xong: một đơn có thể trả bằng nhiều hình thức cùng lúc (ví dụ
một phần tiền mặt, một phần chuyển khoản), đã kiểm thử và áp dụng lên
database thật. Việc còn lại là giao diện nhập trên POS — theo đúng ý chủ
quán, làm phần **chức năng thôi, chưa cần đẹp** — phần giao diện đẹp/đồng
bộ sẽ làm chung một lượt khi tái thiết kế toàn bộ UI/UX sau này.

## Context

Owner confirmed (2026-07-20) split/mixed payment on one order happens in
practice and is priority 1 of the feature-completeness pass. Full scope:
`docs/superpowers/plans/2026-07-20-feature-completeness-required-now-roadmap.md`
section 1. Owner also confirmed: UI for all 3 feature-completeness items
should be **functional only** — visual design work is deliberately
deferred to the later full frontend/UI/UX redesign phase, not built twice.

Claude built and verified the backend/logic layer (commit `17a191e`,
covering Codex's role while it's rate-limited until 2026-07-25; Codex
should review retroactively when back, same as `REV-2`):

- New `order_payments` table (migration `0024`, already applied to
  production) — `id`, `order_id`, `method`, `amount`, `reference`,
  `created_at`.
- `lib/order-cart.ts`'s `CartInput` gained an optional `payments?:
  CartPaymentInput[]` field (`{ method: "CASH" | "BANK_TRANSFER"; amount:
  number; reference?: string }[]`). When provided with 2+ entries,
  `buildOrderFromCart` validates the amounts sum to exactly the order's
  `net_total` and throws `InvariantError` if they don't (including a
  friendly message naming both numbers). It also rejects any payment with
  `amount <= 0`.
- `lib/pos-order-transaction.ts`'s `savePosOrderAtomic` accepts an
  optional `payments` array and passes it through as `p_payments` to the
  `create_pos_order_atomic` RPC.
- Fully backward compatible: omitting `payments` (or passing `[]`)
  produces the exact same single-payment-method behavior as before —
  nothing about the existing checkout flow changes if this field isn't
  used.

## Scope

### 1. POS payment entry — support multiple payment lines

Current flow: `components/POSScreen.tsx`'s `handleConfirmCheckout(method:
string)` (line ~658) takes a single method string ("Tien mat" / "Chuyen
khoan") from `components/CartPanel.tsx`'s checkout button UI (the
`handleConfirmCheckout` prop passed at `POSScreen.tsx` line ~1002).

Add a way for the cashier to enter 2+ payment lines instead of picking one
method, when needed:

- A way to add a payment line: pick method (CASH/BANK_TRANSFER), enter an
  amount, optionally a reference (e.g. transfer confirmation code).
- A running total vs. the order's amount due, so the cashier can see when
  the split is complete.
- Block confirming checkout until the sum exactly equals the order total
  (mirror the same validation client-side for a fast error message, but
  the real enforcement is server-side in `buildOrderFromCart` — don't
  remove or weaken that).
- The ordinary single-payment case (the vast majority of orders) should
  stay exactly as fast as it is today — this is an *additional* path, not
  a replacement flow that adds friction to every checkout.

### 2. Wire the new payment lines through checkout

When 2+ payment lines are entered, build a `payments` array and pass it
into the `CartInput` object constructed in `handleConfirmCheckout`
(`POSScreen.tsx` line ~677-706), instead of relying on the single
`payment_method` field. When only 1 method is used (today's normal case),
either omit `payments` entirely or pass a single-entry array — both
produce identical behavior server-side, so use whichever is simpler given
the UI state shape you land on.

### 3. Functional-only, per owner instruction

No new visual polish, no redesign of the existing checkout modal beyond
what's strictly needed to enter multiple payment lines. Reuse existing
form/input components and styles as-is. This will be revisited during the
later full frontend/UI/UX redesign phase — don't invest time here that
would be redone then.

## Explicitly out of scope

- Any visual/design work beyond making the feature usable.
- Changing `app/admin/reports/actions.ts`'s payment-breakdown report
  logic — Claude already updated it to attribute revenue per payment
  line from `order_payments` (with a fallback to the legacy single-method
  behavior for orders with no `order_payments` rows).
- Changing the RPC/migration/schema — already done and applied to
  production.
- The other 2 feature-completeness items (low-stock suggestion, shift/cash
  reconciliation) — separate, lower-priority tasks not yet started.

## Stop-and-ping trigger

- If the existing single-payment checkout flow's speed/steps change
  noticeably for the ordinary case — that regresses a "fast checkout"
  requirement the owner cares about. Flag before shipping if this seems
  unavoidable.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 570).
3. Manually exercise: a normal single-method checkout (confirm unchanged
   speed/behavior) and a split-payment checkout (confirm it reaches
   `submitOrderV2` with a correct `payments` array and succeeds).
4. `git diff --check`: clean.
5. No push, no merge, no production data writes beyond the normal POS
   checkout path.
