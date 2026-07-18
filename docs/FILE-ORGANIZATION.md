# File and Folder Organization

Status: canonical convention for where files live and how they're named.

Owner: Claude (protocol/docs), enforced by all agents. Referenced from
[`COLLABORATION.md`](COLLABORATION.md) Section A.

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này quy định "cái gì để ở đâu" và "đặt tên thế nào" trong dự án, để
sau đợt audit không phải dọn lại từ đầu. Áp dụng ngay từ bây giờ cho mọi file
mới tạo ra trong lúc audit đang chạy — không chờ tới lúc dọn dẹp lớn.

Việc dọn dẹp lớn (sắp xếp lại toàn bộ file/thư mục hiện có) đã ghi vào
[`ROADMAP.md`](ROADMAP.md) "Future direction" — làm sau khi audit 8 bước
xong, không làm giữa chừng. Tài liệu này chỉ là **luật áp dụng ngay**, không
phải kế hoạch dọn dẹp.

## Why this exists

As of 2026-07-19: `scripts/` has 212 files, `docs/audits/` has 88,
`docs/handoffs/` has 57. Both directories grow by design (one file per
task/gate, never deleted without approval) — that growth is expected and
fine. What needs a rule is: new files landing in the *wrong* place, or
without a name that says what they are, which is what actually causes mess
over time, not the raw count.

## Directory purpose map

| Directory | What goes here | Lifecycle |
|---|---|---|
| Root (`README.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md`) | The canonical entry-point set only — see `COLLABORATION.md` Section A. No new root `.md` files without Claude approval. | Living — edited in place, no date prefix. |
| `docs/` top level (`ROADMAP.md`, `COMPLETED.md`, `TESTING.md`, `COLLABORATION.md`, `FEATURE-CATALOG.md`, `BUSINESS-RULES.md`, `ACCESS-MODEL.md`, `FILE-ORGANIZATION.md`) | The canonical entry-point set only. No new top-level `docs/*.md` files without Claude approval — everything else goes in a subdirectory below. | Living — edited in place, no date prefix. |
| `docs/audits/` | Evidence/investigation output: audit reports, findings, verification artifacts (`.md` and paired `.json` where applicable). | Immutable once written. Never edited after the fact except to add a superseding note; never deleted. Date-prefixed. |
| `docs/handoffs/` | Task briefs authored for Codex/Antigravity to pick up. | Immutable once written — even after the task completes, the file stays as historical record (`ROADMAP.md`'s "Pending prompts" list marks it historical, doesn't delete it). Date-prefixed. |
| `docs/reports/` | One-off narrative reports that aren't audits or handoffs (e.g., an overnight-run summary). | Immutable once written. Date-prefixed. |
| `docs/operations/` | Living runbooks — how to operate something ongoing (backup, deploy). | Living — edited in place as the operation changes. No date prefix (not a point-in-time record). |
| `docs/superpowers/specs/` | Design specs for a feature/change before or during implementation. | Living while the spec is active; becomes historical once the work ships (leave in place, don't move). Date-prefixed at creation. |
| `docs/superpowers/plans/` | Implementation plans. | Same as specs. |
| `docs/domain-dictionary.md` | Terminology reference. | Living. |
| `scripts/` | Runnable code: ongoing audits, reusable runbooks, historical migrations, one-off fixes. See "Scripts lifecycle" below — this directory has its own classification system already. | Mixed — see below. |
| `app/`, `lib/`, `components/`, `types/`, `supabase/` | Application code. Standard Next.js/Supabase layout, not covered by this doc — normal code-review judgment applies. | Living. |

If a new file doesn't obviously fit one of these, ask before inventing a new
top-level category — don't create a new directory unilaterally.

## Naming conventions

- **Date-prefixed files** (`docs/audits/`, `docs/handoffs/`, `docs/reports/`,
  `docs/superpowers/specs/`, `docs/superpowers/plans/`): `YYYY-MM-DD-kebab-case-description.md`.
  The date is when the file was *created*, not last touched — it's a
  point-in-time record, not a "last updated" stamp.
- **Scripts**: prefix signals intent and drives the existing classification
  in `scripts/generate-script-cleanup-plan.ts`
  (`docs/audits/script-cleanup-plan.md`) — use the existing vocabulary
  rather than inventing new prefixes: `audit-*`/`check-*` (ongoing,
  re-runnable verification), `verify-*` (one-off verification tied to a
  specific task), `investigate-*`/`debug-*`/`inspect-*`/`diagnose-*`
  (one-off investigation, expected to become `DELETE_ONE_OFF` or
  `ARCHIVE_DOC_ONLY` once the investigation closes), `apply-*`/`backfill-*`/`fix-*`
  (one-off data correction, becomes `ARCHIVE_DOC_ONLY` after it runs),
  `migrate-*` (historical migration, kept permanently as
  `KEEP_MIGRATION_HISTORY`), `lock-*`/`recover-*` (cohort lock/recovery
  runbooks tied to a specific incident, same disposition as migrations).
  A script whose name doesn't signal one of these gets auto-classified
  `DELETE_ONE_OFF` by the tool (default when unmatched) — that's a feature,
  not a bug: pick a prefix that says what the script is for.
- Everywhere: kebab-case, no spaces, no ALL-CAPS except the canonical
  entry-point files themselves (`README.md`, `CLAUDE.md`, etc., which follow
  the existing convention already in place).

## Scripts lifecycle

`scripts/` already has a working classification system
(`docs/audits/script-cleanup-plan.md`, regenerated by
`scripts/generate-script-cleanup-plan.ts`) with 5 categories:
`KEEP_AUDIT`, `KEEP_RUNBOOK`, `KEEP_MIGRATION_HISTORY`, `ARCHIVE_DOC_ONLY`,
`DELETE_ONE_OFF`. The rule that was missing — and is the actual point of
this section — is that this classification has to be **acted on
periodically**, not just regenerated and left as a report. `REV-1` in
`ROADMAP.md` P2 is the first small step toward that; the full batch review
and deletion pass is part of the post-audit reorganization (see below), not
done ad hoc mid-audit.

Until then: when creating a new one-off script during the audit (debug,
investigate, verify), name it per the prefix table above so it's
automatically classified correctly when the plan is next regenerated —
don't leave the classification to guesswork later.

## Historical-preservation rule (unchanged, restated)

Per the D8 decision from Pre-Audit B (`docs/audits/2026-07-17-pre-audit-b-owner-decisions.md`):
**no file gets moved or deleted without explicit owner approval.** This
document's directory map describes where *new* files should go — it does
not retroactively move anything that already exists elsewhere. The planned
post-audit reorganization pass (see `ROADMAP.md` "Future direction") is
where existing misplaced files get proposed for a move, following the same
propose-then-approve pattern used for Pre-Audit B's document consolidation
— not something any agent does unilaterally, then or now.

## When this applies vs. the bigger reorganization pass

- **This document, effective now**: governs where *new* files go while the
  audit (Gates 4-8) is still running, so the pile doesn't grow messier.
- **The reorganization pass, after the audit finishes**: a proposed pass
  over *existing* files — including the `scripts/` `DELETE_ONE_OFF` batch,
  any docs that ended up in the wrong place before this rule existed, and
  folder-level moves if the owner approves them (a policy change from D8's
  "never move," to be explicitly re-confirmed with the owner at that time,
  not assumed). Scoped and handed off separately when that phase starts.
