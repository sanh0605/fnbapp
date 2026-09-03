# Phase 8 — Route-coverage gate + dead-mock cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`. Critique before coding (CLAUDE.md §1).

**Goal:** Make "docs always track code" machine-enforced for new screens (owner 2026-09-04: docs must never fall behind what is built) — add a `route-coverage` check that reds when a real page route has no flow doc — and remove the two dead `vi.mock` references to the deleted `lib/historical`.

**Owner intent:** the owner delegated the mechanism ("anh không hiểu, chỉ cần tài liệu luôn cập nhật kịp thời... cái nào lạc hậu thì xoá"). This delivers that for the "new feature, no doc" gap and clears the last dead pointers.

**Architecture:** Two independent, small tasks. (A) delete two inert `vi.mock` calls whose target module no longer exists. (B) a new `route-coverage` check in `scripts/doc-checks/`, wired into `run-blocking.ts` as a sixth `[docs]` line: every route from `listAllPageRoutes` must be declared in some flow doc's `routes:` block, UNLESS its page file is a pure redirect (auto-detected — no hand-maintained exempt list). Measured today: 33/35 routes covered; the 2 uncovered (`/`, `/admin/inventory`) are both redirect-only, so the redirect rule makes B green with no new docs needed.

**Tech Stack:** TypeScript, vite-node, vitest, `CheckResult` from `scripts/check-result.ts`, `listAllPageRoutes` from `lib/nav-completeness`, `parseFlowDecl` from `scripts/doc-checks/flow-doc-core`.

**Spec:** reset design `docs/superpowers/specs/2026-09-02-project-reset-design.md`; owner principle in memory `no-dead-points-everything-current`.

## Global Constraints

- **`scripts/` and app edits go through the implementer; Opus reviews and runs gates independently.**
- **Keep every gate green after each task:** `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- **A new check must be shown RED before GREEN** (CLAUDE.md §9), stating whether red is by missing function or by value.
- Comment/test-only + the new check files. No logic, no production data.

---

## Current-state description (mandatory, CLAUDE.md §1b)

1. **States:** a page route is *covered* (declared in a flow doc), *redirect-only* (its page body is just `redirect(...)`), or *uncovered* (a real screen with no doc — the failure state B must catch). Measured now: 33 covered, 2 redirect-only (`/` → /admin or /login; `/admin/inventory` → /admin/inventory/categories), 0 truly uncovered.
2. **Entry points:** none new for users. B adds one pre-commit line `[docs] PASS/FAIL route-coverage`.
3. **In scope / excluded:** IN — the `route-coverage` check + wiring; removing the 2 dead mocks. OUT — write-file coverage (routes only — that is what "a new screen" means), COGS/inventory logic, production data, any hand-maintained exempt list.
4. **Valid inputs / out-of-range:** a route is valid iff declared in some flow doc's `routes:` OR its page file is redirect-only. A real screen with neither → red.
5. **Deliberately NOT served:** B does not force a flow doc for redirect-only pages (they have no flow), does not check write-path files, and uses no hand list — redirect detection is from source.

**Looked at:** `listAllPageRoutes` (35 routes), the 7+ flow docs' `routes:` blocks (33 covered), `app/page.tsx` and `app/admin/inventory/page.tsx` (both pure `redirect(...)`), the `doc-checks` wiring in `run-blocking.ts`.
**Not looked at:** each flow doc's prose accuracy (out of scope — B checks declaration coverage, not prose truth).

---

## Task A: Remove the two dead vi.mock references

**Files:** `app/actions/auth.test.ts`, `app/pos/actions.auth.test.ts`.

- [ ] **Step 1:** Delete the `vi.mock("@/lib/historical/sheets", () => ({ ... }))` block in `app/actions/auth.test.ts:20` and the `vi.mock("@/lib/historical/pos-inventory-state", () => ({ ... }))` block in `app/pos/actions.auth.test.ts:30`. The modules under test no longer import these paths, so the mocks are inert.
- [ ] **Step 2: Verify** — `npx vitest run app/actions/auth.test.ts app/pos/actions.auth.test.ts` (both green), then `npx tsc --noEmit` (0). If either test now fails, the code DID still resolve that module — stop and investigate (should not happen; module is deleted).
- [ ] **Step 3: Commit** — `git commit -m "test: drop dead vi.mock refs to deleted lib/historical modules (Phase 8)"`.

## Task B: route-coverage gate

**Files:** Create `scripts/doc-checks/route-coverage-core.ts`, `scripts/doc-checks/route-coverage-core.test.ts`; Modify `scripts/doc-checks/run-blocking.ts`.

**Interfaces:** Produces `export function checkRouteCoverage(routes: string[], coveredRoutes: Set<string>, isRedirectOnly: (route: string) => boolean): CheckResult` — `check` is `"route-coverage"`.

- [ ] **Step 1: Write the failing test** `route-coverage-core.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { checkRouteCoverage } from "./route-coverage-core";

describe("checkRouteCoverage", () => {
  const covered = new Set(["/admin/inventory/items"]);
  const noRedirect = () => false;
  it("passes a route declared in a flow doc", () => {
    expect(checkRouteCoverage(["/admin/inventory/items"], covered, noRedirect).ok).toBe(true);
  });
  it("flags a real screen with no flow doc", () => {
    const r = checkRouteCoverage(["/admin/reports/new"], covered, noRedirect);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("/admin/reports/new");
  });
  it("exempts a redirect-only page automatically", () => {
    expect(checkRouteCoverage(["/"], covered, route => route === "/").ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL by missing function** — `npx vitest run scripts/doc-checks/route-coverage-core.test.ts`.

- [ ] **Step 3: Implement** `route-coverage-core.ts`:

```typescript
import type { CheckResult } from "../check-result";

export function checkRouteCoverage(
  routes: string[],
  coveredRoutes: Set<string>,
  isRedirectOnly: (route: string) => boolean,
): CheckResult {
  const problems = routes
    .filter(r => !coveredRoutes.has(r) && !isRedirectOnly(r))
    .map(r => `${r} is a page route with no flow doc — add it to a docs/03-workflows/*.md routes: block, or (if it is a redirect) it is exempt automatically`);
  return { check: "route-coverage", ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run test, expect PASS** — 3 passing.

- [ ] **Step 5: Wire into `run-blocking.ts`.** Build `coveredRoutes` from every flow doc's `parseFlowDecl(...).routes` (the code already parses decls for flow-doc-facts — reuse `decls`). Implement `isRedirectOnly(route)`: map the route to its `app/.../page.tsx` (reuse `lib/nav-completeness` route→file logic if exported; else derive by walking `app/` page files as `listAllPageRoutes` does), read it, and return true iff its source calls `redirect(` and contains no JSX return (`return (` / `return <`). Push `checkRouteCoverage(listAllPageRoutes(root), coveredRoutes, isRedirectOnly)` into `results`.

- [ ] **Step 6: RED-before-green proof.** First wire it WITHOUT the redirect exemption (pass `() => false`) and run `npx vite-node scripts/doc-checks/run-blocking.ts` → expect `[docs] FAIL route-coverage` listing exactly `/` and `/admin/inventory` (red by value). Then enable `isRedirectOnly` and re-run → `[docs] PASS route-coverage`. Record both in the report.

- [ ] **Step 7: Verify all gates** — tsc 0, vitest green (now +3 tests), check-rules PASS, run-blocking all 6 `[docs]` PASS, `npm run build`.

- [ ] **Step 8: Commit** — `git commit -m "feat(docchecks): route-coverage gate — a new screen with no flow doc reds the build (Phase 8)"`.

## Task C: Final verification

- [ ] **Step 1:** all five gate commands green, run-blocking shows 6 PASS lines.
- [ ] **Step 2:** Prove the guard bites for a REAL screen: temporarily add a throwaway `app/admin/__probe/page.tsx` that returns JSX (not a redirect), run run-blocking → `route-coverage` reds naming `/admin/__probe`; delete the probe; re-run → green. Report this.
- [ ] **Step 3:** Report to owner in Vietnamese: dead mocks gone; from now a new screen without documentation reds the build automatically; redirect pages are exempt automatically (no hand list); nothing to write today because coverage was already complete.

---

## Self-Review

**Spec/intent coverage:** "docs never fall behind new screens" → Task B; "no dead points" residue → Task A. **Red-before-green:** Task B Step 2 (missing function) + Step 6 (by value) + Task C Step 2 (bites a real screen). **Simplicity:** routes-only, redirect auto-detect, no hand list. **Type consistency:** `checkRouteCoverage` returns `CheckResult` matching the other checks in `run-blocking.ts`.
