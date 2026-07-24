# Frontend UI/UX Audit

Date: 2026-07-24
Author: Claude (read-only code audit; no browser walkthrough — see FE-9)
Status: findings + proposed plan; implementation goes to Antigravity/Codex per
the 2026-07-24 owner directive (Claude plans/reviews only)
Builds on: `docs/audits/2026-07-06-ui-consistency-audit.md` (remediated via
UI-REMED-1..6), `docs/audits/2026-07-19-gate6-accessibility-audit.md`

## Tóm tắt cho chủ quán

Nền giao diện hiện **khá hơn nhiều so với đợt kiểm 07-06**: các sửa chữa cũ vẫn
giữ nguyên hiệu lực (hộp thoại thống nhất, màn hình chờ tải đủ 31 trang, bố cục
thẻ trên điện thoại ở 25 nhóm màn hình, tiêu đề trang chuẩn ở 40 file, lỗi mất
con trỏ khi gõ trong form đã sửa tận gốc). Những điểm chưa tốt còn lại chia 3
nhóm: (1) **thiếu tính năng ở giao diện** — quan trọng nhất là màn hình thanh
toán chưa cho thu tiền kiểu vừa mặt vừa chuyển khoản dù phần lõi đã hỗ trợ từ
20/07, và topping hiện sai món; (2) **màu tự chế còn sót ở 22 file form** — sau
khi đổi sang tông màu ấm tuần này, các chỗ này sẽ lệch tông rõ hơn; (3) **mấy
món nợ gọn**: 1 file form không còn được dùng, chữ "Unknown" tiếng Anh lộ ra ở
vài chỗ, chữ quá nhỏ (8-10px) dùng ở 38 file, và màn hình bán hàng là 1 file
khổng lồ 1.153 dòng khó sửa an toàn. Việc **làm đẹp/đồng bộ toàn diện** vẫn nên
theo lộ trình đã chốt (sau khi xong tính năng), nhưng nhóm dọn dẹp nhỏ có thể
giao đội giao diện làm ngay mà không đụng thiết kế.

## A. Verified healthy (fresh evidence this session)

| Area | Evidence |
|---|---|
| Dialog migration held | 46 `alert(`/`confirm(` matches are all `lib/dialog` API calls (Vietnamese, variant-typed); 0 native browser dialogs remain |
| Loading states | `loading.tsx` present on all 31 routes incl. POS and dynamic segments |
| Mobile layouts | `md:hidden` card/table split in 25 files covering every major list page |
| Page headers | `PageHeader`/`StickyFilterBar` in 40 files; the 07-06 "custom flexbox header" pages now use them |
| Modal typing bug | 2026-07-23 focus-steal root-cause fix at `FormModal`/`Dialog` primitives verified by regression test; all 13 forms inherit |
| Accessibility baseline | Gate 6: 10 icon-button `aria-label`s + 16 field labels fixed; contrast recomputed AA-clean by Claude; all `<img>` have `alt` |

## B. Findings register

| ID | Sev | Finding | Evidence | Proposed owner |
|---|---|---|---|---|
| FE-1 | P1 | **Split-payment POS UI never built** — backend RPC live since 2026-07-20 (`REV-3`), cashier still cannot record mixed cash+transfer payment | `docs/handoffs/2026-07-20-antigravity-fc1-split-payment-pos-ui.md` still pending pickup | Antigravity (existing handoff) |
| FE-2 | P1 | Topping list identical for every product (boiled egg shows coffee toppings) — data-model gap surfacing as a UX defect | Re-audit F-9; needs small design + owner approval before UI work | Design first (Claude), then Codex+Antigravity |
| FE-3 | P2 | **65 raw Tailwind palette occurrences across 22 files** (gray/rose/emerald/amber/... instead of design tokens), concentrated in `components/*Form*.tsx`, `components/backdated-ledger/*`, `components/pos/CartPanel.tsx`. The 2026-07-24 warm-palette retheme (`66c963c`) makes these visibly clash now | grep this session (count per file in handoff) | Antigravity — mechanical token swap |
| FE-4 | P2 | `components/POSScreen.tsx` is a 1,153-line monolith (partial extraction into `components/pos/*` exists but the main component still owns checkout modal, product modal, payment flow, toasts). Any POS UI change is high-regression-risk; must be decomposed before the redesign phase touches POS | line count this session | Antigravity, no-visual-change refactor, Claude review |
| FE-5 | P2 | `components/ModifierForm.tsx` is dead code — zero importers (live form is `app/admin/products/modifiers/components/ModifierForm.tsx`). Cost is real: Gate 6 patched aria-labels in the dead copy too | import grep this session | Antigravity — delete after independent import re-check |
| FE-6 | P3 | Typography floor: 138 uses of `text-[8px]`..`text-[10px]` across 38 files as the standard label style — legible on desktop, borderline on a phone in a bright cart environment. Needs a deliberate type-scale decision in the redesign phase, not piecemeal edits | grep this session | Redesign phase |
| FE-7 | P3 | User-visible English fallbacks: 7 `"Unknown"` occurrences (`app/admin/orders/actions.ts` product/size snapshots, `app/admin/reports/stock/page.tsx`, `app/admin/products/page.tsx`, `components/ProductionForm.tsx`) → should be "Không rõ" | grep this session | Antigravity (Codex review for the actions.ts ones) |
| FE-8 | P2 | Deliberate functional-only UIs awaiting the redesign phase: `ReorderSuggestionTable`, shift-check section on `/admin/reports/stock`, FC-1 payment area once built. Not defects — recorded so the redesign phase has a definitive list | tracking entries 07-22/07-23 | Redesign phase |
| FE-9 | P2 | **No hands-on operator walkthrough exists for most flows** (21 `LIVE_UNVERIFIED` capabilities). This audit is code-level only; a browser pass needs owner credentials/UAT sessions — same item as re-audit W4.3 | FEATURE-CATALOG | Owner + Claude (scripted UAT) |
| FE-10 | P3 | `icon.png` 404 on every page | already Wave 3 item A4 | Codex (in PERF-2) |

## C. Proposed plan

Sequencing respects the agreed roadmap: full UI/UX unification (Future
direction item 4) stays after feature completeness; the items below are either
already-committed work (FC-1), design-free cleanup, or prerequisites for the
redesign phase.

1. **FC-1 split-payment POS UI** — existing handoff, unblocked, highest UX
   value. `docs/handoffs/2026-07-20-antigravity-fc1-split-payment-pos-ui.md`.
2. **UI-CLEAN-1 (new handoff)** — mechanical, no design decisions:
   token-swap the 65 raw color occurrences; delete dead
   `components/ModifierForm.tsx` after re-verifying zero importers;
   "Unknown" → "Không rõ" (7 places; the `actions.ts` ones need Codex review
   per cross-boundary rule). `docs/handoffs/2026-07-24-antigravity-ui-clean-1.md`.
3. **UI-SPLIT-1** — decompose `POSScreen.tsx` into `components/pos/*` modules
   with zero visual/behavior change (screenshot-parity + existing tests as the
   bar). Scoped handoff to be written when its turn comes; prerequisite for any
   POS redesign.
4. **Redesign/unification phase** (owner go-ahead required, per roadmap):
   starts with a design-direction proposal (type scale incl. the FE-6 floor,
   warm-palette component states, spacing/density for the POS touch context),
   then page-by-page unification; FE-8's functional-only screens get their
   real design here.
5. **Hands-on UAT pass** (FE-9) — 2–3 owner-accompanied sessions, doubles as
   the re-audit's W4.3; updates FEATURE-CATALOG statuses.

## D. Out of scope here

- Any code change (owner directive: Claude plans only).
- Redesign aesthetics — deferred to the phase-4 design proposal.
- PERF items already in `docs/handoffs/2026-07-24-codex-wave3-performance-remediation.md`.
