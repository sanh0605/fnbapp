# Task: REV-1 — Cross-check 2 script fixes Claude made before the scripts/ ownership rule

## Tóm tắt cho chủ doanh nghiệp

Việc dọn dẹp nhỏ, không khẩn: hồi 2026-07-17 (trước khi có quy định "Claude
không tự sửa file trong `scripts/`"), Claude đã tự sửa 2 lỗi nhỏ trong 2 công
cụ kiểm tra/báo cáo (không phải công cụ ghi dữ liệu). Claude tự chạy thử và
xem kết quả hợp lý, nhưng chưa có ai khác (Codex) đọc lại 2 chỗ sửa đó. Nhờ
Codex đọc lại cho chắc, đúng tinh thần "hai bên độc lập kiểm tra nhau".

## Context

`docs/COLLABORATION.md` Section C closed the `scripts/**` gray zone
2026-07-18: Claude no longer edits `scripts/*` directly, even for small
mechanical fixes, specifically so Claude can still independently review
Codex's work without the self-fix-then-self-review pattern. These 2 fixes
predate that rule. Low priority — this closes the review gap retroactively,
it isn't blocking anything.

Both scripts are **read-only reporting/classification tools** — neither
writes to Google Sheets, Supabase, or any production data. No live-data risk
either way.

## Scope

### 1. `scripts/generate-script-cleanup-plan.ts` (commit `b5170da`)

Change: replaced a hardcoded `Date: 2026-06-25` string in the generated
report header with `new Date().toISOString().slice(0, 10)`. Also dropped a
stale `(Claude code — Phase 6.1)` attribution suffix from the "Generated
by" line.

Check: confirm the date format and placement are correct or run the script
yourself and eyeball the generated `docs/audits/script-cleanup-plan.md`
header.

### 2. `scripts/verify-delete-candidates.ts` (commit `24a57bd`)

Two changes:

- Replaced a hardcoded, stale 50-item `DELETE_ONE_OFF` array with
  `loadDeleteOneOffList()`, which parses the live `## DELETE_ONE_OFF`
  section out of `docs/audits/script-cleanup-plan.md` at runtime instead.
- Fixed the reference-detection regexes: they previously required the
  `.ts`/`.js` extension inside quoted import paths (e.g.
  `from "../foo.ts"`), which silently missed real internal dependencies
  written without the extension (e.g. `from "./batch-sheets-orders"`, the
  normal TypeScript/Node import style). The fix makes the extension
  optional in the import-path patterns while keeping it required for the
  plain `scripts/foo.ts` path-string patterns. Also added an
  `execSync(...)`-style call pattern and made the previously-hardcoded
  output-file exclusion (`2026-06-27-script-deletion-verification.md`) a
  dated-filename regex instead, since the output filename is now dynamic
  too.

Claude's self-report: rerunning after the fix found 28/64 candidates
actually referenced elsewhere (up from 16/51 under the old broken regex) —
a meaningful behavior change from the fix, worth Codex independently
confirming the new regex logic is sound (not over- or under-matching) since
this script's output is what `docs/audits/script-cleanup-plan.md`'s
`DELETE_ONE_OFF` classification eventually gets acted on.

Check: read the diff (`git show 24a57bd -- scripts/verify-delete-candidates.ts`),
confirm the regex change is correct (does it now match `from "./foo"`,
`from "../foo"`, `require("./foo")` with and without extension, without
over-matching something it shouldn't?), and optionally rerun the script
against the current `scripts/` directory to sanity-check the output looks
right.

## Out of scope

- Do not act on `docs/audits/script-cleanup-plan.md`'s `DELETE_ONE_OFF`
  batch itself (actually deleting scripts) — that's separately scoped as
  part of the post-audit repository reorganization pass
  (`docs/ROADMAP.md` "Future direction" item 2), not this task.
- Don't refactor either script beyond what's needed to confirm correctness
  — if you find a real bug, fix it and note it; don't restyle working code.

## Verification

1. If you make any change: `npx tsc --noEmit` 0 errors, `npx vitest run`
   passes (no existing tests reference these 2 scripts directly, they're
   `vite-node`-run tools, not imported modules — that's expected).
2. If no change is needed: say so plainly with your reasoning, that's a
   valid outcome for a cross-check task.

## Priority / model

P2, low priority, no urgency, no production-data risk in either script.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.4-mini` Low — reading
2 small diffs and optionally rerunning 2 read-only scripts, no design work.
