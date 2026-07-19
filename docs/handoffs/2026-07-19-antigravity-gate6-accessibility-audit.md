# Task: Full System Audit — Gate 6: UI/UX/Accessibility Audit

## Tóm tắt cho chủ doanh nghiệp

Bước thứ 6 trong chuỗi kiểm tra 8 bước, tới lượt đội giao diện. Các đợt sửa
UI trước đây (UI-REMED-1 đến UI-REMED-6) đã làm cho giao diện đồng nhất về
màu sắc/thiết kế. Gate này khác — kiểm tra xem người dùng **khó khăn hơn
bình thường** (dùng bàn phím thay chuột, dùng trình đọc màn hình, mắt kém,
tay run khi bấm màn hình cảm ứng) có dùng được app này không. Không có bằng
chứng ai từng kiểm tra việc này trước đây.

## Context — what's already known vs. what Gate 6 must find fresh

`docs/audits/2026-07-06-ui-consistency-audit.md` and the UI-REMED series
covered color/token consistency only — grepped it directly, zero mentions
of accessibility, ARIA, keyboard navigation, or screen readers. This is a
genuinely unaudited area, not a re-check of prior work.

Two quick signals from a first pass (not a full audit — do the systematic
sweep yourself, this is just to show the kind of thing to look for):

- **Good baseline already in place**: every `<img>` tag found in
  `components/pos/CartItemRow.tsx`, `components/pos/ProductCard.tsx`, and
  `app/admin/products/ProductsClient.tsx` already carries a meaningful
  `alt={product.name}` — don't assume the codebase is starting from zero;
  build on what's already right rather than re-doing it.
- **A concrete gap**: `app/admin/inventory/stock-adjustments/components/StockAdjustmentsClient.tsx:139,145` has two icon-only `✕` close buttons with no `aria-label` — a screen reader announces just "button," not what it closes. This exact pattern (icon-only interactive element, no accessible name) is worth grepping for across the whole `app/`/`components/` tree, not just this one file.

34 of 156 `.tsx` files already use some `aria-*` attribute or `role=`, so
coverage is partial and inconsistent, not absent — the goal is closing the
gaps and making it consistent, not introducing accessibility patterns from
scratch.

## Scope

### 1. Systematic audit, produce a dated report (do this before fixing anything)

Sweep `app/**/*.tsx` and `components/**/*.tsx` for:

- **Icon-only or ambiguous interactive elements** without an accessible
  name (`aria-label`, `aria-labelledby`, or equivalent visually-hidden
  text) — buttons, close/dismiss controls, icon-only nav items.
- **Form inputs without an associated label** — every `<input>`,
  `<select>`, `<textarea>` should have a `<label>` (via `htmlFor`/`id` or
  wrapping) or an `aria-label`/`aria-labelledby`. Check the POS checkout
  flow, admin forms (products, inventory, purchase orders), and login/
  settings pages specifically — these are the highest-traffic and highest-
  stakes flows.
- **Keyboard operability** — can a user complete the POS checkout flow,
  admin CRUD forms, and modal dialogs (`components/ui/Dialog.tsx`,
  `ModalPortal.tsx`) using only the keyboard? Check focus is trapped
  correctly inside open modals and returns to a sensible place on close
  (existing `DialogHost.test.tsx` tests render behavior, not focus
  management — a gap worth checking).
- **Color contrast** against the existing Fresh Blue design-token system
  (established by the UI-REMED-1 token-swap migration) — spot-check text-
  on-background combinations already in use, don't invent new colors to
  test against a WCAG checker; flag any token pairing that fails AA
  contrast for normal text (4.4.5:1) or large text/UI components (3:1).
- **Touch target size** on the POS screen specifically (already shows some
  care — `components/pos/CartPanel.tsx`'s checkout buttons use
  `min-h-[44px]`/`min-h-[52px]` — confirm this is consistent across all POS
  interactive elements, not just checkout buttons, since POS runs on
  tablets/touch devices in a real shop).
- **Vietnamese language correctness in accessible names** — an `aria-label`
  or screen-reader-only text should be in Vietnamese matching the rest of
  the UI, not left in English or omitted.

Produce `docs/audits/2026-07-19-gate6-accessibility-audit.md`: an inventory
of findings with file:line evidence, each classified by severity (Low/
Medium/High) and by fix complexity (mechanical vs. needs design judgment).
Matches the same audit-then-classify pattern used for every engine gate
tonight (Gate 2-5) — evidence first, a dated report, before any fix.

### 2. Fix the mechanical findings

Findings that are unambiguous (add a missing `aria-label` with the obvious
Vietnamese text, associate an orphaned `<label>` with its input, fix a
contrast pair that clearly fails against the existing token system) — fix
directly, one commit per logical group (e.g., "add aria-labels to icon-only
buttons," "associate form labels," matching the one-commit-per-outcome
rule the engine gates used tonight).

### 3. Stop and flag anything needing real design/UX judgment

If a finding's fix isn't obvious from the pattern already established
elsewhere in the codebase (e.g., a genuinely awkward focus-order problem
in a complex form, a color pairing that would need a new token rather than
reusing an existing one, a keyboard-navigation redesign for a
drag-and-drop or multi-step flow) — describe it precisely in the report
with the tradeoff, don't guess at a UX solution unilaterally. This matches
how engine gates handled schema-semantics stop-gates tonight: investigate
and describe precisely, let Claude/owner decide the design call.

## Explicitly out of scope

- Do not re-do the color/token consistency work — UI-REMED-1 through
  UI-REMED-6 already closed that, this gate is additive (accessibility),
  not a redo.
- Do not touch server actions or data flow — if an accessibility fix would
  require changing what data a component receives (not just how it's
  rendered/labeled), stop and flag per Section C ("If UI changes server
  action or data flow, Codex review is also required") rather than
  reaching into `app/*/actions.ts` yourself.
- Do not redesign layouts, spacing, or visual hierarchy — accessibility
  fixes should be additive (labels, focus management, contrast token
  swaps), not a visual redesign pass.
- Do not touch the POS screen's core interaction model (cart, checkout
  flow, product grid layout) — Gate 5 just changed the checkout request
  flow tonight; keep this gate's POS-related changes to accessibility
  attributes and touch-target sizing only.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 523).
3. `npx next build`: succeeds, no new route/build regressions.
4. Visual smoke check: the `run` skill or a manual pass through the POS
   checkout flow and at least one admin CRUD form, confirming nothing
   broke visually from the accessibility attribute changes.
5. `git diff --check`: clean.

## Priority / model

P2 — real gap, no active harm reported, but a legitimate accessibility
debt now that the color/consistency work is done. Not urgent enough to
block other work, but shouldn't sit indefinitely either.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.1 Pro (Low)` for
the systematic audit and mechanical fixes (design-system-consistency-tier
work, applying an existing pattern — aria labels, label association —
across many files); escalate to `Gemini 3.1 Pro (High)` only if a specific
finding turns out to need real accessibility-critical redesign judgment
(per Section G's guidance for "Mobile-first complex / critical UI").
