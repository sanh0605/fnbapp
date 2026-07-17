# Task: Pre-Audit B Execution — Refresh/Create 10 Canonical Documents

## Context

Owner approved all 8 decisions (D1-D8) in `docs/audits/2026-07-17-pre-audit-b-owner-decisions.md`. Pre-Audit B proposal complete (commit `8016ae8`).

This task: **execute** the proposal. Actually write/refresh the 10 canonical documents per the approved structure.

## Goal

Following the proposed execution sequence (Section "Proposed execution sequence after owner approval" in proposal), execute all 7 steps:

1. D1-D8 decisions already recorded (commit pending — this task will commit the decisions file as part of execution).
2. Rewrite foundational navigation: README, CONTEXT, ARCHITECTURE, TESTING.
3. Create BUSINESS-RULES and ACCESS-MODEL (with INTENDED/OBSERVED/VERIFIED distinctions).
4. Refresh ROADMAP, COMPLETED, COLLABORATION (no historical rewrite).
5. Create FEATURE-CATALOG contract (detailed status deferred to Pre-Audit C).
6. Add banners to 8 superseded files + 1 duplicate; update live incoming links.
7. Path/link checks, TS/build gates, request review.

## Detailed scope per document

### Tier 1 — Foundational rewrites (4 files, biggest changes)

#### `README.md` (rewrite in place, currently SUPERSEDED)
- Remove old "vanilla HTML/CSS/JS, GitHub Pages, localStorage auth" description.
- New content per proposal Section 1:
  - Product overview (F&B POS for beverage business, current operating scope = 1 shop per D1).
  - High-level capabilities + link to FEATURE-CATALOG.
  - Runtime stack: Next.js 14, React 18, TypeScript, NextAuth credentials (per correction — NOT Supabase Auth), Supabase Postgres + RPC + Edge Functions, Vercel, Google Drive backup.
  - Local setup: prerequisites, env var NAMES (no secrets), install, dev, test, build commands.
  - Safety notes: production writes, migrations, backup/restore, no-push protocol.
  - Canonical documentation map (links to other 9 docs).

#### `CONTEXT.md` (rewrite in place, currently HISTORICAL_EVIDENCE)
- New content per proposal Section 2:
  - Business + customer context (beverage F&B, mobile cart/takeaway).
  - Current operating model: 1 brand, 1 shop/outlet (per D1).
  - Success measures (business terms).
  - In-scope + explicitly out-of-scope business capabilities.
  - Terminology summary linking domain-dictionary.md.
  - Decision authority + links to BUSINESS-RULES, ROADMAP, historical evidence.

#### `ARCHITECTURE.md` (rewrite or create)
- New content per proposal Section 3:
  - Runtime architecture diagram (text-based if no visual).
  - Environments: local dev, Vercel production.
  - Integrations: Supabase Postgres, NextAuth (credentials), Edge Functions, Google Drive backup, Apps Script trigger.
  - Trust boundaries: middleware (auth check for /admin, /pos), server actions, RLS (note: verification in Phase 3).
  - Major modules: POS, admin (orders, products, inventory, reports, audit), backup, auth.
- DO NOT claim Supabase Auth or Supabase Storage usage (per D5 correction).

#### `docs/TESTING.md` (rewrite in place, currently HISTORICAL_EVIDENCE)
- Current state: 131-line manual checklist from 2026-04-21 (outdated).
- New content per proposal:
  - Test strategy: Vitest + jsdom, TypeScript check, build.
  - Commands: `npm test`, `npx tsc --noEmit`, `npm run build`.
  - Environments: local, Husky pre-commit hook.
  - Known gaps: no E2E/Playwright yet, no integration tests for some flows.
  - Manual critical-flow section: only scenarios Pre-Audit C confirms still exist (per D7). Git history preserves April checklist.

### Tier 2 — New documents (3 files, create from scratch)

#### `docs/FEATURE-CATALOG.md` (new)
- Contract/template only for now (detailed status deferred to Pre-Audit C).
- Structure:
  - Module groupings per Pre-Audit C capability checklist (auth, brand/outlet, POS, menu, recipes, purchasing, production, inventory, orders, reports, backup, etc.).
  - For each module: business purpose, intended users, current UI entry points, status (`LIVE_VERIFIED` / `LIVE_UNVERIFIED` / `PARTIAL` / `PLANNED` / `DEFERRED` / `RETIRED` per D6).
  - Note: "Statuses to be populated from Pre-Audit C evidence."

#### `docs/BUSINESS-RULES.md` (new)
- Per proposal:
  - Approved operational rules: MAC COGS standard, snapshot policy, ledger types, backdating policy, retention policies.
  - Unresolved items clearly marked `UNRESOLVED`.
  - Source material: domain-dictionary.md, MAC design spec, BTP drift policy, backup policy.

#### `docs/ACCESS-MODEL.md` (new)
- Per D3:
  - Business roles: owner, admin, cashier, inventory (intended vocabulary).
  - Mapping to technical roles: ADMIN, STAFF, SYSTEM (current code).
  - Brand/outlet scope (currently 1/1 per D1).
  - Preliminary permissions matrix (intended vs observed vs verified).
  - NOTE: "Enforcement verified in Phase 3 security audit."

### Tier 3 — Refresh existing (3 files, lighter touch)

#### `docs/ROADMAP.md` (refresh)
- Already mostly current. Light refresh:
  - Remove Pre-Audit A/B from P1 (move to COMPLETED).
  - Add Pre-Audit B Execution as completed.
  - Add Pre-Audit C as next P1.
- Do NOT rewrite history.

#### `docs/COMPLETED.md` (refresh)
- Add Pre-Audit A + Pre-Audit B (proposal + decisions) + Pre-Audit B Execution entries.
- Keep chronological format.

#### `docs/COLLABORATION.md` (refresh)
- Already mostly current (recently strengthened Section I).
- Add references to new canonical docs (FEATURE-CATALOG, BUSINESS-RULES, ACCESS-MODEL, TESTING) in Section A "File Map".
- No structural changes.

### Tier 4 — Banners + link updates (9 files)

8 SUPERSEDED docs from Pre-Audit A manifest + 1 DUPLICATE:
- Add `> **SUPERSEDED**: This document is historical. Current source: [link]` banner at top.
- Update live incoming links (grep + replace) to point to canonical successor.
- DO NOT delete or move any file (per D8).

Specific files: per Pre-Audit A manifest SUPERSEDED + DUPLICATE entries.

## Owner decisions reference

Each canonical doc must reflect the relevant D1-D8 decisions:
- README: D1, D2, D5
- CONTEXT: D1, D2, D5
- ARCHITECTURE: D5 (NextAuth correction)
- TESTING: D7
- FEATURE-CATALOG: D6
- BUSINESS-RULES: D4 (Tier 2 authority)
- ACCESS-MODEL: D3
- ROADMAP: D1 (multi-brand/outlet deferred)
- COMPLETED: standard refresh
- COLLABORATION: standard refresh

## Scope

### In scope

1. Execute all 7 steps from proposal sequence.
2. Modify/create 10 canonical documents per specs above.
3. Add banners to 9 historical files (8 SUPERSEDED + 1 DUPLICATE).
4. Update live incoming links to canonical successors.
5. Commit decisions file (`docs/audits/2026-07-17-pre-audit-b-owner-decisions.md`).
6. Path/link verification.
7. TS/build gates.

### Out of scope

- Do NOT begin Pre-Audit C (feature inventory) — separate task.
- Do NOT begin Phase 0 beyond what's contained (diagnose-order already done).
- Do NOT modify any audit JSON / handoff briefs / historical plans (Tier 3 preserved).
- Do NOT push to remote.

## Constraints

- **Preserve history**: never delete or move files (per D8). Banners + link updates only.
- **Tier 1 entries link to Tier 2/3**: do NOT duplicate specialized policy content (MAC details, backup policy, etc.) into Tier 1.
- **Language policy per D5**: Vietnamese for owner-facing, English for technical detail. One language per section.
- **NextAuth correction**: per proposal finding, system uses NextAuth credentials (not Supabase Auth). ARCHITECTURE.md must reflect this.
- **Atomic commits per logical group**: foundational rewrite (4 files) → new docs (3 files) → refresh (3 files) → banners (9 files). Suggest 4 commits total.
- **No push**: local commits only.
- **Verify links**: every link in canonical docs must resolve to existing file.

## Verification

1. `tsc --noEmit`: 0 errors.
2. `npm run build`: success.
3. `vitest run`: baseline pass (no test files modified, except possibly new fixtures).
4. **Path check**: all internal links in 10 canonical docs resolve to real files.
5. **Coverage check**: every Tier 1 doc has all required sections per proposal.
6. **Decision check**: each canonical doc reflects relevant D1-D8 decision.
7. **Banner check**: 8 SUPERSEDED + 1 DUPLICATE have banner at top.
8. **No deletion check**: `git diff --stat` shows no file deletions (only modifications + additions).
9. `git diff --check`: clean.

## Expected output

- 4 modified files: README.md, CONTEXT.md, ARCHITECTURE.md (create if missing), docs/TESTING.md.
- 3 new files: docs/FEATURE-CATALOG.md, docs/BUSINESS-RULES.md, docs/ACCESS-MODEL.md.
- 3 refreshed files: docs/ROADMAP.md, docs/COMPLETED.md, docs/COLLABORATION.md.
- 9 historical files modified (banners only): 8 SUPERSEDED + 1 DUPLICATE.
- 1 new file: docs/audits/2026-07-17-pre-audit-b-owner-decisions.md (decisions record).
- Commits (suggested):
  - `docs/audits/...: Pre-Audit B owner decisions record (D1-D8 approved)`
  - `Codex audit: Pre-Audit B execution - rewrite foundational docs (README, CONTEXT, ARCHITECTURE, TESTING)`
  - `Codex audit: Pre-Audit B execution - create new canonical docs (FEATURE-CATALOG, BUSINESS-RULES, ACCESS-MODEL)`
  - `Codex audit: Pre-Audit B execution - refresh ROADMAP, COMPLETED, COLLABORATION + superseded banners`
- Append DEVELOPMENT-TRACKING.md entries per commit.
- No push.

## Priority

P1 — execution phase. Codex pickup. ~2-3 sessions.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol High` — multi-file authoring with architectural decisions + cross-references + preservation rules.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Any D1-D8 decision appears ambiguous in application (would warrant owner re-clarification).
- A canonical doc requires information not available in current code/other docs (would push to Pre-Audit C first).
- Contradiction between current docs reveals unresolved business decision.
- A historical doc receives >5 incoming links (would warrant waiting for owner to confirm link update strategy).
- TS/build fails for non-trivial reason.
- An attempt to delete or move a file is made (violates D8).

## Questions before starting

- ARCHITECTURE.md: should it include a text-based diagram, or just describe modules in prose? Recommend PROSE for now, diagram later when accuracy verified.
- BUSINESS-RULES.md: list every MAC/COGS rule in detail, or summarize + link to MAC spec? Recommend SUMMARIZE + link (Tier 2 authority preserved).
- ACCESS-MODEL.md: include current code-level auth check inventory? Recommend NO for now (Phase 3 will do that). Just business roles + intended mapping.
- Decisions file commit: separate first, or bundle with first execution commit? Recommend SEPARATE first commit (cleaner attribution).
