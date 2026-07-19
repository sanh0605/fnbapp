# Feature-Completeness Pass — 17-Section F&B Checklist Reconciliation

> Tóm tắt tiếng Việt: Đối chiếu 17 mục tiêu chuẩn F&B (trong
> `docs/superpowers/specs/2026-07-17-full-system-audit-program.md`) với
> `docs/FEATURE-CATALOG.md` vừa làm mới. Đây là bước phân loại đầu tiên
> theo từng mục lớn — chưa đi sâu từng gạch đầu dòng nhỏ (khoảng 200 mục).
> Mục tiêu: tìm ra khoảng trống thật sự cần làm ngay (`REQUIRED_NOW`),
> phân biệt với việc dành cho đa chi nhánh sau này hoặc việc tuỳ chọn.
> Chờ anh duyệt cách phân loại trước khi lập kế hoạch hoàn thiện chi tiết.

## Method

For each of the 17 sections, checked against the refreshed
`docs/FEATURE-CATALOG.md` (53 rows, current as of 2026-07-20) rather than
re-deriving from scratch. Classification per the spec's own vocabulary:
`REQUIRED_NOW`, `REQUIRED_FOR_MULTI_OUTLET`, `RECOMMENDED_NEXT`,
`OPTIONAL_LATER`, `NOT_APPLICABLE`. This pass is section-level — it names
concrete missing capabilities, not every one of the ~200 individual
checklist bullets. Say if you want a specific section taken to full
bullet-by-bullet depth before approving its classification.

## 1. Organization, brand, outlet, device setup — mostly `NOT_APPLICABLE`/`REQUIRED_FOR_MULTI_OUTLET`

Covered: `ORG-BRAND-MASTER`, `ORG-BRAND-SCOPED-OPERATIONS` (single-shop
brand/POS/report scoping). Multi-outlet items (`ORG-MULTI-OUTLET`,
`ORG-FRANCHISE`) are already correctly `PLANNED`, sequenced after this
phase per owner decision — no change proposed. One real gap even at
single-shop scale: **outlet opening hours / temporary closure** has no
current entry point at all. Classify `RECOMMENDED_NEXT` (low urgency,
no evidence of a current operational need, but cheap to add later).
Device/register identity and staff-to-outlet assignment: `NOT_APPLICABLE`
until multi-outlet.

## 2. Users, roles, shifts, accountability — **1 concrete `REQUIRED_NOW` gap**

Covered: user lifecycle (`USR-ADMIN`), role enforcement
(`USR-ROLE-ENFORCEMENT`), action attribution from session
(`resolveActor`/`requireAdmin`, closed across Gates 1-2). **Gap: no shift
open/close, opening cash, closing cash, or variance tracking exists
anywhere in the catalog.** This is section 13's cash-reconciliation
concern too — they're the same missing capability. Classify
`REQUIRED_NOW`: a cash-handling business cannot know if a shift's cash
matches expected without this, and it's core to "kiểm soát tiền vào tiền
ra" from the owner's own priority list. Handover notes between shifts:
`RECOMMENDED_NEXT` (useful, not core).

## 3. Menu and sellable-product management — mostly covered, 2 gaps

Covered: categories/products/variants (`PROD-CATALOG-MASTER`), modifiers
(`PROD-MODIFIERS`), standalone toppings, prices/history (`PRICE-HISTORY`).
Gaps: **scheduled availability by day/time** and **automatic sold-out
based on stock** have no entry point. Classify both `RECOMMENDED_NEXT` —
real convenience features, not blocking current operation (staff can
manually toggle active/inactive today).

## 4. Recipes, ingredients, semi-products — covered

`PROD-RECIPE-VERSIONING`, `BTP-RECIPE-MASTER`, `BTP-CONSUMPTION` cover
the core. Wastage/loss during preparation has no dedicated entry point
(only implicit via production yield variance) — classify
`RECOMMENDED_NEXT`.

## 5. POS ordering and checkout — covered, atomicity/idempotency now strong

`POS-CATALOG`, `POS-CHECKOUT` (now `LIVE_VERIFIED` with idempotency),
`POS-DRAFTS`. Split/mixed payment: not evidenced in the catalog — worth
confirming whether it's actually needed (owner interview) before
classifying; tentatively `RECOMMENDED_NEXT` pending that check.

## 6. Offline and unreliable-network operation — **already an owner decision, not a gap**

`POS-OFFLINE` is `PLANNED` per owner decision D2 — correctly out of this
phase's scope. No reclassification proposed; flagging here only because
the checklist lists it as its own section.

## 7. Order lifecycle and after-sale correction — covered, atomicity now strong

`ORD-LIST-DETAIL`, `ORD-EDIT-SUPERSEDE`, `ORD-VOID` (both now
`LIVE_VERIFIED`, atomic). Refund/repayment handling: not evidenced —
classify `RECOMMENDED_NEXT` pending owner confirmation of whether refunds
happen in practice today (if they do informally, this is a real gap, not
optional — worth an explicit owner check before finalizing).

## 8. Purchasing and supplier management — covered

`PUR-SUPPLIERS`, `PUR-PURCHASE-ORDER` (atomic, `LIVE_VERIFIED`),
`PUR-SOURCES-CONVERSIONS` — all with Gate 7's added input validation.
Purchase return to supplier: no entry point — classify
`RECOMMENDED_NEXT`.

## 9. Production and semi-finished-goods control — covered

`BTP-RECIPE-MASTER`, `BTP-PRODUCTION-ORDER` (now atomic). Expiry/shelf-life
alerting: no entry point — classify `RECOMMENDED_NEXT` (perishables risk,
but no evidence of current spoilage problems reported).

## 10. Inventory and stock control — covered, 1 explicit owner-tracked gap

`INV-STOCK-BALANCE`, `INV-STOCK-ADJUSTMENT` (atomic), `INV-NEGATIVE-STOCK`
(`PARTIAL` — diagnosis exists, physical-count correction is the owner's
to schedule, already tracked, not a new finding). Inter-outlet
transfer: `NOT_APPLICABLE` until multi-outlet. Minimum/reorder level and
low-stock warning: no entry point — classify `REQUIRED_NOW`, this is a
core "kiểm soát hàng tồn" capability the owner explicitly prioritized and
currently has zero automated support for (someone has to notice low stock
by eye today).

## 11. Promotions, discounts, pricing governance — covered

`PROMO-ADMIN` (now with server-side validation), `PROMO-CHECKOUT`,
`PRICE-HISTORY`. No material gap identified against this section.

## 12. Customer, preorder, pickup, delivery — mostly `OPTIONAL_LATER`

No current entry points for preorder/pickup-queue/delivery-address
tracking. Given the business is takeaway/cart-based per `CONTEXT.md`,
classify `OPTIONAL_LATER` pending an explicit owner confirmation that
preorder/delivery is or isn't part of current operations — don't assume.

## 13. Cash, payment, daily reconciliation — **same `REQUIRED_NOW` gap as section 2**

Opening float, cash in/out, expected-vs-counted variance, shift/day close
— none of this exists in the catalog. This is the single largest concrete
gap found in this pass, and it's explicitly one of the owner's named
priority areas ("kiểm soát tiền vào tiền ra"). Classify `REQUIRED_NOW`.
Tax/e-invoice integration: `OPTIONAL_LATER`, needs an explicit business
decision per the checklist's own instruction.

## 14. Reporting and management controls — strong coverage

`RPT-SALES`, `RPT-PNL-MAC`, `RPT-HOURLY`, `RPT-STOCK`,
`RPT-PROMOTION-PERFORMANCE` — all `LIVE_VERIFIED`, all reconfirmed live
during Gates 7-8. Void/correction/manual-discount-specific reports: no
dedicated report exists (the underlying data is there — `AUD-*` rows —
but no rollup view). Classify `RECOMMENDED_NEXT`. A cash/shift
reconciliation report is blocked on section 2/13's gap existing first.

## 15. Auditability and data integrity — strong coverage

`AUD-BACKDATE-DETECT/REVIEW/MAC-COHORT/HISTORICAL-LOCKS`, atomic writes
now closing most of Gate 4's original findings. This is the
best-covered section in the whole checklist. No material gap identified.

## 16. Backup, restore, deployment, operations — covered, 1 known gap

`BKP-FULL-SNAPSHOT`, `BKP-DRIVE-RETENTION` (both `LIVE_VERIFIED`),
`OPS-CLIENT-ERROR-LOG` (new, Gate 7). `BKP-RESTORE` remains `PLANNED` —
already tracked, not a new finding; a real gap but the owner already
knows about it (restore drill never done). No new item proposed beyond
what's already tracked.

## 17. Optional capabilities — explicitly deferred, correctly so

Loyalty/CRM/franchise/central-warehouse/KDS/delivery-API/payroll/
accounting/e-invoice/native-app — none built, and per the checklist's own
instruction, none should be built without an explicit owner decision.
No action proposed; this section exists to prevent scope creep, not to
generate a to-do list.

## Summary: concrete `REQUIRED_NOW` gaps found

Only **2 real gaps** rose to `REQUIRED_NOW` in this pass, and they're the
same underlying capability seen from two checklist sections:

1. **Shift and cash reconciliation** (sections 2 + 13) — no shift open/
   close, opening float, cash in/out, or expected-vs-counted variance
   tracking exists anywhere in the system today.
2. **Low-stock / reorder-level warning** (section 10) — no automated
   signal exists; stock depletion is only visible by manually checking
   `RPT-STOCK`.

Everything else found is `RECOMMENDED_NEXT` or `OPTIONAL_LATER`, or is
already a tracked, owner-known gap (`INV-NEGATIVE-STOCK`, `BKP-RESTORE`,
`POS-OFFLINE`, multi-outlet items) that doesn't need re-litigating here.

A few items are marked tentative pending a direct owner question rather
than guessed at: split/mixed payment usage, refund/repayment frequency
in practice, and preorder/delivery scope. These affect classification but
aren't things I should assume either way.

## Next step, pending your approval

1. Confirm or adjust the classifications above (especially the 2
   `REQUIRED_NOW` items — do these match how you'd prioritize it?).
2. Answer the 3 tentative items (split payment, refunds, preorder/delivery)
   so they can be classified properly instead of guessed.
3. Once classification is confirmed, the next deliverable is a completion
   roadmap for the `REQUIRED_NOW` items specifically — which I will not
   start designing or building until you approve scope and priority on
   *that* roadmap too (this is a 2-step approval per the audit program's
   own exit criteria, not a rubber stamp before implementation starts).
