# Phase 10 — Pre-push doc completion (table dictionary + undocumented components)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps `- [ ]`. Critique before coding. **If any tool call is blocked, STOP and report — never re-run the same command through a different tool.**

**Goal:** Close the two real doc gaps the 20-question audit found (2 undocumented Edge Functions, 4 undocumented API routes) and create the owner-requested table-name to business-concept dictionary (audit Q9) — so the docs fully track the code before the whole cleanup mach is pushed.

**Owner intent:** owner asked for the "tên bảng ↔ khái niệm" mapping ("làm") and for a clean docs-track-code state before pushing.

**Architecture:** Pure documentation. Task 1 adds a table dictionary. Task 2 documents the 3 Edge Functions' full set and the 4 API routes in an existing system doc. No code changes. All eight doc/gate checks must stay green.

**Tech Stack:** Markdown only; verification via the existing gates + build.

**Spec:** owner principle memory `no-dead-points-everything-current`; reset design `docs/superpowers/specs/2026-09-02-project-reset-design.md`.

## Global Constraints

- **Docs only; no code.** `scripts/`/code untouched.
- **Keep all gates green:** tsc, vitest, check-rules-current, run-blocking (7 checks), build. New docs are scanned by line-ceiling (<=200 lines), docs-refs, paths-exist — respect all.
- **Every path written in these docs uses repo-relative style** (`app/...`, `supabase/...`), never leading-slash URLs (CLAUDE.md convention, or check-rules-current reds).
- **No em-dashes-as-data / no fabricated facts:** derive each table's purpose from its migration + existing business-rule docs, not invention.

---

## Current-state description (mandatory, CLAUDE.md §1b)

1. **States:** each system component is either *documented* (appears in a system/workflow/ops doc) or *undocumented*. Audit found: 2 of 3 Edge Functions undocumented (`backup-to-sheets`, `user-admin`), 4 of 4 API routes undocumented, and no table->concept bridge exists.
2. **Entry points:** none new. These are reference docs.
3. **In scope / excluded:** IN — a table dictionary (47 tables), documenting the 3 Edge Functions and 4 API routes. OUT — code, gates, the minor audit items deferred to the owner (doc-link guard gate, trigger name-inventory, 7 untested trivial modules, 4 TODO markers), extending route-coverage to API routes (owner may decide later).
4. **Valid inputs / out-of-range:** each of the 47 tables gets exactly one row; each Edge Function and API route gets one line. A table with no derivable purpose -> mark "internal/plumbing", never invent a business meaning.
5. **Deliberately NOT served:** not re-documenting the 33 already-covered page routes; not a full schema DDL dump (columns) — concept-level only.

**Looked at:** the audit measurements (47 tables reconciled, 3 edge functions, 4 api routes, FK/enum/rpc all clean). **Not looked at:** per-column schema — out of scope (concept-level dictionary only).

---

## Task 1: Table dictionary (audit Q9)

**Files:** Create `docs/01-system/TABLE-DICTIONARY.md`.

- [ ] **Step 1:** List all 47 tables: `grep -rhioE "create table (if not exists )?public\.[a-z_]+" supabase/migrations | sed -E 's/.*public\.//' | sort -u` (exclude the 2 dropped: confirm the list equals the map's 47).
- [ ] **Step 2:** Write `docs/01-system/TABLE-DICTIONARY.md`: a short intro (this bridges English DB table names to the Vietnamese business concepts used in `docs/02-rules/GLOSSARY.md`), then a 3-column Markdown table — `Table | Khái niệm (VN) | Vai trò (1 dòng)`. Derive each concept from the table's migration + `docs/02-rules/business-rules/*` + `GLOSSARY.md`. For pure plumbing tables (`sync_state`, `data_migration_runs`, `data_recovery_changes`, `backdated_ledger_events`, `backdated_recipe_events`, `pos_sync_failures`, `pos_drafts`), label them "hạ tầng/kỹ thuật" with a one-line role, do not invent business meaning. Keep the whole file <= 200 lines.
- [ ] **Step 3:** Cross-link: add one line in `docs/02-rules/GLOSSARY.md` pointing to `docs/01-system/TABLE-DICTIONARY.md` for the DB-name lookup (repo-relative path). Confirm GLOSSARY stays <= 200 lines.
- [ ] **Step 4: Verify** — `npx vite-node scripts/check-rules-current.ts` (paths-exist PASS — the new file's any cited paths resolve), `npx vite-node scripts/doc-checks/run-blocking.ts` (line-ceiling PASS incl. the new file, docs-refs PASS). tsc + vitest unaffected.
- [ ] **Step 5: Commit** — `git commit -m "docs: add DB table -> business-concept dictionary (audit Q9)"`.

## Task 2: Document the Edge Functions and API routes

**Files:** modify `docs/01-system/SYSTEM-OVERVIEW.md` (or `docs/03-workflows/operations.md` if SYSTEM-OVERVIEW would exceed 200 lines — pick the one with room; state which).

- [ ] **Step 1:** Determine each component's real purpose by reading the source: Edge Functions `supabase/functions/backup-to-sheets/`, `supabase/functions/user-admin/`, `supabase/functions/backup-to-drive/` (already documented — include for completeness); API routes `app/api/auth/[...nextauth]/route.ts`, `app/api/client-errors/route.ts`, `app/api/dev-feedback/route.ts`, `app/api/revalidate/route.ts`.
- [ ] **Step 2:** Add a short "Server components outside the page flows" section (Vietnamese) listing: the 3 Edge Functions (name + one-line purpose + repo path) and the 4 API routes (path + one-line purpose). Keep the host doc <= 200 lines; if SYSTEM-OVERVIEW has no room, put it in `docs/03-workflows/operations.md` and note it.
- [ ] **Step 3: Verify** — all gates green (line-ceiling on the edited doc especially; docs-refs; paths-exist for the repo paths cited).
- [ ] **Step 4: Commit** — `git commit -m "docs: document the 3 edge functions and 4 API routes (audit Q8/Q9)"`.

## Task 3: Final verification

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts && npm run build` — all green, 7 `[docs] PASS`.
- [ ] **Step 2:** `git status` clean. Report to owner in Vietnamese: the dictionary added (47 tables), the 2+4 components now documented, all gates green — docs now fully track code, ready for the push review.

---

## Self-Review

**Coverage:** audit Q9 (table dictionary) -> Task 1; audit Q8 edge functions + Q9 api routes -> Task 2. **Simplicity:** concept-level only, no schema dump, no new gate. **Gate safety:** line-ceiling is the main risk (new/edited docs) — each task checks it; placement falls back to a doc with room. **No fabrication:** purposes derived from source, plumbing tables labeled as such.
