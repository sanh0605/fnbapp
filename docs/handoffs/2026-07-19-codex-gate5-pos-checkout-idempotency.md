# Task: Full System Audit — Gate 5: POS Checkout Idempotency

## Tóm tắt cho chủ doanh nghiệp

Đợt kiểm tra tiếp theo trong chuỗi 8 bước. Tên gọi trong kế hoạch ban đầu là
"POS/offline/idempotency" nhưng phần "offline" đã có quyết định từ trước
(D2, `docs/FEATURE-CATALOG.md`) là **chưa cần làm, để nguyên trạng chưa xác
minh** — không phải việc của gate này. Phần thật sự cần làm là
**idempotency của khâu thanh toán POS**: nếu mạng giật/lag đúng lúc khách
thanh toán xong, có khả năng hệ thống ghi đơn hàng đó **hai lần** (tính tiền
2 lần, trừ kho nguyên liệu 2 lần) mà không ai biết, vì hiện tại không có cơ
chế nào ngăn việc gửi lại y hệt yêu cầu thanh toán đó lần hai.

## Context — how this gap was found

`docs/FEATURE-CATALOG.md`'s cross-cutting assessment (line ~244) explicitly
places offline ordering out of scope: "Owner decision D1 places multi-brand/
outlet in future scope, and D2 requires offline behavior to remain
unverified or planned until evidence exists." `ARCHITECTURE.md:150` says the
same: "Offline POS capability is `UNVERIFIED`; architecture must not imply
it exists." **Do not build or verify offline capability in this gate** —
that would contradict an existing owner decision.

Read `app/pos/actions.ts`'s `submitOrderV2` and `lib/order-cart.ts`'s
`buildOrderFromCart` directly (not just the catalog summary). Found:

- `buildOrderFromCart` generates the order's ID fresh on every call:
  `const orderId = \`ord-${crypto.randomUUID()}\`` (`lib/order-cart.ts:91`).
  This runs *inside* `submitOrderV2`, so every invocation gets a brand-new ID.
- The whole order (header, lines, event, ledger) is persisted in one
  transaction via `create_pos_order_atomic`
  (`supabase/migrations/0008_pos_checkout_performance.sql:113`) — this part
  is already correctly atomic (all-or-nothing per call), same house style as
  the Gate 4 Phase B RPCs.
- But nothing prevents `submitOrderV2` itself from being called twice for
  the same real-world sale. Read the checkout handler in
  `components/POSScreen.tsx` (`handleConfirmCheckout`, ~line 653) and
  `components/pos/CartPanel.tsx` (~line 481): there's a client-side
  `isCheckingOut` React state that disables the checkout button while a
  request is in flight — this stops a rapid double-tap, but it's reset to
  `null` on *both* success and failure (`POSScreen.tsx:736,779`), and it's
  pure client memory with no server-side backstop. If the RPC call actually
  succeeds on the server but the client never receives the response (a
  timeout, a dropped connection, the tab reloading mid-request — genuinely
  possible on a shop's real-world Wi-Fi, not a contrived edge case), the
  cashier sees an error or a stuck spinner, the button re-enables, and
  retrying creates a **second, fully valid, fully atomic order** — same
  cart, new random ID, new order number, its own stock consumption and
  revenue. Each order is internally consistent; the problem is that two of
  them now exist for one real sale.
- Confirmed no existing coverage of this scenario:
  `scripts/probe-pos-order-rollback.ts` only exercises a forced-failure
  rollback (does an intentionally invalid write correctly roll back) — it
  does not test "the write succeeds, the client doesn't find out, the
  client retries."

This is the POS-specific version of exactly the failure mode Gate 4 spent
the whole day fixing elsewhere (`voidOrderV2`, `saveProductionOrder`,
etc.) — except here the underlying write is already atomic; the gap is one
level up, at "was this exact checkout attempt already processed."

## Scope

### 1. Fresh baseline (do this first, matching every prior gate)

Rerun the existing POS/order correctness audits
(`scripts/audit-order-ledger.ts`, `scripts/audit-current-stock.ts`,
`scripts/audit-pnl-mac-consistency.ts`, `scripts/audit-void-orders.ts`, any
others under `scripts/audit-*.ts` that concern orders) against current data.
Record status (clean/drift/error) briefly — this confirms you're starting
from the same state Claude verified after Gate 4 Phase B and Gate 3 Phase B
tonight, not an assumption.

### 2. Add an idempotency key to POS checkout

Give the client a way to mark "this is the same checkout attempt as
before" so a retry completes or returns the original result instead of
creating a second order.

- Client side (`components/POSScreen.tsx`): generate a request token once
  per checkout attempt — e.g., when `handleConfirmCheckout` starts (not
  inside `buildOrderFromCart`, which runs server-side), store it in a
  `useState`/`useRef` alongside `isCheckingOut`, reuse the *same* token if
  the user retries the same pending checkout (clear it only on a genuinely
  new checkout: cart change, success, or explicit cancel). Pass it through
  to `submitOrderV2(cartInput, requestToken)` or similar. This is mechanical
  plumbing, not a visual/design change — if it turns out to need real UX
  judgment (e.g., how to surface "this sale may already be recorded, check
  before retrying" to the cashier), stop and flag rather than guessing at
  copy/flow that affects the cashier's daily workflow.
- Server side (`app/pos/actions.ts`, `create_pos_order_atomic`): accept the
  token, check whether an order with that token already exists before
  creating a new one (add a column, e.g. `client_request_id` on
  `orders_v2`, unique-indexed) — if it does, return the existing order's
  result (matching the `already_voided`/`already_completed` idempotent-
  return pattern already used in every Gate 4 Phase B RPC) instead of
  raising or silently creating a duplicate. If the token is missing
  (e.g., an older client build, or `CLI_MODE` callers), fall back to
  today's behavior — don't make the token mandatory in a way that breaks
  existing callers you haven't checked (`scripts/probe-pos-order-rollback.ts`,
  any test harness calling `submitOrderV2` directly).
- Write a forced-failure-style test that reproduces the exact scenario:
  call `submitOrderV2` (or the RPC directly) twice with the same token,
  assert only one order/one set of lines/one ledger batch exists, matching
  the second call's response to the first's.

### 3. Light check on POS drafts

`savePOSDraft`/`getPOSDrafts`/`deletePOSDraft` (`app/pos/actions.ts`) don't
carry the same financial/inventory stakes as a completed order (a
duplicate draft is just clutter, not double revenue or double stock
consumption), so this is a quick check, not a redesign: confirm a retried
`savePOSDraft` doesn't behave surprisingly (e.g., silently overwriting a
different draft, or leaving two drafts for the same cart). If it's already
fine (each draft gets its own ID, retry just creates a second harmless
draft the cashier can ignore/delete), say so and move on — no fix needed
for a low-stakes duplicate.

### 4. Offline-capability documentation check (read-only, no build work)

Confirm `docs/FEATURE-CATALOG.md`'s and `ARCHITECTURE.md`'s "offline
UNVERIFIED" status still accurately describes the code (i.e., nothing
silently added a `localStorage`/`IndexedDB`/service-worker offline queue
since those docs were written that would make the claim stale in the
*other* direction). This is a documentation-accuracy check, not a task to
build or verify offline behavior — if the docs are still accurate, note
that and move on.

## Explicitly out of scope

- Do not build, verify, or plan offline/PWA capability — out of scope per
  owner decision D2.
- Do not touch `voidOrderV2`, `supersedeOrderV2`, or any other Gate 4
  path — different scope, already closed.
- Do not add an idempotency key to `savePOSDraft` unless step 3 finds a
  real problem — don't add complexity to a low-stakes path speculatively.
- Do not touch multi-brand/outlet scope — separate, later phase.

## Stop-and-ping triggers

Per tonight's updated working agreement: keep going through this whole
task without waiting for a review checkpoint between steps — Claude isn't
available to review in real time overnight. Only stop and note it clearly
in your final report (don't block waiting for a reply) if:

- The idempotency-key design turns out to need a real product/UX decision
  (not just plumbing) — e.g., what a cashier should see/do when a retry is
  rejected as a duplicate.
- A forced-failure test reveals a broader gap than described here (e.g.,
  the atomic RPC itself has a partial-failure window, not just a
  double-invocation risk).
- Any rerun audit script reports drift that wasn't already known/logged.
- TS/build fails for a non-trivial reason.

Otherwise: keep working straight through steps 1-4, commit at each logical
step (one commit per step, matching the one-commit-per-outcome rule), and
produce one final summary report covering everything when done — the same
verification bar as every Gate 4/Gate 3 commit tonight (tests, TypeScript,
live audit reruns, migration list, no push/merge).

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 498).
3. New test reproduces the double-submit-after-ambiguous-failure scenario
   and proves it's now safe.
4. If a migration is added: applies cleanly, `npx supabase migration list`
   shows local/remote matched.
5. `git diff --check`: clean.
6. No push, no merge — same as every task tonight.

## Priority / model

P1 — this is a real, reachable double-charge/double-stock-consumption risk
on the POS's main revenue path, higher stakes than most of tonight's
already-fixed paths (Gate 4 Phase B's risks were all conditional on a
partial-write failure in a narrow window; this one just needs an ordinary
network hiccup plus a retry, no partial-failure precondition required).

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High —
architecture/schema change (new column, new RPC parameter) touching the
main revenue path, plus a cross-boundary (UI + engine) plumbing change.
