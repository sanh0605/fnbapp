# Phase 12 — Multi-branch extensibility impact map (audit gap #3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps `- [ ]`. Critique before coding. **If a tool call is blocked, STOP and report — never re-run it through a different tool.**

**Goal:** Close the one real doc gap the final 44-question audit found (point 7: "adding a branch touches how many places?" was not enumerated). Write a current-state impact map: where the code assumes one shared warehouse / one shop today, so a future multi-branch effort knows exactly what it touches. This documents present reality only — it does NOT design multi-branch (that stays `BR-U-002`, unresolved).

**Owner intent:** owner picked option A — do #3, leave #1 (system KPI, a business decision) and #2 (role matrix, `BR-U-003`) as-is, then push.

**Architecture:** One new Vietnamese doc, `docs/01-system/MULTI-BRANCH-IMPACT.md`, derived from the code — not a design. It separates two distinct changes the owner might mean by "add a branch": (a) another **outlet sharing the one warehouse** (largely already supported — the sales/order/report layer is outlet-aware), and (b) another **branch with its own separate stock** (a schema project — the inventory/cost layer has no outlet dimension). Each with the concrete tables/files involved.

**Tech Stack:** Markdown only. Verification: all gates + build.

**Spec / context:** `BR-U-002` (multi-brand/outlet/franchise unresolved), `BR-SALE-006` (the thin-slice multi-outlet already shipped), `SYSTEM-OVERVIEW.md:14` (shared warehouse), memory `long-term-roadmap-direction` (franchise is the last, uncertain phase).

## Global Constraints

- **Docs only; no code.** Current-state description, not a design.
- **Every claim must be verified against the code by the implementer** — this is an impact map; a wrong entry is worse than none. Re-run the scoping greps below; do not trust this plan's lists blindly.
- **Keep all gates green:** the new doc is scanned by line-ceiling (<=200 lines), docs-refs, paths-exist. Every repo path cited must exist and be written repo-relative (never leading-slash).
- **No fabrication / no design:** describe what IS hardcoded to one-shop; do not propose the multi-branch schema. Point unresolved design at `BR-U-002`.

---

## Current-state description (mandatory, CLAUDE.md §1b)

1. **States:** each part of the system is either *outlet-aware* (carries an outlet/brand dimension today) or *single-warehouse* (global, no outlet dimension). The doc classifies both.
2. **Entry points:** none — a reference doc.
3. **In scope / excluded:** IN — enumerating the outlet-aware layer and the single-warehouse layer, and what "add an outlet on the shared warehouse" vs "add a branch with its own stock" each touches. OUT — designing multi-branch, any code change, permissions/staff-to-outlet design (`BR-U-002`, `BR-U-003`).
4. **Valid inputs / out-of-range:** every table/file named must be verified present in the code; a named path that does not exist fails paths-exist and is a wrong claim — remove it.
5. **Deliberately NOT served:** no migration proposal, no per-branch cost model design, no franchise model — those are `BR-U-002`.

**Measured 2026-09-04 (implementer: re-verify each):**
- **Outlet-aware today:** `outlets` and `brands` tables; `orders_v2.outlet_id` + server-derived `brand_id` (`BR-SALE-006`); the POS outlet picker (`/pos`); order code = outlet+date+sequence (`BR-SALE-006`); sales report outlet breakdown (`app/admin/reports/sales/OutletBreakdownSection.tsx`). No hardcoded `'001'/'002'` found in `app/`/`lib/` — outlet count is data-driven.
- **Single-warehouse (no outlet dimension):** `stock_issues`, `purchased_items`, `stocktake_sessions`, `stocktake_lines`, `stock_adjustments`, `issue_slips` carry no `outlet_id`; costing (`lib/issue-costing.ts`, `lib/issue-costing-inputs.ts`) has no outlet awareness; `SYSTEM-OVERVIEW.md:14` states the shared warehouse as policy.
- **Not scoped by outlet:** users/staff (no staff-to-outlet assignment — `BR-SALE-006`), permissions (`BR-U-003`).

---

## Task 1: Write the impact map

**Files:** Create `docs/01-system/MULTI-BRANCH-IMPACT.md`.

- [ ] **Step 1: Re-verify the scoping** (do not trust the plan's lists):
  - `grep -rnE "'00[12]'|hai điểm bán|two outlets" app lib components --include="*.ts" --include="*.tsx" | grep -v test` (expect none — outlet count is data).
  - For each of `stock_issues`, `purchased_items`, `stocktake_sessions`, `stocktake_lines`, `stock_adjustments`, `issue_slips`: confirm the CREATE (and any ALTER) has no `outlet_id` in `supabase/migrations/`.
  - Confirm `orders_v2` has `outlet_id`/`brand_id` and `lib/issue-costing*.ts` reference no outlet.
  - Note any discrepancy vs the plan's measured lists in the report.
- [ ] **Step 2: Write `docs/01-system/MULTI-BRANCH-IMPACT.md`** (Vietnamese), <=200 lines, structured:
  - **Intro:** this is a current-state impact map, not a design; the multi-branch decision itself is `BR-U-002`. Link `SYSTEM-OVERVIEW.md`, `docs/02-rules/business-rules/unresolved.md`.
  - **Two meanings of "add a branch":** define case (a) another outlet, shared warehouse; case (b) a branch with its own stock.
  - **Case (a) — mostly data, already supported:** a table of what it touches — add an `outlets` row + a `brands` row; the outlet picker, order code, and outlet-breakdown report already handle N outlets. Cite the real tables/files/rules.
  - **Case (b) — a schema project:** a table listing exactly the single-warehouse tables + costing files that would each need an outlet/branch dimension (the 6 tables + `lib/issue-costing*.ts`), plus the shared-warehouse policy line to revisit (`SYSTEM-OVERVIEW.md:14`). State plainly this is `BR-U-002` and not designed here.
  - **Not scoped by outlet:** users/permissions (`BR-U-003`), staff-to-outlet (`BR-SALE-006`).
  - Every path repo-relative; every table/file cited must exist.
- [ ] **Step 3: Cross-link:** add one line in `SYSTEM-OVERVIEW.md` (near the shared-warehouse paragraph ~line 14) or its "đọc tiếp" table pointing to `docs/01-system/MULTI-BRANCH-IMPACT.md`. Keep `SYSTEM-OVERVIEW.md` <=200 lines.
- [ ] **Step 4: Verify** — `npx vite-node scripts/check-rules-current.ts` (paths-exist PASS), `npx vite-node scripts/doc-checks/run-blocking.ts` (line-ceiling + docs-refs PASS, all 7 [docs] PASS), `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- [ ] **Step 5: Commit** — `git commit -m "docs: add multi-branch extensibility impact map (audit gap #3)"`.

## Task 2: Final verification

- [ ] **Step 1:** all five gate commands green; 7 `[docs] PASS`.
- [ ] **Step 2:** Report in Vietnamese: the doc added, the two cases it distinguishes, and confirmation that it only describes current state (multi-branch design remains `BR-U-002`).

---

## Self-Review

**Coverage:** audit point-7 gap ("add a branch touches how many places") → Task 1. **No fabrication:** current-state only, verified by re-run greps; design deferred to `BR-U-002`. **Gate safety:** line-ceiling on the new + edited doc; paths-exist on every cited path (Step 1 re-verifies existence). **Simplicity:** one doc, two clearly separated cases, no new tooling.
