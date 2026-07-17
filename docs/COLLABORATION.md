# Collaboration Protocol

This file is the single source of truth for coordinated work in repo `fnbapp`.
All agents read it at the start of every session.

Agents:

- Claude Code / GLM 5.1: coordination, specs, review, surgical fixes, tracking.
- Codex / GPT 5.6 family (`gpt-5.6-sol` frontier, `gpt-5.6-terra` balanced, `gpt-5.6-luna` fast, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`): engine, data correctness, migrations, audits, multi-file refactors.
- Antigravity / Gemini family (`Gemini 3.1 Pro` Low/High effort, `Gemini 3.5 Flash` Low/Medium/High, also Claude Sonnet/Opus 4.6 Thinking, GPT-OSS 120B): UI/frontend, responsive layouts, forms, visual QA.

Do not treat ownership as identity-based permission. Ownership follows risk boundary.

## A. File Map

Read before each session:

- `CLAUDE.md` section 0: Claude-specific project instructions.
- `AGENTS.md`: Codex and Antigravity project instructions.
- `docs/COLLABORATION.md`: this protocol.
- `README.md`: product/setup entry point and canonical documentation map.
- `CONTEXT.md`: current business context and scope.
- `ARCHITECTURE.md`: runtime architecture and trust boundaries.
- `docs/FEATURE-CATALOG.md`: feature status and verification evidence (population begins in Pre-Audit C).
- `docs/BUSINESS-RULES.md`: approved/observed/unresolved operating-rule index.
- `docs/ACCESS-MODEL.md`: intended roles versus observed/verified enforcement.
- `docs/ROADMAP.md`: **single source of truth for pending work + priorities**.
- `docs/COMPLETED.md`: compact archive of finished outcomes.
- `docs/TESTING.md`: test strategy, commands, risk gates, and known gaps.
- `docs/COLLABORATION.md`: ownership, workflow, review, and communication protocol.
- `DEVELOPMENT-TRACKING.md`: detailed chronicle log (newest first).

Supporting authority remains outside the ten entry documents when specialist detail is required:

- `docs/domain-dictionary.md`: terminology when changing labels, sheets, reports, or domain code.
- `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`: MAC/COGS policy and design detail.
- `docs/audits/2026-07-16-drive-backup-policy.md` and `docs/operations/apps-script-drive-backup.md`: backup policy and operation.
- `docs/audits/**`, `docs/handoffs/**`, and completed plans: historical evidence, not current entry-point authority unless explicitly labeled.

## B. Status Markers

- `[ ]` pending.
- `[~C]` in progress by Claude.
- `[~X]` in progress by Codex.
- `[~A]` in progress by Antigravity.
- `[x]` done and verified.
- `[!]` blocked or needs review.
- `[-]` deferred or wontfix.

Rules:

- Do not delete task items. Preserve audit trail.
- `[x]` needs a short note with who completed it and verification.
- `[!]` and `[-]` need a reason.
- Only one agent should own an in-progress task marker at a time.

## C. Risk-Boundary Ownership

### Engine Files

Codex owns these. If another agent touches them, Codex review is required.

- `lib/mac-cogs.ts`
- `lib/fifo-tracker.ts`
- `lib/inventory-consumption.ts`
- `lib/report-v2-allocators.ts`
- `lib/cogs-drift-audit.ts`
- `lib/mac-cogs-audit.ts`
- `lib/purchase-ledger-rebuild.ts`
- `scripts/*cogs*`
- `scripts/*ledger*`
- `scripts/audit-pnl-mac-consistency.ts`
- `app/admin/orders/actions.ts` transaction/order-mutation paths only.
- `app/pos/actions.ts` transaction paths only.

### Backup Files

Codex owns the backup architecture and its future maintenance (added 2026-07-16 per Stabilization Phase 2 close). Claude retains final architecture/policy approval. Any production restore or production data write still requires explicit reviewed dry-run/apply plan.

- `supabase/functions/backup-to-drive/**` (Edge Function snapshot endpoint)
- `scripts/apps-script/backup-to-drive.gs` (Apps Script pull-model script)
- `lib/drive-backup*.ts` and `lib/drive-backup*.test.ts` (contract/handler/integration tests)
- `docs/operations/apps-script-drive-backup.md` (owner setup runbook)
- Backup schema decisions: table allowlist, `schemaVersion` bumps, retention policy (daily/monthly split, counts)
- Drive folder layout, idempotency, capacity monitoring
- `BACKUP_PULL_TOKEN` rotation runbook
- Backup completeness audits and restore planning/verification
- Future Drive → R2/B2 migration when bundle reaches 25 MB threshold (or runtime > 90 sec, or Apps Script unreliability)

### UI Files

Antigravity owns these. Claude review is required before commit when the change is user-facing.

- `app/**/page.tsx`
- `app/**/components/*.tsx`
- `components/*`
- Form UX, responsive behavior, modal layout, visual QA.

If UI changes server actions or data flow, Codex review is also required.

### Spec And Protocol Files

Claude owns these. Codex review is required for engine/data claims.

- `docs/COLLABORATION.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/superpowers/specs/*`
- `DEVELOPMENT-TRACKING.md` is append-only unless cleanup is explicitly requested.

## D. Seven Coordination Rules

1. No silent data writes.
   - Any script that writes Google Sheets must support dry-run by default.
   - It must print exact counts and targets.
   - `--apply` is required for writes. No `--apply` means read-only.

2. Commit per phase.
   - One commit equals one outcome plus verification.
   - Do not mix UI, engine, and data migration in the same commit.

3. Cross-boundary review is required.
   - UI changing server action or data flow: Codex review.
   - Engine changing visible report UI: Antigravity or Claude review.
   - Spec/protocol change: Claude approval first, including Codex proposals.

4. Handoff freshness.
   - Start each session with `git status`, `git log -5`, latest tracking, and handoff.
   - Do not rely on stale prompt summaries when the repo has moved.

5. No edits in unknown dirty files.
   - If worktree is dirty, inspect diff before editing the same file.
   - Assume dirty changes belong to another agent or the user.

6. Audit scripts are first-class deliverables.
   - Each engine/data fix should include or update a read-only audit script that verifies the invariant.
   - Unit tests are not enough for Google Sheets data correctness.

7. Model downgrade gate.
   - Mini/Flash models are allowed for rename, pattern-based tests, docs/tracking, mechanical cleanup, and small UI that does not touch actions.
   - Mini/Flash models are not allowed for migration `--apply`, COGS/FIFO/MAC, auth/transactions, Sheets batch update, or historical reprocessing.

## E. Merge Gate

Before ending a work phase, regardless of agent:

- Tests pass: current baseline is 191+ tests.
- TypeScript: 0 errors. **Enforced automatically by Husky pre-commit hook** (`.husky/pre-commit` runs `tsc --noEmit`). Next.js SWC may compile code that strict tsc rejects, so the hook catches issues that `npm test` alone would miss.
- MAC drift audit: 0 mismatch.
- COGS drift audit: 0 mismatch or explicitly documented as informational.
- P&L MAC consistency audit: 0 delta when report/COGS changed.
- Current stock/order ledger/purchase ledger audits clean when related areas changed.
- Commit prefix:
  - `Claude <type>:`
  - `Codex <type>:`
  - `Antigravity <type>:`
- Do not push unless the user explicitly asks.

If the pre-commit hook blocks a commit that the agent believes should be allowed (e.g., WIP, intentional broken state for hand-off), use `git commit --no-verify` and note in the commit message. Do not make `--no-verify` a habit.

## F. Session Start Checklist

1. Read `CLAUDE.md` section 0 or `AGENTS.md`, depending on agent.
2. Read `DEVELOPMENT-TRACKING.md` 3 newest entries.
3. Read `docs/audits/codex-handoff-2026-06-25.md`.
4. Run `git status` and `git log -5`.
5. Pick a `[ ]` task and mark it in-progress with `[~C]`, `[~X]`, or `[~A]`.
6. Do the work.
7. Verify.
8. Commit.
9. Update tracking and handoff from `[~*]` to `[x]`, `[!]`, or `[-]`.

## G. Model Selection per Task Type

Pick the model tier that matches task complexity. Start lower, escalate if the agent gets stuck. Token cost scales with reasoning level — don't burn Pro High on trivial work.

### Codex (engine)

| Task type | Model | Reasoning | Example |
|---|---|---|---|
| Mechanical 1-2 lines | `gpt-5.4-mini` | Low | Rename, delete nav link, constant change |
| Standard refactor + tests | `gpt-5.4` | Medium | 1-2 functions with pattern already in codebase |
| Multi-file refactor / logic | `gpt-5.5` | Medium | Cursor pagination, audit script with new logic |
| Architecture / schema / migration | `gpt-5.6-sol` | High | RPC design, RLS policies, migration with trigger |
| Debug investigation / drift | `gpt-5.6-sol` | High | Root cause analysis, race condition, data drift |
| Multi-agent agentic workflow | `gpt-5.6-sol` | Max or Ultra | Franchise spec, multi-tenant RLS design |
| Fast/cheap agentic batch | `gpt-5.6-luna` | Medium | Bulk edits, mechanical refactors across many files |

### Antigravity (UI)

| Task type | Model | Example |
|---|---|---|
| Mechanical 1-2 lines | `Gemini 3.5 Flash (Low)` | Rename label, delete redundant entry |
| Single component / small form | `Gemini 3.5 Flash (Medium)` | Form update, modal tweak |
| Multi-component page | `Gemini 3.5 Flash (High)` | New admin page with several sections |
| Design system consistency | `Gemini 3.1 Pro (Low)` | Apply design tokens across multiple files |
| Mobile-first complex / critical UI | `Gemini 3.1 Pro (High)` | POS mobile redesign, accessibility-critical flows |
| Free tier / bulk read-only | `GPT-OSS 120B (Medium)` | Summary tasks, doc reads (no production writes) |

### Claude (this agent)

Single model `GLM 5.1[1m]`. Used for coordination, review, planning, surgical fixes. Claude does not get delegated engine/UI implementation — that goes to Codex/Antigravity.

### Selection rules

- Match tier to risk: production migration → at least `gpt-5.6-sol` High. Trivial UI tweak → Flash Low.
- User explicitly approves model choice for high-cost tiers (`gpt-5.6-sol` Max/Ultra, `Gemini 3.1 Pro (High)`).
- If agent stuck at lower tier for >2 iterations, escalate one level.
- For long sessions (1+ hour), prefer mid-tier to conserve token budget.
- Codex `/model` and Antigravity `/model` commands show available tiers per project plan.

## H. Handoff Message Format

Khi Claude giao task cho Codex/Antigravity, output cho user copy-paste phải:

1. **1 dòng directive tiếng Việt, nói như người** — trong quotes, reference file handoff bằng backtick path. User copy nguyên câu quotes dán vào chat của agent.
   - ĐÚNG: `"Đọc và triển khai Task 3.4 theo \`docs/handoffs/2026-07-15-codex-task-3.4-outside-cohort-investigation.md\`, commit rồi chờ Claude review"`
   - SAI: "Pickup Task 3.4 — investigate 224 outside-cohort MAC mismatches (read-only)."
   - Tránh "Pickup", "execute", "process this task" — bureaucratic, không phải lời nói.
   - Không dùng `cat` command — agent tự mở file khi đọc.
2. **Model recommendation** — 1 dòng riêng bên dưới, kèm lý do ngắn, reference Section G.

### Template

```
Paste cho [Agent]:
"<câu directive tiếng Việt> theo `docs/handoffs/<file>.md`, commit rồi chờ Claude review"

Model: `<model>` `<reasoning>` — <lý do ngắn> (Section G).
```

### Ví dụ cụ thể

**Cho Codex (engine):**
```
Paste cho Codex:
"Đọc và triển khai Task 3.4 theo `docs/handoffs/2026-07-15-codex-task-3.4-outside-cohort-investigation.md`, commit rồi chờ Claude review"

Model: `gpt-5.6-sol` High — drift root cause investigation (Section G).
```

**Cho Antigravity (UI):**
```
Paste cho Antigravity:
"Đọc và triển khai UI-XX theo `docs/handoffs/2026-07-XX-antigravity-...md`, commit rồi chờ Claude review"

Model: `Gemini 3.5 Flash (Medium)` — single component form update (Section G).
```



- COGS valuation: MAC, pinned into `Order_Lines_V2.cost_at_sale`.
- Inventory quantity: `Stock_Ledger.quantity_change`.
- FIFO: audit/debug only, not the primary P&L contract.
- P&L MAC breakdown refactor: implemented by Codex in commits `a63f0b1` and `4bf795c`.
- P&L consistency audit: `scripts/audit-pnl-mac-consistency.ts`.

## I. Communication Style with Business Owner

**The user is the business owner, not a system builder.** All agents (Claude, Codex, Antigravity) must apply this rule to EVERY communication that reaches the user — whether direct chat response, paste message, status report, summary, or any artifact the user will read.

### Critical scope (apply to ALL agents, ALL user-facing output)

This rule applies whenever an agent's output will be read by the user:
- **Direct chat responses** from Claude to user
- **Paste messages** that user will copy to Codex/Antigravity (Pattern A in Section H)
- **Codex/Antigravity responses** that user will paste back to Claude or read directly
- **Status reports, summaries, audit results** presented to user
- **Vietnamese-facing parts** of any doc the user reads

When in doubt: translate to plain Vietnamese before showing to user. Technical English OK in code, audit reports, internal agent-to-agent communication. NOT OK when user is audience.

### Rules

1. **Plain Vietnamese by default.** No high-level tech jargon unless user asks deeper.
   - ĐÚNG: "Backup chạy mỗi ngày 02:30, file lưu 30 ngày rồi tự xóa."
   - SAI: "pg_cron schedule triggers Apps Script pull-model endpoint with 30-day rolling retention."

2. **Explain when asked, not before.** Don't preempt with technical detail unless user requests depth. If user asks "why?" or "explain deeper", THEN use technical terms freely, but always define on first use.

3. **Translate tech issues to business impact.** When a technical issue blocks work, frame in business terms:
   - ĐÚNG: "Backup hiện lỗi vì Google chặn kiểu kết nối đó — cần đổi cách. Có 3 lựa chọn với đánh đổi X/Y/Z."
   - SAI: "403 storageQuotaExceeded — SA has no quota in My Drive, need OAuth delegation or Workspace."

4. **Decisions belong to user.** Agents recommend options with tradeoffs; user picks. Don't decide unilaterally. Don't push one option without surfacing alternatives.

5. **Code in English, communication in Vietnamese.** Per existing protocol — code/comments English, user-facing text Vietnamese. Apply same to chat with user.

6. **Audit docs and policy docs**: English for technical detail (audience = future devs/agents). Add plain Vietnamese summary at top if user will read directly.

7. **Agent → user translation layer (Claude's job)**: When Codex/Antigravity sends a technical response, Claude MUST translate to plain Vietnamese before showing to user. Don't copy-paste raw technical content. Don't forward commit SHAs, file paths, or technical identifiers unless user explicitly asked for them.

### Why

User has explicitly stated they are the business owner, not a developer. They make business decisions based on agent recommendations. Tech jargon creates barrier to decision-making. Plain language = better decisions, fewer miscommunications, faster sessions.

User explicit feedback 2026-07-17: "em vẫn chưa dùng cách nói phù hợp với người dùng enduser như anh" — communication still too technical even after Section I added. Strengthen rule.

### How to apply

| Output type | Language | Style |
|---|---|---|
| Chat response to user | Vietnamese | Plain, business framing, no jargon |
| Paste message for agent (user copies) | Vietnamese | Plain directive (Pattern A per Section H) |
| Codex/Antigravity response to user | **Vietnamese, translated by Claude** | Claude translates raw technical response → plain Vietnamese before showing |
| Commit message | English | Per existing protocol |
| Code + comments | English | Per existing protocol |
| Audit / investigation report | English | Technical, for devs/agents |
| Policy doc user reads | Vietnamese summary + English detail | Plain top, technical bottom |
| Tracking entries | Mixed OK | English facts, Vietnamese context |

### Drift trigger

If user asks "what does X mean?" more than once in a session, says "anh nghĩ cần trao đổi trực tiếp với [agent]", or says "em vẫn chưa dùng cách nói phù hợp" — communication style is drifting technical. **STOP, reset to plain language, translate any pending technical content.**

### Specific words to avoid (use plain alternative)

| Avoid | Use instead |
|---|---|
| endpoint | đường dẫn / cổng truy cập |
| middleware | lớp bảo vệ / bỏ qua |
| commit / SHA | lần lưu thay đổi / phiên bản |
| push | đưa lên mạng / đưa lên GitHub |
| Codex / Antigravity | đội kiểm tra / đội giao diện |
| Phase 0 / containment | bước đầu bảo vệ / khóa nguy hiểm |
| P0 exposure | lỗ hổng nghiêm trọng |
| deprecated | lỗi thời / không còn dùng |
| adapter | bộ kết nối |
| grep | tìm kiếm |
| TS clean / build pass | code chạy OK, không lỗi |
| regression | hỏng sau khi sửa |
| refactor | cấu trúc lại |
| migration | cập nhật cấu trúc dữ liệu |

When forced to use a technical term, **always** define on first use in same response.

## Quick Links

- Roadmap (pending work): `docs/ROADMAP.md`
- Completed archive: `docs/COMPLETED.md`
- Detailed chronicle: `DEVELOPMENT-TRACKING.md`
- Domain dictionary: `docs/domain-dictionary.md`
- UI audit reference: `docs/audits/2026-07-06-ui-consistency-audit.md`

## Change Log

- 2026-07-17 Codex: refreshed Section A for the approved ten-document canonical entry set and three-tier authority model. Specialist MAC/backup/domain sources remain supporting authority; audits/handoffs/completed plans remain historical evidence. Pending Claude protocol review.
- 2026-07-17 Claude: Strengthened Section I "Communication Style with Business Owner" per user explicit feedback. Rule now applies to ALL agents (Codex/Antigravity/Claude) for ALL user-facing output. Added rule 7 (Claude translates technical agent responses → plain Vietnamese before showing user). Added word-to-avoid table with plain alternatives. Drift trigger expanded to include user complaint "em vẫn chưa dùng cách nói phù hợp".
- 2026-07-16 Codex+Claude: Stabilization Phase 2 closed. Added "Backup Files" subsection to Section C — Codex owns backup architecture (`supabase/functions/backup-to-drive/**`, `scripts/apps-script/backup-to-drive.gs`, `lib/drive-backup*.ts`, retention/schema decisions, restore planning, R2/B2 migration trigger). Claude retains final architecture/policy approval + protocol ownership. Any production restore still requires reviewed dry-run/apply plan.
- 2026-07-16 Claude: added Section I "Communication Style with Business Owner" per explicit user directive (strengthened 2026-07-17 above).
- 2026-07-13 Claude: added Section G "Model Selection per Task Type" with Codex/Antigravity/Claude matrix. Updated agent lineup with available model tiers.
- 2026-07-10 Claude: consolidated to single ROADMAP.md + COMPLETED.md. Removed per-agent roadmaps.
- 2026-06-26 Codex: rewrote protocol for 3-agent coordination and risk-boundary ownership.
