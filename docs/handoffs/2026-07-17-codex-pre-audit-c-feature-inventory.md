# Task: Pre-Audit C — Evidence-Backed Feature Inventory

## Context

Pre-Audit B execution is reviewed and closed (Claude, 2026-07-17). All ten canonical
documents exist, 64/64 internal links resolve, 403/403 tests pass, TypeScript is
clean, the production build succeeds (41 routes), and the historical banner
treatment (7 `SUPERSEDED` + 1 `DUPLICATE`) is correct. Commits: `7c2409b`,
`b238411`, `caacc58`.

`docs/FEATURE-CATALOG.md` currently defines the contract only: approved status
vocabulary, evidence rules, feature record schema, and a 15-group module seed
list. No feature has an assigned status yet. This task performs the first
population pass.

Read `docs/FEATURE-CATALOG.md` in full before starting — it is the authority
for vocabulary, evidence rules, and the record schema used below. Also read
`docs/ACCESS-MODEL.md` (intended business roles) and `docs/BUSINESS-RULES.md`
(approved operating rules) since feature records reference both.

## Goal

Populate `docs/FEATURE-CATALOG.md` with one evidence-backed record per
capability, grouped under the 15 module groups already seeded in that file:

1. Authentication and sessions
2. Business scope and brand/outlet data
3. POS and drafts
4. Orders and order lifecycle
5. Products, variants, modifiers, recipes
6. Promotions and pricing
7. Purchasing and suppliers
8. Inventory and stock ledger
9. Production and semi-products
10. Revenue, COGS, and reports
11. Backdated-ledger review and data audit
12. User administration and access
13. Backup, retention, and restore readiness
14. Notifications and external integrations
15. Settings and maintenance tools

For each module, break it into independently understandable capabilities
(not one record per file) and fill the schema from `docs/FEATURE-CATALOG.md`:
Feature ID, business capability, intended users, current entry points,
status, evidence, known limitations, data affected, last verified,
owner/maintainer.

## Status assignment rule

Use only the six approved statuses: `LIVE_VERIFIED`, `LIVE_UNVERIFIED`,
`PARTIAL`, `PLANNED`, `DEFERRED`, `RETIRED`.

Assign the most conservative status the evidence actually supports:

- A route/action existing in code is not sufficient for `LIVE_VERIFIED`.
  That requires the evidence type appropriate to the risk (see
  `docs/FEATURE-CATALOG.md` "Evidence rules") — for example, passing tests
  plus an audit script for a financial capability, or a documented operator
  walkthrough for a UI flow with no automated coverage.
- If code/route exists but verification evidence is missing or unclear,
  use `LIVE_UNVERIFIED` and name exactly what verification is missing.
- Per owner decision D2 (`docs/audits/2026-07-17-pre-audit-b-owner-decisions.md`),
  offline ordering starts `PLANNED` or `LIVE_UNVERIFIED` — never claim it is
  live without direct evidence.
- Per owner decision D1, multi-brand/multi-outlet capability is `PLANNED` or
  `DEFERRED`, not live, regardless of any latent code paths.
- Do not infer status from documentation, commit messages, or tracking-log
  prose alone. Trace to the actual current route, action, script, test, or
  audit artifact.

## Cross-cutting assessment matrix

For each module, evaluate (not infer) against `docs/FEATURE-CATALOG.md`
"Cross-cutting assessment matrix": mobile usability, offline behavior,
multi-brand/outlet scope, role and data-scope enforcement, audit trail and
actor attribution, historical snapshot behavior, export/notification
behavior, failure recovery and idempotency, backup completeness and restore
readiness, Vietnamese user-facing language and accessibility. Record findings
inline in the relevant feature records' "Known limitations" field rather than
as a separate report.

## Explicitly out of scope for this task

- Do not begin the eight-gate audit (`docs/superpowers/specs/2026-07-17-full-system-audit-program.md`).
- Do not fix, implement, or refactor anything found missing or partial —
  record it only.
- Do not attempt the full 17-section "Mandatory F&B capability checklist"
  from the audit-program spec (organization/brand/outlet setup through
  optional capabilities) in this pass. That checklist requires per-item
  owner classification (`REQUIRED_NOW` / `REQUIRED_FOR_MULTI_OUTLET` /
  `RECOMMENDED_NEXT` / `OPTIONAL_LATER` / `NOT_APPLICABLE`) and is large
  enough to warrant its own handoff after this module-level pass lands and
  Claude/owner review it. Flag it as a follow-up in your closing summary,
  do not execute it now.
- Do not modify code, run migrations, or write production data. This is a
  documentation/evidence task, not a remediation task.
- Do not delete, move, or rewrite any historical/audit document.
- Do not push to remote.

## Constraints

- Language policy per D5: Vietnamese for owner-facing summary sections
  (add a short one at the top of `docs/FEATURE-CATALOG.md` following the
  pattern already used in `docs/ACCESS-MODEL.md`), English for the technical
  record tables. One language per section, no mid-sentence mixing.
- Every status assignment must trace to a concrete artifact: a file path,
  test name, script name, or audit report. If you cannot name the artifact,
  the status cannot be `LIVE_VERIFIED`.
- Preserve the existing contract sections in `docs/FEATURE-CATALOG.md`
  (Purpose, approved status vocabulary, evidence rules, record schema) —
  extend the file, do not restructure what Pre-Audit B already approved.
- Commit per module group or in a small number of logical batches — do not
  bundle this with any code change.

## Verification

1. `npx tsc --noEmit`: 0 errors (no code should change, but confirm baseline
   is undisturbed).
2. `npx vitest run`: 403/403 pass (baseline, unless you add new audit
   scripts with their own tests — note any change to this count).
3. Every one of the 15 module groups has at least one feature record with an
   assigned status.
4. No feature record uses a status outside the approved six-value vocabulary.
5. No feature record claims `LIVE_VERIFIED` without a named, checkable
   evidence artifact.
6. Internal links in `docs/FEATURE-CATALOG.md` still resolve (re-run the
   same link check pattern used for Pre-Audit B).
7. `git diff --stat` shows no deletions and no changes outside
   `docs/FEATURE-CATALOG.md` (plus `DEVELOPMENT-TRACKING.md` for your
   tracking entry) unless you discover a genuine documentation
   contradiction — if so, stop and ping per the trigger below rather than
   silently editing other canonical docs.

## Expected output

- `docs/FEATURE-CATALOG.md` populated with feature records across all 15
  module groups, cross-cutting matrix findings folded into "Known
  limitations" fields.
- `DEVELOPMENT-TRACKING.md` entry describing what was inventoried, the
  status distribution (count per status value), and any gaps found.
- Closing summary that explicitly separates "safe to close" findings from
  "needs owner decision" findings, and flags the F&B capability checklist
  as a proposed follow-up task rather than executing it.
- No push.

## Priority

P1 — Codex pickup, following Pre-Audit B execution pattern. Estimate
2-4 sessions given 15 module groups.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — this is an
evidence-tracing task across the full codebase requiring judgment calls on
what counts as sufficient verification per capability, similar in nature to
the canonical-document authoring in Pre-Audit B.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- A capability's evidence is ambiguous enough that two reasonable people
  would assign different statuses — do not average or guess; ask.
- Populating a feature record would require rewriting or contradicting a
  claim already made in `README.md`, `CONTEXT.md`, `ARCHITECTURE.md`,
  `docs/BUSINESS-RULES.md`, or `docs/ACCESS-MODEL.md` — flag the
  contradiction rather than silently editing those files.
- You find evidence of a security or data-integrity gap while tracing a
  capability (this is a documentation pass, not where such a gap gets
  fixed) — record it and flag it, do not attempt a fix.
- The module-group boundaries in `docs/FEATURE-CATALOG.md` do not cleanly
  fit the actual code structure (e.g., a capability spans two groups) —
  propose a resolution rather than forcing a fit.
- TS/build fails for a non-trivial reason.
