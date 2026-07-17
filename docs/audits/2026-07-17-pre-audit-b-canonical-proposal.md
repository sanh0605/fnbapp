# Pre-Audit B — Canonical Document Set Proposal

Date: 2026-07-17

Mode: read-only proposal; no canonical or historical document changed

Investigation HEAD: `7fdc409`

Runtime/code baseline: `617a3d3` (the later `7fdc409` change only added this handoff and updated roadmap status)

Source inventory: Pre-Audit A manifest, commit `f12725f`

## Tóm tắt cho chủ doanh nghiệp

Đề xuất này tạo 10 “cửa vào chính” để sau này anh và đội phát triển biết phải đọc tài liệu nào cho từng câu hỏi. Các biên bản sửa dữ liệu, chính sách MAC, backup và bằng chứng kiểm tra cũ vẫn được giữ nguyên; chúng không bị xóa hoặc ép nhập hết vào 10 file mới.

Hiện có 7/10 đường dẫn tài liệu, nhưng 4 file trong số đó cần viết lại đáng kể vì đã cũ: `README.md`, `CONTEXT.md`, `ARCHITECTURE.md`, và `docs/TESTING.md`. Ba file chưa có là danh mục tính năng, quy tắc nghiệp vụ và mô hình phân quyền. Tám tài liệu đã bị thay thế sẽ được gắn biển chỉ sang nguồn mới; một bản sao hướng dẫn giao diện sẽ được giữ làm bằng chứng, không xóa. Có 8 quyết định cần owner xác nhận trước khi bắt đầu sửa tài liệu thật.

## Executive summary

- Ten canonical entry documents are defined: seven paths currently exist and three are missing.
- Existing does not mean current: four existing paths require substantial replacement, while `docs/ROADMAP.md`, `docs/COMPLETED.md`, and `docs/COLLABORATION.md` need focused refreshes.
- The handoff described `docs/TESTING.md` as missing; repository inspection shows a 131-line manual checklist dated 2026-04-21. It is present but historical and must be rewritten in place.
- All eight `SUPERSEDED` records have a successor and preservation-safe transition plan.
- The single `DUPLICATE` record has no consumers; it should remain as a labeled historical snapshot rather than be deleted.
- `DELETE_CANDIDATE` remains zero. This proposal introduces no deletion, move, archive, or production action.
- Eight owner decisions are collected at the end. None is resolved unilaterally here.

## Recommended canonical model

### Approaches considered

1. **Tiered canonical entry set — recommended.** The ten documents are the stable entry points. Specialized policies, runbooks, designs, and frozen audit evidence remain authoritative within their narrow scope and are linked from the entry documents.
2. **Flatten everything into ten documents.** This would make discovery simple, but would duplicate or erase important detail from MAC, backup, recovery, and migration evidence. It would also make the ten files too large to maintain.
3. **Index-only wrappers.** This would preserve everything and require little work, but stale claims in the existing README, context, architecture, and testing documents would remain unresolved.

The tiered model is the only option that improves navigation without weakening evidence preservation.

### Authority tiers

| Tier | Purpose | Examples | Change rule |
|---|---|---|---|
| 1 — Canonical entry documents | Answer common product, business, architecture, access, status, testing, and collaboration questions | The ten documents in this proposal | Must remain current; each has a named maintenance trigger |
| 2 — Controlled supporting sources | Hold detailed policy or domain material that would overload Tier 1 | `docs/domain-dictionary.md`, MAC design, backup policy/runbook, BTP drift policy | Linked from Tier 1; remain authoritative for their narrow topic |
| 3 — Historical evidence | Preserve decisions, handoffs, production receipts, recovery plans, generated JSON, and superseded designs | `docs/audits/**`, `docs/handoffs/**`, completed plans | Never treated as current authority; preserve and label rather than delete |

This distinction is important: “ten canonical documents” means ten stable entry points, not that only ten repository documents may contain authoritative detail.

### Common contract for all ten documents

Every canonical document should include:

- a clear purpose and intended audience;
- an owner and a concrete update trigger;
- a “last verified” date, not merely a last edited date;
- links to Tier 2 sources rather than copied policy text;
- explicit labels for `CURRENT`, `PLANNED`, `UNVERIFIED`, or historical statements;
- no claim of runtime enforcement unless code or an audit supports it.

## Canonical document proposals

### 1. `README.md`

**Current state:** Exists, 45 lines, classified `SUPERSEDED`. It describes a vanilla HTML/CSS/JS application hosted on GitHub Pages with localStorage authentication and an offline IndexedDB queue. Current code is Next.js 14/React/TypeScript, uses NextAuth and Supabase, and is deployed through Vercel. Several links point to nonexistent `docs/CONTEXT.md` and `docs/ARCHITECTURE.md` paths rather than the root files.

**Proposed role:** The concise public entry point for developers and operators. Rewrite in place; do not add a `SUPERSEDED` banner to the canonical path.

**Proposed structure:**

1. Product overview and current operating scope.
2. Current capabilities at a high level, with a link to `docs/FEATURE-CATALOG.md`.
3. Runtime stack and deployment: Next.js, NextAuth credentials backed by Supabase Postgres, Supabase RPC/Edge Functions, Vercel, and Google Drive backup integration. Do not claim Supabase Auth or Storage usage without new evidence.
4. Local setup: prerequisites, environment-variable names without secrets, install, development, test, build.
5. Safety notes: production data writes, migrations, backup/restore, and no-push protocol links.
6. Canonical documentation map linking the other nine entry documents.

**Source material:** [`package.json`](../../package.json), [`app/`](../../app), [`supabase/`](../../supabase), [`next.config.js`](../../next.config.js), [`docs/COLLABORATION.md`](../COLLABORATION.md), and the current deployment/backup policy.

**Maintenance trigger:** Stack, deployment target, setup command, environment contract, or canonical document set changes.

**Decisions needed:** D1, D2, and D5.

### 2. `CONTEXT.md`

**Current state:** Exists, 31 lines, classified `HISTORICAL_EVIDENCE`. It contains an April business vision, claims two brands/seven outlets and offline ordering as a success condition, and refers to a side-by-side `v2` migration that is no longer the current repository structure.

**Proposed role:** Explain why the product exists, the business it currently serves, scope boundaries, operating assumptions, and where owner decisions are recorded. It must not double as an architecture or roadmap document.

**Proposed structure:**

1. Business and customer context.
2. Current operating model: brand, shop/outlet, ordering channel, fulfillment model.
3. Success measures expressed in business terms.
4. In-scope and explicitly out-of-scope business capabilities.
5. Terminology summary linking `docs/domain-dictionary.md`.
6. Decision authority and links to `docs/BUSINESS-RULES.md`, `docs/ROADMAP.md`, and historical evidence.

**Source material:** [`CONTEXT.md`](../../CONTEXT.md), [`docs/domain-dictionary.md`](../domain-dictionary.md), current owner-approved policies, and verified feature scope from Pre-Audit C.

**Maintenance trigger:** Business model, number of active brands/shops, sales channel, operating scope, or success criteria changes.

**Decisions needed:** D1, D2, and D5.

### 3. `ARCHITECTURE.md`

**Current state:** Exists, 149 lines, classified `GENERATED_ARTIFACT`. It is a June 17 file listing rather than a durable system design and omits later Supabase migrations, MAC controls, backup pull model, audit locks, and current security boundaries.

**Proposed role:** Describe the current system shape and trust boundaries at a level that survives routine file movement. Do not regenerate a raw module listing.

**Proposed structure:**

1. System context and runtime components.
2. Request/data flow: browser → Next.js → Supabase; authentication/session path; server actions and direct API paths.
3. Data platform: Postgres schema, RPC/transaction boundaries, migrations, RLS assumptions, and Edge Functions. Record Storage only if execution finds an active consumer; none was found in this proposal scan.
4. Major modules: POS, orders, inventory/purchasing, production/BTP, reports, audits, backup.
5. External integrations: Vercel, Google Apps Script, Google Drive, and future object-storage threshold.
6. Trust boundaries and secrets: browser, Next.js server, Supabase service credentials, backup token, Apps Script properties.
7. Reliability controls: pinned order snapshots, ledger invariants, audit locks, backups, and restore verification.
8. Known architecture gaps linked to roadmap/security audit, without presenting intended controls as implemented.
9. Links to detailed Tier 2 designs and policies.

**Source material:** [`app/`](../../app), [`lib/`](../../lib), [`supabase/migrations/`](../../supabase/migrations), [`supabase/functions/`](../../supabase/functions), [`middleware.ts`](../../middleware.ts), [`lib/auth.ts`](../../lib/auth.ts), MAC design, backup policy, and backup runbook.

**Maintenance trigger:** Runtime component, data boundary, deployment/integration, authentication model, critical transaction, or backup architecture changes.

**Decisions needed:** D3 and D4. A diagram is optional during execution; correctness of the written boundaries comes first.

### 4. `docs/FEATURE-CATALOG.md`

**Current state:** Missing. Pre-Audit C is the dependency for a complete feature inventory.

**Proposed role:** Provide one business-readable inventory of what the application can do and the evidence supporting each status. It is not a roadmap and must not infer a feature from the presence of a page alone.

**Proposed structure:**

1. Status definitions and verification date.
2. Feature matrix with stable ID, business capability, user/role, route or entry point, status, evidence, and known limitation.
3. Sections for POS, orders, menu/recipes, purchasing/inventory, production/BTP, reports, audit, user/access, backup/restore, and platform operations.
4. Cross-cutting capability matrix: mobile, offline, multi-brand/outlet, export, auditability, and recovery.
5. Gaps linked to `docs/ROADMAP.md`; completed evidence linked to `docs/COMPLETED.md`.

**Source material:** Pre-Audit C route/action/component inventory, current tests, scripts, migrations, and observed runtime evidence. The current `app/` tree shows POS, admin, reports, inventory, production, users, audit, and settings surfaces but does not alone prove completeness.

**Maintenance trigger:** Feature launch, removal, material limitation change, or verification result.

**Decisions needed:** D2 and D6. Before Pre-Audit C, execution may create only the contract/status definitions and an explicit `PENDING PRE-AUDIT C` body; it must not fabricate feature statuses.

### 5. `docs/BUSINESS-RULES.md`

**Current state:** Missing. Business rules are distributed across the domain dictionary, MAC design, audit policies, recovery records, and code.

**Proposed role:** State owner-approved operational rules in one discoverable location while linking detailed calculations and evidence. Code behavior that has not been owner-approved must be labeled “observed implementation,” not business policy.

**Proposed structure:**

1. Authority, definitions, effective date, and rule-status vocabulary.
2. Sales/order lifecycle, statuses, void/edit/supersede rules, discounts, and immutable snapshots.
3. Product, variant, modifier, recipe, and BTP rules.
4. Purchasing, stock ledger, production yield, and backdating policy.
5. COGS/reporting rules: MAC as P&L standard, `cost_at_sale` pinning, FIFO audit-only role, rounding, and affected-period behavior.
6. Historical drift/lock policy and what is accepted versus recoverable.
7. Backup, retention, restore, and evidence-preservation rules.
8. Unresolved decisions with owner, date, and target follow-up.
9. Links to detailed Tier 2 policies and immutable audit evidence.

**Source material:** [`docs/domain-dictionary.md`](../domain-dictionary.md), MAC/COGS inventory design, BTP replay drift policy, MAC baseline audit, drive backup policy, Apps Script backup runbook, and verified code/audit contracts.

**Maintenance trigger:** Owner approves a new rule, a policy changes, or an audit finds implementation and policy differ.

**Decisions needed:** D4 and D5. `docs/domain-dictionary.md` should remain a Tier 2 vocabulary authority rather than being copied wholesale.

### 6. `docs/ACCESS-MODEL.md`

**Current state:** Missing. Current code exposes technical roles `ADMIN`, `STAFF`, and internal `SYSTEM`; route protection covers `/admin/**` and `/pos/**`, while action-local authorization is inconsistent and will be verified in the later security phase. SEC-1 is already in the backlog.

**Proposed role:** Separate intended business permissions from verified enforcement. This document must never be presented as a security certification.

**Proposed structure:**

1. Scope, status legend, and last security-verification date.
2. Business-role definitions and mapping to current technical roles.
3. Resource/action matrix: view, create, edit, approve, void, export, administer, recover.
4. Brand/shop/outlet data scope.
5. Authentication/session model and route protection.
6. Server-action, RPC, Edge Function, and system-actor boundaries.
7. Secret and sensitive-field handling, including backup token and password hashes.
8. Observed enforcement versus intended policy, with gaps linked to the security roadmap.
9. Emergency/maintenance access and audit trail expectations.

**Source material:** [`middleware.ts`](../../middleware.ts), [`lib/auth.ts`](../../lib/auth.ts), user schema/migrations, server actions, Edge Functions, SEC-1 roadmap entry, and the later Phase 3 security audit.

**Maintenance trigger:** Role, permission, authentication path, protected route, server-side guard, RLS policy, or secret-handling change.

**Decisions needed:** D3 and D4. Until Phase 3 completes, every matrix row must distinguish `INTENDED`, `OBSERVED`, and `VERIFIED`.

### 7. `docs/ROADMAP.md`

**Current state:** Exists, 151 lines, classified `CURRENT`. It is the pending-work authority, but currently repeats multiple P1 headings and contains agent/protocol/changelog material that belongs in other canonical documents.

**Proposed role:** Hold only pending work, priority, dependencies, blockers, owner decisions, and explicitly out-of-scope work.

**Proposed structure:**

1. Status legend and prioritization rules.
2. In progress.
3. P0/P1/P2/P3 pending queues, each appearing once.
4. Blocked items and the exact decision/unblock needed.
5. Dependencies and sequencing.
6. Out-of-scope/deferred work.
7. Links to feature catalog, completed archive, detailed tracking, and active handoffs.

**Source material:** Current roadmap, `docs/COMPLETED.md`, active handoffs, and owner-approved audit findings.

**Move out during execution:** Agent ownership/model selection → `docs/COLLABORATION.md`; completed history/change log → `docs/COMPLETED.md` or `DEVELOPMENT-TRACKING.md`; feature truth → `docs/FEATURE-CATALOG.md`.

**Maintenance trigger:** Work starts, stops, is reprioritized, is blocked, or is accepted as complete.

**Decisions needed:** D8 only for the overall transition policy; routine task priority remains owner-controlled.

### 8. `docs/COMPLETED.md`

**Current state:** Exists, 120 lines, classified `CURRENT`. It is chronological and valid, but recent entries contain enough implementation detail to overlap the much larger `DEVELOPMENT-TRACKING.md`.

**Proposed role:** A compact, durable index of completed outcomes, not a second engineering diary.

**Proposed structure:**

1. Definition of “complete” and evidence requirements.
2. Current-month outcome index grouped by business area.
3. Prior-month/year index.
4. Each entry: outcome, completion date, owner/reviewer, verification summary, and links to evidence/tracking.
5. Links to immutable recovery/migration/security evidence when applicable.

**Source material:** Current completed archive, `DEVELOPMENT-TRACKING.md`, commit history, result documents, and frozen audit artifacts.

**Maintenance trigger:** A roadmap item passes its completion/review gate. Detailed implementation narrative remains append-only in tracking rather than copied here.

**Decisions needed:** D5 for language; no historical entry should be deleted merely to make this file shorter.

### 9. `docs/TESTING.md`

**Current state:** Exists, not missing. It is a 131-line Vietnamese manual checklist last updated 2026-04-21 and includes unverified/offline-era assumptions. Pre-Audit A correctly classified it as `HISTORICAL_EVIDENCE`. Current repository evidence includes Vitest, fast-check property tests, jsdom component tests, TypeScript, Next build, domain audit scripts, and a Husky pre-commit TypeScript gate. There is no tracked GitHub Actions workflow and no Playwright dependency, so Husky must be described as a local commit hook, not CI.

**Proposed role:** Define the current verification strategy and the minimum evidence required by change type, while preserving useful manual business scenarios.

**Proposed structure:**

1. Testing principles and environment boundaries.
2. Test types: unit, property, component/jsdom, integration/audit, manual smoke, and restore drills.
3. Exact commands from `package.json`: test, watch, coverage, TypeScript, build, and relevant audit scripts.
4. Test location/configuration conventions from `vitest.config.ts`.
5. Change-risk gate matrix: UI, engine/math, data migration, auth, backup/restore, documentation.
6. Local pre-commit hook versus absent/present remote CI.
7. Critical manual flows retained from the April checklist only after current-feature verification.
8. Coverage and known gaps: no Playwright E2E today; incomplete integration coverage must be stated by area, not guessed.
9. Evidence-recording rules and links to audit outputs.

**Source material:** [`package.json`](../../package.json), [`vitest.config.ts`](../../vitest.config.ts), [`.husky/pre-commit`](../../.husky/pre-commit), current `*.test.ts(x)` files, read-only audit scripts, and the existing manual checklist.

**Maintenance trigger:** Test tool, command, merge gate, coverage boundary, CI, or critical manual flow changes.

**Decisions needed:** D7. The current checklist should not be discarded silently.

### 10. `docs/COLLABORATION.md`

**Current state:** Exists, 339 lines, classified `CURRENT`, and recently strengthened with ownership, backup responsibility, merge gates, model selection, handoff format, and plain-language communication rules.

**Proposed role:** Remain the sole coordination protocol. Refresh links and remove any content that becomes duplicated by the new canonical documents; do not rewrite its approved behavioral rules during canonicalization.

**Proposed changes:**

1. Replace the current file map with the ten canonical entry documents plus explicit Tier 2/Tier 3 navigation.
2. Link business terminology/rules, feature status, access intent, and testing gates to their new canonical files.
3. Keep ownership, workflow markers, write safety, review boundaries, communication rules, and handoff format in this file only.
4. Ensure `AGENTS.md` and `CLAUDE.md` point to the same canonical navigation without duplicating full policy text.

**Source material:** Current collaboration protocol, `AGENTS.md`, `CLAUDE.md`, and the approved ten-document hierarchy.

**Maintenance trigger:** Ownership, coordination workflow, review gate, model policy, handoff format, or communication policy changes.

**Decisions needed:** D4, D5, and D8. Any edit remains Claude-owned and requires protocol review.

## SUPERSEDED handling plan

The exact-reference check below corrects substring false positives from Pre-Audit A. For example, several old plans mention `_legacy/README.md`; those are not incoming links to root `README.md`. Historical evidence consumers should not be rewritten merely to remove an old link. Only current/canonical consumers should change.

| Superseded file | Successor | Transition plan | Current links to update |
|---|---|---|---|
| `README.md` | Rewritten `README.md` at the same path | Replace stale content in place. Do not add a superseded banner to the canonical path; Git preserves prior content. | No path change. Current full-audit spec link remains valid; historical handoffs remain untouched. `_legacy/README.md` matches are unrelated. |
| `TASK.md` | `docs/ROADMAP.md` | Add a top banner stating the April checklist is historical and linking the roadmap. Keep the body. | Only Pre-Audit A handoff references it; retain that historical evidence link. |
| `docs/audits/2026-06-25-full-system-audit-roadmap.md` | `docs/superpowers/specs/2026-07-17-full-system-audit-program.md` | Add a top superseded banner and keep all audit history. | Update live `CLAUDE.md:10`. The current full-audit program already identifies the older roadmap as absorbed. Keep tracking/handoff references and the deletion-safety exclusion in `scripts/verify-delete-candidates.ts`. |
| `docs/audits/system-optimization-roadmap.md` | `docs/ROADMAP.md` | Add a top superseded banner; preserve its old P0–P3 reasoning. | Its only direct consumer is the historical 2026-06-25 Codex handoff; do not rewrite it. |
| `docs/superpowers/plans/2026-05-13-google-sheets-backup.md` | `docs/operations/apps-script-drive-backup.md` | Add a top banner linking the current pull-model runbook and backup policy. | No incoming references found outside the manifests/proposal. |
| `docs/superpowers/plans/2026-07-16-stabilization-phase.md` | `docs/COMPLETED.md` plus `docs/audits/2026-07-16-drive-backup-policy.md` for backup details | Add a completion/superseded banner; preserve the approved phase plan as evidence. | No incoming references found outside the manifests/proposal. |
| `docs/superpowers/specs/2026-05-13-google-sheets-backup-design.md` | `docs/audits/2026-07-16-drive-backup-policy.md` | Add a banner explaining that the Sheets-push design was replaced by the Apps Script/Drive pull model. | No incoming references found outside the manifests/proposal. |
| `docs/superpowers/specs/2026-06-24-cogs-drift-audit-design.md` | `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md` and `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md` | Add a top banner linking both the valuation design and later replay-drift policy. | No incoming references found outside the manifests/proposal. |

### Standard banner for execution

```markdown
> **SUPERSEDED:** This document is retained as historical evidence and is not current operating guidance. Current source: [successor](relative-link).
```

The exact wording may identify `COMPLETED` instead of `SUPERSEDED` for an executed plan, but it must always name the current source and preserve the original body.

## DUPLICATE handling plan

**Duplicate:** `docs/audits/web-interface-guidelines.md`

**Operational source:** installed `web-design-guidelines` skill at `.agents/skills/web-design-guidelines/SKILL.md`, which points to the maintained Vercel guideline source

**Consumers:** none found outside the Pre-Audit manifests/proposal

The duplicate is a 180-line embedded snapshot, while the installed skill is a short workflow that fetches the maintained source. They are not byte-identical, but they serve the same operational purpose. Generic web-interface rules do not belong in any of the ten product documents.

**Plan:**

1. Keep the audit file as historical evidence.
2. Add a `DUPLICATE / HISTORICAL SNAPSHOT` banner pointing to the installed skill/upstream source.
3. Do not merge the embedded generic rules into `docs/TESTING.md` or `docs/COLLABORATION.md`.
4. If project-specific UI acceptance rules are later extracted, place only those specific rules in `docs/TESTING.md` and cite their source.
5. Do not delete the snapshot without separate owner approval.

## Deletion candidates

- Pre-Audit A reported `DELETE_CANDIDATE = 0`; the manifest count is confirmed.
- Exact incoming-reference review did not create a new deletion candidate.
- The one duplicate and eight superseded documents retain historical/audit value.
- No file should be deleted, moved, or archived during canonical execution without a new owner-approved list and reference check.

## Owner decisions needed

### D1 — Current business footprint

Confirm the facts that README and CONTEXT should state now: one operating shop versus two brands/seven outlets, and whether multi-brand/outlet support is current, future, or legacy. **Recommendation:** document only the currently operated footprint; put franchise/multi-outlet expansion in ROADMAP until verified.

### D2 — Offline ordering

The old README/CONTEXT describe offline POS as available or mandatory, but current code evidence has not established that capability. **Recommendation:** mark offline ordering `UNVERIFIED` or `PLANNED` until Pre-Audit C tests it; do not advertise it as live.

### D3 — Business roles and technical roles

Choose the intended business vocabulary (`owner/admin/cashier/inventory`) and approve its mapping to current technical roles (`ADMIN/STAFF/SYSTEM`). **Recommendation:** define business roles now, show the current mapping separately, and let the Phase 3 security audit verify enforcement before any role is labeled secure.

### D4 — Tiered authority model

Approve the ten files as canonical entry points while keeping specialized policies/runbooks as Tier 2 authorities. **Recommendation:** approve; flattening MAC, backup, and recovery material into ten files would create duplication and weaken evidence.

### D5 — Language policy

Choose how the canonical set addresses both the owner and future developers. **Recommendation:** plain Vietnamese summary for owner-facing documents/sections, English for precise technical detail, with one language per section rather than sentence-by-sentence duplication.

### D6 — Feature status vocabulary

Approve statuses for `FEATURE-CATALOG`: `LIVE_VERIFIED`, `LIVE_UNVERIFIED`, `PARTIAL`, `PLANNED`, `DEFERRED`, and `RETIRED`. **Recommendation:** use this evidence-aware set instead of a simple COMPLETE/MISSING label.

### D7 — April manual testing checklist

Decide whether applicable business scenarios from the current `docs/TESTING.md` should be retained in the rewritten canonical testing guide. **Recommendation:** preserve only scenarios that Pre-Audit C confirms still exist, under a clearly labeled manual critical-flow section; Git history preserves the full April checklist.

### D8 — Historical transition policy

Approve in-place banners and live-link corrections without moving or deleting historical files. **Recommendation:** approve this preservation-first transition; review any future archive/move proposal separately.

## Proposed execution sequence after owner approval

1. Record D1–D8 decisions and freeze the canonical hierarchy.
2. Rewrite foundational navigation first: README, CONTEXT, ARCHITECTURE, TESTING.
3. Create BUSINESS-RULES and ACCESS-MODEL with explicit `INTENDED/OBSERVED/VERIFIED` distinctions.
4. Refresh ROADMAP, COMPLETED, and COLLABORATION without rewriting historical tracking.
5. Create the FEATURE-CATALOG contract; populate detailed statuses only from Pre-Audit C evidence.
6. Add banners to the eight superseded files and one duplicate; update only live incoming links.
7. Run path/link checks, document-coverage checks, TypeScript/build gates as appropriate, and request Claude/owner review.

No execution step is authorized by this proposal itself.

## Verification of proposal scope

- Ten canonical documents: covered exactly once.
- Existing canonical paths: 7; missing paths: 3.
- Superseded documents: 8, each with successor and transition plan.
- Duplicate documents: 1, with operational source and preservation plan.
- Delete candidates: 0 confirmed.
- Owner decisions: 8, below the handoff stop threshold of more than 10.
- Production/database operations: none.
- Existing canonical, superseded, duplicate, policy, handoff, and evidence files modified: none.
