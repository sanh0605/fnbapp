# FNB App Testing and Verification

Status: canonical test strategy

Last verified: 2026-07-17

## Tóm tắt cho chủ doanh nghiệp

Hệ thống có kiểm tra tự động cho phần tính toán, dữ liệu, một số hành động và giao diện. Trước mỗi lần lưu code, máy phát triển tự kiểm tra TypeScript. Tuy nhiên, dự án chưa có bộ kiểm tra tự động mô phỏng người dùng trên trình duyệt và chưa có quy trình CI trên GitHub.

Danh sách kiểm tra thủ công tháng 4/2026 đã lỗi thời. Theo quyết định D7, chỉ những kịch bản được Pre-Audit C xác nhận còn tồn tại mới được đưa lại vào phần kiểm tra vận hành; bản gốc vẫn được giữ trong lịch sử Git.

## Purpose

This document defines the current verification tools, commands, evidence expectations, and known gaps. It does not claim that a feature works merely because a test file or UI route exists.

## Standard commands

Run from the repository root:

```bash
npm test
npm run test:coverage
npx tsc --noEmit
npm run build
```

Development helpers:

```bash
npm run test:watch
npm run test:ui
npm run dev
```

`npm test` maps to `vitest run`. `npm run build` is required for delivery verification but does not replace the explicit TypeScript command because `next.config.js` currently allows build output despite type or lint errors.

## Automated test types

### Unit tests

Unit tests cover focused functions and domain calculations under `lib/**/*.test.ts`, selected application actions, components, and scripts. Use them for deterministic rules such as order math, snapshots, COGS allocation, inventory consumption, backup contracts, and audit classification.

### Property tests

fast-check property tests exercise invariants across generated inputs. They are appropriate for arithmetic, allocation, rounding, migration planning, and state transformations where a few examples cannot cover the input space.

### Component tests

Selected React components use Vitest with jsdom. The default Vitest environment is Node; a component test must opt into or configure jsdom as needed. Component tests do not replace browser-level end-to-end verification.

### Script and contract tests

Read-only audit planners, migration planners, backup contracts, and transaction wrappers may have tests under `scripts/**/*.test.ts` or `lib/**/*.test.ts`. Tests must separate pure planning from external writes and verify that apply modes require explicit authorization.

### Data audits

Audit scripts validate live or snapshot invariants that unit tests cannot prove. Unless a reviewed task says otherwise, an audit must be read-only. Credentials, cohort definition, source hash, date range, and expected output must be recorded with the result.

Examples of high-value audit areas include:

- MAC/COGS drift and cohort locks;
- P&L/MAC consistency;
- order totals, discounts, voids, and ledger balance;
- purchase-order and stock-ledger consistency;
- production/BTP stock behavior;
- backup schema, table scope, and restore inputs.

The relevant task or policy document defines the exact command and acceptable result; this file does not freeze per-script expectations that can become stale.

## Test discovery and configuration

`vitest.config.ts` currently includes:

- `lib/**/*.test.ts`;
- `lib/**/*.property.test.ts`;
- `scripts/**/*.test.ts`;
- `app/**/*.test.ts`;
- `components/**/*.test.tsx`.

Coverage uses the V8 provider and reports text plus HTML. Its configured include list is narrower than the total test suite, so a coverage percentage must always state which files were measured.

## Verification gates by change type

| Change type | Minimum automated gate | Additional evidence |
|---|---|---|
| Documentation only | Link/path check where relevant; `git diff --check`; TypeScript hook on commit | Confirm no code, data, migration, or production operation changed |
| UI presentation | Relevant component tests, full Vitest, TypeScript, production build | Manual mobile/desktop check and accessibility review for changed flows |
| Server action or access control | Focused tests, full Vitest, TypeScript, build | Role/session matrix, failure-path evidence, Phase 3 security rules where applicable |
| Order/COGS/report engine | Focused unit/property tests, full Vitest, TypeScript, build | MAC drift, P&L consistency, and relevant ledger audits |
| Database migration or recovery | Pure planner/transaction tests, full Vitest, TypeScript | Reviewed dry-run, exact payload/hash, atomic apply, post-apply checks, rollback readiness |
| Backup contract | Contract/handler tests, full Vitest, TypeScript | Snapshot schema/table validation, idempotency, retention check, and periodic restore drill |
| Dependency/configuration | Full Vitest, TypeScript, build | Review runtime, deployment, and secret-name impact |

Task-specific gates override this minimum only when the reviewed plan is stricter. A passing unit suite never authorizes a production write.

## Local commit hook and remote CI

`.husky/pre-commit` runs:

```bash
npx tsc --noEmit
```

This is a local developer safeguard. It is not continuous integration and does not run Vitest or the production build. At this baseline, no tracked GitHub Actions workflow exists.

If remote CI is added later, document its required jobs and branch protection here. Do not describe Vercel build success as equivalent to the complete merge gate.

## Manual critical-flow verification

Detailed manual scenarios are intentionally pending Pre-Audit C. Candidate areas from the April checklist must be revalidated against current routes and business scope before inclusion:

| Candidate flow | Current documentation status |
|---|---|
| Login and role landing | `PENDING_PRE_AUDIT_C` |
| POS catalog, cart, pricing, and checkout | `PENDING_PRE_AUDIT_C` |
| Order review, edit, void, and supersede | `PENDING_PRE_AUDIT_C` |
| Purchase order and inventory adjustment | `PENDING_PRE_AUDIT_C` |
| Production order and BTP yield | `PENDING_PRE_AUDIT_C` |
| Revenue, COGS, and P&L reports | `PENDING_PRE_AUDIT_C` |
| Backdated-ledger operator review | `PENDING_PRE_AUDIT_C` |
| Backup file validation and restore drill | `PENDING_PRE_AUDIT_C` |

Offline POS is not included as an active manual flow because capability is `UNVERIFIED`. Pre-Audit C may classify it as planned, partial, retired, or verified based on evidence.

## Evidence recording

For each completed verification phase, record:

- command or manual scenario;
- date and environment;
- test/file counts where the tool reports them;
- relevant cohort, date range, or source hash;
- expected versus actual result;
- known informational warnings;
- commit and audit/result document;
- confirmation that no unapproved production write occurred.

Do not paste secrets, password hashes, access tokens, full credentials, or private backup URLs into test output or documentation.

## Known gaps

- No Playwright dependency or browser end-to-end suite is tracked.
- No tracked remote CI workflow exists.
- The local pre-commit hook checks TypeScript only.
- Integration coverage is uneven across server actions and external services.
- RLS and action-level authorization require the planned Phase 3 security audit.
- SEC-1 remains open for raw password-hash data serialized to authenticated admin pages.
- Backup creation is operationally verified, but long-term restore readiness requires periodic restore drills.
- Feature-level manual coverage will remain incomplete until Pre-Audit C populates the feature catalog.

## Supporting documents

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — runtime and trust boundaries
- [`FEATURE-CATALOG.md`](FEATURE-CATALOG.md) — feature status and evidence
- [`BUSINESS-RULES.md`](BUSINESS-RULES.md) — business invariants
- [`ACCESS-MODEL.md`](ACCESS-MODEL.md) — intended versus verified access
- [`COLLABORATION.md`](COLLABORATION.md) — merge gates and ownership
- [`audits/2026-07-16-drive-backup-policy.md`](audits/2026-07-16-drive-backup-policy.md) — backup verification contract

Update this document when test tools, commands, coverage boundaries, merge gates, CI, or critical manual flows change.
