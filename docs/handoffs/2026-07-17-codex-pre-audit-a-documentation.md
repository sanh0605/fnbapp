# Task: Pre-Audit A — Documentation Discovery and Classification

## Context

Owner triggered full system audit program (`docs/superpowers/specs/2026-07-17-full-system-audit-program.md`). This is **Pre-Audit A** — first stage, read-only documentation inventory.

Baseline recorded:
- HEAD commit SHA: `d1db0c1` (2026-07-17 13:59:52 +0700)
- Working tree: clean
- Local commits ahead of origin/main: 38 (no push during audit)
- Production environment: Vercel auto-deploy from `origin/main`, Supabase project `zicuawpwyhmtqmzawvau`

**Read-only. No code changes. No production writes. No migrations.**

## Goal

Inventory ALL root Markdown files + ALL documents under `docs/`. Classify each. Produce documentation manifest. Flag P0 exposures (narrow, not full audit).

## Scope

### In scope (read-only)

1. **Inventory all root Markdown files**:
   - `README.md`
   - `CLAUDE.md` (root)
   - `AGENTS.md`
   - `TASK.md`
   - Any other `*.md` at repo root

2. **Inventory all docs under `docs/`**:
   - `docs/COLLABORATION.md`
   - `docs/ROADMAP.md`
   - `docs/COMPLETED.md`
   - `docs/domain-dictionary.md`
   - `docs/handoffs/*.md` (all handoff briefs)
   - `docs/superpowers/specs/*.md`
   - `docs/superpowers/plans/*.md`
   - `docs/audits/*.md` + `docs/audits/*.json`
   - `docs/operations/*.md`
   - `docs/reports/*.md`
   - Any other Markdown under `docs/`

3. **Exclude from inventory** (but note their existence):
   - Files under `node_modules/`
   - Files under `.next/`
   - Files under `supabase/.temp/`
   - Files under `scripts/output/`
   - Any file matched by `.gitignore`

4. **For each document, record**:
   - `path` — full path from repo root
   - `title` — H1 title or filename
   - `last_meaningful_update` — commit SHA + date (use `git log -1 --format="%h %ai" -- <path>`)
   - `stated_purpose` — what the doc claims to be (1-2 sentences from intro)
   - `actual_consumers` — what code/scripts/other docs reference it (grep for path)
   - `claims_match_code` — boolean + note (does the doc's claims match current `main` code?)
   - `classification` — one of: `CURRENT`, `HISTORICAL_EVIDENCE`, `SUPERSEDED`, `DUPLICATE`, `GENERATED_ARTIFACT`, `DELETE_CANDIDATE`
   - `successor_document` — for `SUPERSEDED` items, what replaces it
   - `deletion_risk` — `LOW` / `MEDIUM` / `HIGH` (based on whether live code/script/canonical doc references it)
   - `preservation_requirement` — `KEEP_FOREVER` / `KEEP_AS_EVIDENCE` / `CAN_ARCHIVE` / `CAN_DELETE_AFTER_MIGRATION`

5. **Classification definitions**:
   - `CURRENT` — accurate, in use, matches code. Canonical source of truth for its topic.
   - `HISTORICAL_EVIDENCE` — old but valuable as audit trail (recovery evidence, decision history, etc.). Not currently authoritative.
   - `SUPERSEDED` — replaced by another doc. Has known successor.
   - `DUPLICATE` — content overlaps significantly with another doc.
   - `GENERATED_ARTIFACT` — produced by script/tool (audit JSON, baseline lines, etc.). Regenerable.
   - `DELETE_CANDIDATE` — obsolete, no references, no historical value.

6. **Special preservation rules** (per spec):
   - **NEVER** classify as `DELETE_CANDIDATE` merely for being old:
     - migrations / migration history
     - recovery evidence / production-write receipts
     - rollback instructions
     - audit JSON (frozen artifacts)
     - historical decisions / ADRs
     - compliance/security evidence
   - These stay as `HISTORICAL_EVIDENCE` or `GENERATED_ARTIFACT` (depending on type).

7. **P0 exposure flag** (narrow, read-only check):
   - Inspect these specific files for unauthenticated production write paths:
     - `app/api/diagnose-order/route.ts` — does it expose production data without auth?
     - `app/admin/audit/backdated-ledger/actions.ts` — does it require session/role check?
     - `app/pos/actions.ts` — order submission / draft mutation paths, any unauthenticated?
     - User-reading server actions — may they return `password_hash` field?
   - For each: report `EXPOSED` / `CONTAINED` / `UNKNOWN` + evidence (file:line + code snippet).
   - **Do NOT fix anything**. Just flag for Phase 0.

### Out of scope (explicit)

- Do NOT edit, move, rename, archive, or delete ANY file.
- Do NOT fix P0 exposures (Phase 0 does that, later).
- Do NOT begin Pre-Audit B (canonical doc consolidation).
- Do NOT begin Pre-Audit C (feature inventory).
- Do NOT run the eight-gate audit.
- Do NOT modify production data.
- Do NOT push to remote.

## Output deliverables

### 1. `docs/audits/2026-07-17-pre-audit-a-documentation-manifest.json`

Structured JSON with one entry per document:

```json
{
  "generated_at": "2026-07-17T...",
  "baseline_commit_sha": "d1db0c1",
  "baseline_date": "2026-07-17",
  "total_documents": N,
  "classification_counts": {
    "CURRENT": N,
    "HISTORICAL_EVIDENCE": N,
    "SUPERSEDED": N,
    "DUPLICATE": N,
    "GENERATED_ARTIFACT": N,
    "DELETE_CANDIDATE": N
  },
  "documents": [
    {
      "path": "...",
      "title": "...",
      "last_meaningful_update": {
        "commit_sha": "...",
        "date": "..."
      },
      "stated_purpose": "...",
      "actual_consumers": ["...", "..."],
      "claims_match_code": {
        "matches": true|false,
        "note": "..."
      },
      "classification": "CURRENT|HISTORICAL_EVIDENCE|SUPERSEDED|DUPLICATE|GENERATED_ARTIFACT|DELETE_CANDIDATE",
      "successor_document": "..." | null,
      "deletion_risk": "LOW|MEDIUM|HIGH",
      "preservation_requirement": "KEEP_FOREVER|KEEP_AS_EVIDENCE|CAN_ARCHIVE|CAN_DELETE_AFTER_MIGRATION"
    }
  ],
  "p0_exposure_flags": [
    {
      "file": "app/api/diagnose-order/route.ts",
      "status": "EXPOSED|CONTAINED|UNKNOWN",
      "evidence": "file:line + code snippet",
      "business_impact": "..."
    }
  ],
  "contradictions": [
    {
      "doc_a": "...",
      "doc_b": "...",
      "contradiction": "..."
    }
  ]
}
```

### 2. `docs/audits/2026-07-17-pre-audit-a-documentation-manifest.md`

Prose summary for owner review:

- Executive summary (1 paragraph)
- Total documents inventoried
- Classification breakdown (table)
- Highlighted contradictions (doc-vs-doc, doc-vs-code)
- P0 exposure findings (if any)
- Recommended actions for Pre-Audit B (canonical consolidation)
- Documents suggested for archive (with retention rationale)
- Documents suggested for deletion (only after owner approval, with evidence no references)

## Constraints

- **Read-only**: no file modifications, no moves, no deletions.
- **Production data untouched**: no DB queries that mutate, no RPC calls that write.
- **No push**: local commit only (for the manifest output files).
- **Verification before classifying**: every `claims_match_code` MUST be backed by actual code inspection, not assumption.
- **Preservation first**: when in doubt, classify as `HISTORICAL_EVIDENCE`, never `DELETE_CANDIDATE`.

## Verification

- Script (if used) runs cleanly.
- Manifest JSON validates (parseable, schema-correct).
- Every document under `docs/` and root `*.md` has an entry.
- Spot-check 5 documents: verify `classification` + `claims_match_code` against actual file content.
- `git diff --check`: clean (only new manifest files added).
- No production writes (verify via inspection — no DB-mutating code invoked).

## Expected output

- `docs/audits/2026-07-17-pre-audit-a-documentation-manifest.json` (new).
- `docs/audits/2026-07-17-pre-audit-a-documentation-manifest.md` (new).
- Optionally: `scripts/pre-audit-a-doc-inventory.ts` (read-only script if used — keep if reusable for future re-audits).
- Commit: `Codex audit: Pre-Audit A documentation manifest (read-only baseline)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P1 — first stage of full audit program. Codex pickup. ~1 session (~2-4h depending on doc count).

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — comprehensive investigation with classification decisions + P0 security flagging. Requires careful reasoning.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Document count is significantly higher/lower than expected (>100 docs or <20 docs).
- P0 exposure found that appears immediately exploitable (don't fix, but flag urgently).
- Classification ambiguous for >5 documents (need Claude decision on boundary cases).
- Contradiction between docs reveals ongoing architectural drift (worth escalating).
- `claims_match_code` requires running code/tests to verify (would exceed read-only scope).

## Questions before starting

- Include `supabase/migrations/*.sql` files in inventory? Recommend NO (those are schema, not docs). But reference count from docs to migrations should be tracked.
- Include `*.md` files inside `components/`, `lib/`, `app/` (e.g., README in subfolder)? Recommend YES if they exist.
- For `GENERATED_ARTIFACT` JSON files (audit outputs), include individual entries or group by source? Recommend INDIVIDUAL — useful to track each.
- For handoffs in `docs/handoffs/`, classify all as `HISTORICAL_EVIDENCE` (they're prompts for completed work)? Recommend YES, but flag any that reference pending work.
