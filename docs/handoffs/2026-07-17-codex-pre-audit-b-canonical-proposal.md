# Task: Pre-Audit B — Canonical Document Set Proposal (Read-Only)

## Context

Pre-Audit A complete (commit `f12725f`): 189 documents classified, P0 endpoint contained (commit `d1152d9`), password_hash leakage logged as SEC-1 for later.

Pre-Audit B: **propose** the canonical document set. Read-only investigation, NO file modifications yet. Owner reviews proposal, approves, THEN execution happens (separate task).

## Goal

Author a single proposal document that specifies, for each of the 10 canonical documents:
- Current state (exists/missing)
- Proposed structure (sections, what goes where)
- Source material to consolidate
- Decisions needed from owner

Plus: handling plan for SUPERSEDED (8 docs) and DUPLICATE (1 doc).

Output: `docs/audits/2026-07-17-pre-audit-b-canonical-proposal.md`. Read-only — no doc modifications.

## Canonical document set (per spec)

10 documents to define in proposal:

### 1. `README.md`
- Current state: check if exists, what it currently says
- Proposed content: product overview (F&B POS for beverage business), current stack (Next.js, Supabase, Vercel), setup steps, links to other canonical docs
- Source material: any existing README, package.json, current deployment

### 2. `CONTEXT.md`
- Current state: check if exists
- Proposed content: business context (multi-brand beverage, single-shop operation, mobile-cart/takeaway model), scope boundaries, terminology summary, owner decisions log reference
- Source material: `docs/domain-dictionary.md` (terminology), `CLAUDE.md` section 0 (collaboration files), prior business notes

### 3. `ARCHITECTURE.md`
- Current state: check if exists
- Proposed content: runtime architecture (Next.js app → Supabase Postgres + Auth + Storage + Edge Functions), Vercel deployment, integrations (Google Drive backup, Apps Script), trust boundaries, major modules (POS, admin, reports, audit, backup)
- Source material: code structure, supabase/migrations, env config, current deployment

### 4. `docs/FEATURE-CATALOG.md`
- Current state: missing (will be created in Pre-Audit C in detail; this proposal only outlines structure)
- Proposed structure: list of features with status (COMPLETE/PARTIAL/MISSING/etc.) — reference Pre-Audit C as the detailed source
- Source material: route inventory (`app/**`), scripts, components

### 5. `docs/BUSINESS-RULES.md`
- Current state: missing
- Proposed content: approved operational rules (MAC COGS standard, snapshot policy, ledger types, backdating policy, retention policies), unresolved items clearly marked
- Source material: `docs/domain-dictionary.md`, `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`, policy docs in `docs/audits/`

### 6. `docs/ACCESS-MODEL.md`
- Current state: missing
- Proposed content: intended roles (owner/admin/cashier/inventory), brand/outlet scope, preliminary permissions. NOTE: enforcement verified later in Phase 3 security audit.
- Source material: middleware.ts, server actions auth checks (CODE-22 in old audit), user table schema

### 7. `docs/ROADMAP.md`
- Current state: exists (extensive)
- Proposed: refresh — remove completed items, consolidate duplicate sections (already partially done), keep only pending work + backlog + out-of-scope
- Source material: current ROADMAP.md, COMPLETED.md (already moved items)

### 8. `docs/COMPLETED.md`
- Current state: exists (extensive, chronological)
- Proposed: refresh — keep as compact index linking to evidence in DEVELOPMENT-TRACKING.md
- Source material: current COMPLETED.md, DEVELOPMENT-TRACKING.md

### 9. `docs/TESTING.md`
- Current state: missing
- Proposed content: current test strategy (Vitest + jsdom), commands (`npm test`, `tsc --noEmit`, `npm run build`), environments (local, CI via Husky pre-commit), known gaps (no E2E/Playwright yet, no integration tests for some flows), coverage by area
- Source material: package.json scripts, .husky/pre-commit, vitest config, existing test files

### 10. `docs/COLLABORATION.md`
- Current state: exists, recently updated with Section I (communication style)
- Proposed: keep as-is, refresh slightly to reference new canonical docs (FEATURE-CATALOG, BUSINESS-RULES, ACCESS-MODEL, TESTING)
- Source material: current COLLABORATION.md

## Handling plan for SUPERSEDED docs (8 from Pre-Audit A)

For each SUPERSEDED doc (from Pre-Audit A manifest):
- Identify successor (one of 10 canonical docs above, or another existing doc)
- Specify transition: mark with `> **SUPERSEDED**: This document is historical. Current source: [link].` at top
- Update incoming links (grep + list which files reference it)
- Do NOT delete (preservation rule)

Output in proposal: table of 8 SUPERSEDED docs with successor + transition plan.

## Handling plan for DUPLICATE doc (1 from Pre-Audit A)

Identify the duplicate (from manifest). Determine:
- Which is the canonical (keep)
- Which is the duplicate (mark or merge)
- Plan merge if non-trivial differences

## Deletion candidates

Pre-Audit A reported 0 DELETE_CANDIDATE. Confirm this in proposal. If during Pre-Audit B investigation any new deletion candidates surface, list them with:
- File path
- Evidence of no references (grep results)
- Reason for deletion
- Owner approval required (default: keep until owner says delete)

## Scope

### In scope (read-only)

1. Read Pre-Audit A manifest (`docs/audits/2026-07-17-pre-audit-a-documentation-manifest.json` + `.md`).
2. For each of 10 canonical docs: investigate current state, draft proposed structure.
3. For each of 8 SUPERSEDED: identify successor, plan transition.
4. For 1 DUPLICATE: identify canonical, plan merge.
5. Verify DELETE_CANDIDATE = 0 (or flag any new candidates).
6. Identify owner decisions needed (questions for owner to answer before execution).

### Out of scope (explicit)

- Do NOT create/modify any canonical doc yet (execution in next task after approval).
- Do NOT move/archive/delete any file.
- Do NOT modify SUPERSEDED/DUPLICATE files yet.
- Do NOT push to remote.

## Output deliverable

### `docs/audits/2026-07-17-pre-audit-b-canonical-proposal.md`

Structure:

```markdown
# Pre-Audit B — Canonical Document Set Proposal

Date: 2026-07-17
Baseline: HEAD `617a3d3`
Source: Pre-Audit A manifest (commit `f12725f`)

## Executive summary
- 10 canonical docs defined
- 8 SUPERSEDED docs have successors identified
- 1 DUPLICATE has merge plan
- 0 DELETE_CANDIDATE (confirmed)
- N owner decisions needed

## Canonical document proposals (10 sections, one per doc)

### 1. README.md
**Current state:** [exists/missing] + brief description
**Proposed structure:**
- Section 1: Product Overview
- Section 2: Tech Stack
- Section 3: Setup
- Section 4: Links
**Source material:** list files/docs to draw from
**Decisions needed:** [any questions for owner]

### 2-10. (same structure)

## SUPERSEDED handling plan (table)

| File | Successor | Transition | Links to update |
|---|---|---|---|
| ... | ... | mark + keep | list |

## DUPLICATE handling plan

- Canonical: ...
- Duplicate: ...
- Merge plan: ...

## Deletion candidates
- 0 confirmed (per Pre-Audit A)
- Any new found during investigation: [list]

## Owner decisions needed (questions)

1. [Question 1]
2. [Question 2]
...

## Next step after owner approval

Execution task: actually write/refresh the 10 canonical docs, mark superseded, merge duplicate.
```

## Constraints

- **Read-only**: no file modifications except the proposal output itself.
- **Production data untouched**: no DB writes, no migrations, no RPC calls.
- **No push**: local commit only (for the proposal MD file).
- **Reference manifest**: every claim links back to Pre-Audit A manifest entry or current code.
- **Owner decisions explicit**: any question that requires owner input → list in dedicated section, do NOT decide unilaterally.

## Verification

- Proposal MD written.
- All 10 canonical docs covered.
- All 8 SUPERSEDED docs have successor identified.
- 1 DUPLICATE has merge plan.
- DELETE_CANDIDATE confirmed 0 (or new candidates flagged).
- Owner decisions section populated.
- `git diff --check`: clean.

## Expected output

- `docs/audits/2026-07-17-pre-audit-b-canonical-proposal.md` (new).
- Commit: `Codex audit: Pre-Audit B canonical proposal (read-only)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P1 — second stage of audit program. Codex pickup. ~1 session (~2-3h).

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — architectural decisions on doc structure + identification of contradictions + owner decision framing.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Contradictions between current docs reveal unresolved architectural debates (would need owner input before proposal can be complete).
- DELETE_CANDIDATE count rises above 0 (would need owner pre-approval to propose any deletion).
- A canonical doc (e.g., ARCHITECTURE.md) would require significant new investigation beyond current code reading (would push to separate task).
- Owner decisions list grows >10 items (would warrant pre-alignment call with owner before completing proposal).

## Questions before starting

- Should the proposal include sample content for each canonical doc, or just structure outline? Recommend STRUCTURE OUTLINE only — content authoring happens in execution task.
- Should ARCHITECTURE.md include diagrams? Recommend REFERENCE to existing diagram files (if any) or note "diagram TBD" — don't author new diagrams in proposal phase.
- For owner decisions: bundle at end of proposal or inline per doc? Recommend END OF PROPOSAL — single section for owner to review all decisions in one place.
