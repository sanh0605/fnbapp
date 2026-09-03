# Phase 9 — Delete 3 dead modules + add an orphan-module gate

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Critique before coding (CLAUDE.md §1). This deletes COGS-adjacent code — re-verify the "imported by nothing" claim before each `git rm`.

**Goal:** Remove three modules the running system never imports (`lib/mac-cogs.ts`, `lib/order-cogs-fifo.ts`, `lib/order-code.ts`) and add an `orphan-modules` gate so a `lib/` module used by nothing but its own test reds the build — the machine enforcement of the owner's "no dead points" for code (owner approved 2026-09-04).

**Owner decision:** "Xoá + thêm cửa chặn tái phát."

**Due diligence (measured 2026-09-04, re-verify):** none of the three is imported by any file except its own test. Live COGS is `lib/issue-costing*` + `lib/purchase-order-cost-allocation.ts` (so `mac-cogs` = superseded moving-average, `order-cogs-fifo` = superseded FIFO). Order codes are minted DB-side (migration `0072_outlet_order_no_minting`), so `lib/order-code.ts` (client-side generator) is superseded. Only stray mention: a comment in `lib/inventory-consumption.ts:41` names `mac-cogs-audit` (a lib/historical module already deleted) — clean that comment too.

**Architecture:** Task A deletes the 3 modules + their tests + the stale comment. Task B adds `orphan-modules` to `scripts/doc-checks/`, wired into `run-blocking.ts` as a seventh `[docs]` line. The check builds the import graph over `app/`, `lib/`, `components/`, `scripts/`, `supabase/` (non-test) and flags any `lib/` module reachable from nothing but its own test. Redirect/entry files are not in `lib/`, so no entry-point exemption is needed; a rare legitimate standalone carries an inline `orphan-allow: <reason>` marker.

**Tech Stack:** TypeScript, vite-node, vitest, `CheckResult`.

**Spec:** owner principle memory `no-dead-points-everything-current`; reset design `docs/superpowers/specs/2026-09-02-project-reset-design.md`.

## Global Constraints

- **`scripts/` and `lib/` edits go through the implementer; Opus reviews and runs gates independently.**
- **Keep every gate green after each task** (7 `[docs]` lines after Task B): tsc, vitest, check-rules-current, run-blocking, build.
- **New check RED before GREEN** (CLAUDE.md §9): run `orphan-modules` before Task A's deletion → it must flag exactly the 3 (red by value). After deletion → green. Prove it bites by adding a throwaway unused `lib/` module.
- **Zero false positives:** before committing Task B, run the check against the FULL current `lib/` set and confirm it flags ONLY the 3 known orphans — no live module. If it flags a live module, the import resolution is wrong; fix it (handle `@/` alias, relative, and re-export/index imports) — do not add allow-markers to silence a real false positive.

---

## Current-state description (mandatory, CLAUDE.md §1b)

1. **States:** a `lib/` module is *reachable* (imported by some non-test file) or *orphan* (imported by nothing, or only its own test). Task A removes the 3 known orphans; Task B makes the state machine-checked.
2. **Entry points:** none for users. Task B adds `[docs] PASS/FAIL orphan-modules`.
3. **In scope / excluded:** IN — delete the 3 modules + tests + the stale comment; the `orphan-modules` check. OUT — `supabase/migrations/*` (immutable applied record — their comments citing a deleted plan doc are history, NOT edited here), any live logic, production data.
4. **Valid inputs / out-of-range:** a `lib/` module is valid iff imported by ≥1 non-test file OR carries `orphan-allow: <reason>`. Otherwise the gate reds.
5. **Deliberately NOT served:** the gate covers `lib/` only (where pure logic lives); it does not police `app/`/`components/` (those are route/JSX entry points Next.js loads implicitly) nor `scripts/` (CLI entry points); it does not scan migrations.

**Looked at:** the 3 modules' importer sets (only own tests), the live COGS/order-code paths, the one stale comment. **Not looked at:** whether deleting these unlocks further transitive orphans — Task B's post-deletion run reveals any, handled then.

---

## Task A: Delete the three dead modules

**Files:** delete `lib/mac-cogs.ts`, `lib/mac-cogs.test.ts`, `lib/order-cogs-fifo.ts`, `lib/order-cogs-fifo.test.ts`, `lib/order-code.ts`, `lib/order-code.test.ts`; modify `lib/inventory-consumption.ts` (stale comment).

- [ ] **Step 1: Re-verify** each module is imported by nothing but its own test: `grep -rnE "from ['\"][^'\"]*(mac-cogs|order-cogs-fifo|order-code)['\"]|import\(['\"][^'\"]*(mac-cogs|order-cogs-fifo|order-code)['\"]" app lib components scripts supabase --include="*.ts" --include="*.tsx" | grep -vE "(mac-cogs|order-cogs-fifo|order-code)\.(ts|test\.ts):"`. Expect empty. If not, STOP.
- [ ] **Step 2:** `git rm` the six files.
- [ ] **Step 3:** `lib/inventory-consumption.ts:41` — remove `mac-cogs-audit` (and any other now-deleted module name) from the "Shared by ..." comment; keep the still-live names. Comment-only.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` (0 — nothing imported them), `npx vitest run` (green; 6 fewer tests), all gates PASS, `npm run build`.
- [ ] **Step 5: Commit** — `git commit -m "chore(lib): remove superseded dead modules mac-cogs, order-cogs-fifo, order-code (Phase 9)"`.

## Task B: orphan-modules gate

**Files:** Create `scripts/doc-checks/orphan-modules-core.ts`, `scripts/doc-checks/orphan-modules-core.test.ts`; Modify `scripts/doc-checks/run-blocking.ts`.

**Interfaces:** `export function checkOrphanModules(libModules: string[], importedModules: Set<string>): CheckResult` — `check` is `"orphan-modules"`. `libModules` = repo-relative `lib/**/*.ts` (excluding `*.test.ts`); `importedModules` = the set of module repo-paths imported by any non-test file. A module is orphan iff not in `importedModules` and its source lacks `orphan-allow`.

- [ ] **Step 1: Write the failing test** `orphan-modules-core.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { checkOrphanModules } from "./orphan-modules-core";

describe("checkOrphanModules", () => {
  it("passes a module that is imported somewhere", () => {
    const r = checkOrphanModules([{ path: "lib/a.ts", content: "export const a=1" }], new Set(["lib/a.ts"]));
    expect(r.ok).toBe(true);
  });
  it("flags a module imported by nothing", () => {
    const r = checkOrphanModules([{ path: "lib/dead.ts", content: "export const d=1" }], new Set());
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("lib/dead.ts");
  });
  it("honors an orphan-allow marker", () => {
    const r = checkOrphanModules([{ path: "lib/tool.ts", content: "// orphan-allow: standalone CLI helper\nexport const t=1" }], new Set());
    expect(r.ok).toBe(true);
  });
});
```

(Signature note: `checkOrphanModules(modules: {path, content}[], imported: Set<string>)`. Adjust the Interfaces line to match this shape.)

- [ ] **Step 2: Run, expect FAIL by missing function.**
- [ ] **Step 3: Implement** `orphan-modules-core.ts`:

```typescript
import type { CheckResult } from "../check-result";

const ALLOW = "orphan-allow";

export function checkOrphanModules(
  modules: { path: string; content: string }[],
  imported: Set<string>,
): CheckResult {
  const problems = modules
    .filter(m => !imported.has(m.path) && !m.content.includes(ALLOW))
    .map(m => `${m.path} is a lib module imported by nothing but (at most) its own test — delete it or mark it "${ALLOW}: <reason>"`);
  return { check: "orphan-modules", ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5: Wire into `run-blocking.ts`.** Walk `lib/` for non-test `.ts` → `modules`. Build `imported`: scan every non-test `.ts`/`.tsx` under `app`, `lib`, `components`, `scripts`, `supabase`, extract each import/`import(...)`/`vi.mock` specifier, resolve it to a repo path against `lib/` (handle `@/lib/x`, relative `./x`/`../x`, with/without `.ts`, and `index.ts` re-exports), and add the resolved `lib/...ts` path to `imported`. A module imported only by its own same-named `.test.ts` must NOT count as imported (exclude test files from the scan). Push `checkOrphanModules(modules, imported)`.
- [ ] **Step 6: RED-before-green + no-false-positive proof.** BEFORE Task A is committed is not possible (A already ran); instead, on the current post-A tree, temporarily recreate one orphan (a throwaway `lib/__probe.ts` with `export const x=1`, imported by nothing) and run `npx vite-node scripts/doc-checks/run-blocking.ts` → `[docs] FAIL orphan-modules` naming `lib/__probe.ts`. Delete the probe → PASS. ALSO: run the check across the real `lib/` and confirm it reports **zero** orphans (the 3 are already deleted) — proving no live module is false-flagged. Record both.
- [ ] **Step 7: Verify all 7 gates + build.**
- [ ] **Step 8: Commit** — `git commit -m "feat(docchecks): orphan-modules gate — an unused lib module reds the build (Phase 9)"`.

## Task C: Final verification

- [ ] **Step 1:** all five gate commands green; run-blocking shows 7 `[docs] PASS` lines.
- [ ] **Step 2:** Report to owner in Vietnamese: 3 dead modules removed (nothing used them; git keeps them), and from now an unused `lib/` module reds the build automatically; new (lower) test count; all gates green.

---

## Self-Review

**Coverage:** owner "delete 3 + gate" → Tasks A + B. **Red-before-green:** B Step 2 (missing fn) + Step 6 (by value via probe) + the zero-false-positive sweep. **Simplicity:** lib-only, one inline marker for rare standalones, no central list. **Risk:** COGS-adjacent but provably unimported — deletion changes no behavior, git retains; Step 1 re-verifies immediately before `git rm`. **Type consistency:** `checkOrphanModules` returns `CheckResult` like the others.
