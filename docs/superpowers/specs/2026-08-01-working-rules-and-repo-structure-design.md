# Working Rules and Repository Structure — Design

Date: 2026-08-01
Status: design, pending owner review
Author: Opus 5 coordinator, from a brainstorming session with the owner 2026-07-31

## Tóm tắt cho chủ quán

Bốn bộ tài liệu quy tắc hiện tại đã lệch thực tế và không ai duy trì nổi. Bản
thiết kế này thay chúng bằng **ít văn bản hơn và nhiều cơ chế tự chạy hơn**,
theo bốn nguyên tắc:

1. Luật nằm ở chỗ máy tự nạp (`CLAUDE.md`), không nằm ở file phải nhớ mở
2. Luật gắn theo **mức rủi ro** ("đụng tiền", "ghi dữ liệu thật"), không gắn
   theo đường dẫn file — để lát nữa dọn thư mục không phá quy tắc
3. Phần chặn lỗi chuyển thành hook và skill, tự kích hoạt đúng lúc
4. Quy tắc kinh doanh viết bằng **tên bài kiểm thử tiếng Việt** — chạy kiểm thử
   là in ra bộ luật, vi phạm là dòng đỏ

Sau đó mới dọn thư mục, chia theo **mảng nghiệp vụ** và nhắm sẵn cho nhiều chi
nhánh, đồng thời tách nhỏ mấy file quá lớn.

---

## 1. The problem, with evidence

The owner's diagnosis, 2026-07-31: rules are scattered and too long, so nobody
maintains them — and that is *why* they became untrue and *why* they stopped
catching errors. Measurements taken the same session support it.

**Four overlapping rule documents**, totalling 719 lines:

| File | Lines | Role |
|---|---|---|
| `docs/COLLABORATION.md` | 404 | Protocol, ownership, model tables, communication style |
| `AGENTS.md` | 110 | Explicit *mirror* of the above for Codex/Antigravity |
| `CLAUDE.md` | 95 | Behavioural guidance + a list of files to read |
| `docs/FILE-ORGANIZATION.md` | 110 | Where new files go |

**They are demonstrably stale.** `COLLABORATION.md` describes the coordinator as
"GLM 5.1", names Antigravity as the UI owner, states a test baseline of "191+"
against an actual 939, and assigns `scripts/**` to Codex. `AGENTS.md`, being a
hand-maintained mirror, has drifted from the file it mirrors: it still names
Antigravity as UI owner where `COLLABORATION.md` names Sonnet 5. Two files, one
truth, and the copy lost.

**Owner correction, same session:** the project now has **only two agents, Opus 5
and Sonnet 5**. Codex and Antigravity are gone. That retires the model-selection
matrix (section G), the "Paste cho Codex/Antigravity" handoff template (section
H), the `[~X]`/`[~A]` status markers, and the entire three-vendor ownership
table — roughly half of `COLLABORATION.md`.

**The rules also failed to prevent a real defect.** On 2026-07-31 a plan
certified "behaviour-neutral" issued 124 `UPDATE`s against `recipes`, unaware
that the table carries an `after insert or update` trigger feeding an automated
nightly correction cron with authority to rewrite historical cost data. Nothing
in any of the four documents had a place where that check would have surfaced.
Full analysis: `docs/audits/2026-07-31-start-date-backfill-trigger-fallout.md`.

**The one rule that never rotted** is not in any of those documents. It is
`.husky/pre-commit`, which runs `tsc --noEmit` on every commit. Prose must be
remembered to stay true; a mechanism reports when it is false. That asymmetry is
the design principle for everything below.

## 2. Owner decisions recorded

All four taken 2026-07-31 during brainstorming.

| # | Decision |
|---|---|
| D1 | Working rules first, repository restructure second — because ownership rules are currently path-indexed, so restructuring would invalidate them. |
| D2 | Root cause to fix is the scatter (all three symptoms follow from it), not merely the inaccuracies. |
| D3 | Sonnet challenges every Opus plan before implementing. This replaces the independent-review capacity lost when Codex left. |
| D4 | The restructure is organised by **business domain and aimed at multi-branch**, and includes splitting oversized files. UI/UX rules come after it. |

## 3. Design

### 3.1 Three tiers, split by how fast content rots

Not by topic. Topic-based grouping is what buried the durable rules underneath
the perishable ones.

| Tier | Content | Where it lives | How it stays true |
|---|---|---|---|
| **A — durable** | Process, risk boundaries, communication rules | `CLAUDE.md` (auto-loaded), `docs/BUSINESS-RULES.md` | Rarely changes; short enough to re-read |
| **B — perishable** | Counts, agent roster, paths, migration numbers | Nowhere as prose | `scripts/check-rules-current.ts` compares docs against reality and fails when they disagree |
| **C — historical** | Change log, superseded rules, why a rule changed | **git** | Immutable by construction; nothing to maintain |

**Tier C is git, not a document.** An earlier revision of this design proposed
`docs/rules-history.md`. The owner rejected it (2026-08-01): git already stores
every version of every rule document and every commit message explaining why a
rule changed. Writing a file to hold what git already holds repeats the exact
defect this design exists to remove — `AGENTS.md` was a hand-maintained copy of
`COLLABORATION.md`, and the copy drifted.

The only history that belongs in a live document is the **approval stamp on a
rule still in force**: the date, and that the owner approved it. One line, inline
with the rule it authorises. `CLAUDE.md` section 9's "owner xác nhận 2026-07-22"
is the model — that stamp is what makes it a rule rather than an opinion.

### 3.2 Tier A goes in `CLAUDE.md` itself, not in a file it points to

The harness loads `CLAUDE.md` into context automatically at session start. Any
other document must be voluntarily opened. `CLAUDE.md` section 0 currently
instructs agents to read six other files before working; those files have been
stale for weeks without anyone noticing, which is direct evidence that the
instruction is not followed.

Therefore the always-true rules are written **into** `CLAUDE.md`. No
`WORKING-RULES.md` is created. Everything else is referenced, not required.

**Hard constraint: `CLAUDE.md` stays at or under 130 lines.** It is loaded on
every session, so length is a recurring cost. Anything that does not need to be
in working memory every session belongs in Tier B or C.

Revised from 120 on 2026-08-01, after drafting. 120 was picked before any of the
content existed — the finished draft lands at exactly 120 with nothing left to
remove but rules, which would have meant shaving prose to satisfy a guess. The
ceiling exists to stop the file drifting back toward 400 lines; 130 does that
just as well, and leaves the drafted file ten lines of honest headroom.

### 3.3 Rules are indexed by risk, never by file path

This is what killed the previous protocol. Section C enumerates `lib/mac-cogs.ts`,
`lib/fifo-tracker.ts`, `scripts/**`, `app/**/page.tsx`. Every one of those
becomes wrong the moment the restructure runs.

The replacement names **categories of work**, which survive refactoring:

| Risk category | Rule |
|---|---|
| Touches cost or stock valuation | Plan required; Sonnet challenge required; audit script accompanies the change |
| Writes to production data | Dry-run by default, `--apply` to write, exact counts printed first; owner approves the apply |
| Visible outside the local repo (push, deploy) | Owner approves, every time, no standing authorisation |
| Changes a business rule | Rule and its test updated in the same commit |
| Everything else | Agent decides and reports |

This also removes the need to rewrite the rules after the restructure — the
second-order benefit that makes phase 3 cheaper.

### 3.4 Error prevention moves from documents to mechanisms

A plan template shares the defect of a rules document: it works only if someone
remembers to open it. Two mechanisms fire without being remembered.

**A hook** (`.claude/settings.json`) that triggers on the actions that have
actually caused damage:

- a Bash command containing `--apply`
- an edit to `supabase/migrations/**`

It prints the mandatory checklist, which includes the item that would have caught
the 2026-07-31 defect: *list the target table's triggers and state what each one
does with the rows being touched.*

**A project skill** describing bulk data changes (backfill, migration,
historical reprocessing), so the harness surfaces it by description-matching when
Sonnet picks up that kind of task. This carries the longer procedure that does
not belong in `CLAUDE.md`.

Neither depends on an agent choosing to read something first.

### 3.5 `scripts/check-rules-current.ts` — the Tier B mechanism

Three checks, each corresponding to a failure already observed. Deliberately
small; this script must not become a project of its own.

1. **Every file path named in a rule document exists.** Catches the restructure
   silently breaking the rules, and catches already-stale references.
2. **No retired agent name appears as current** (Codex, Antigravity, GLM,
   Gemini). Four files currently name them as active.
3. **Every rule in `BUSINESS-RULES.md` that declares a test link points at a test
   that exists.** This is what stops a business rule from being quietly edited
   away. Scoped to rules that declare a link, so the check is meaningful in
   phase 1 (when few rules have tests yet) and tightens naturally as phase 2
   fills the file. Phase 2 adds the stricter form: *every* rule must declare one.

Runs in `.husky/pre-commit` alongside `tsc`.

### 3.6 Business rules are written as Vietnamese test names

Rather than a rule in a document plus a separate test that must be kept in sync —
two artefacts that will drift, exactly like `AGENTS.md` drifted from
`COLLABORATION.md` — the test name *is* the rule statement:

```
✓ tiền luôn làm tròn lên, tồn kho luôn làm tròn xuống
✓ giá vốn tính theo bình quân gia quyền, không phải giá nhập gần nhất
✓ bán hàng thiếu bán thành phẩm thì tự sinh lệnh nấu ngầm
```

Running the suite prints the rulebook. Violating a rule produces a red line
carrying a sentence the owner can read directly. `BUSINESS-RULES.md` holds the
rule, its worked example in real numbers, the date the owner approved it, and a
link to the test.

**First content to capture, because it currently exists only in code:** the
display-rounding rule (`lib/display-rounding.ts` — stock floors, money ceils,
"never flatter the business"). It is a genuine owner decision recorded in no
document. If someone "tidied" it, reported profit would improve silently.

Second: the inventory and COGS ground-truth rule, currently in `CLAUDE.md`
section 9, which belongs in `BUSINESS-RULES.md` with the rest of the domain
truth.

### 3.7 No empty sections for future rules

Empty sections do not fill themselves; they only lengthen the file. What actually
loses a rule is that the owner decides it in conversation and it is never
written. The replacement is a trigger rule, in Tier A:

> When the owner decides something that changes how a number is calculated, how
> it is displayed, or how the shop operates, it is written into
> `docs/BUSINESS-RULES.md` in the same session, with the date.

Precedent: `CLAUDE.md` section 9 exists only because an inventory rule confirmed
verbally on 2026-07-22 was captured at the time.

### 3.8 Target file set

| File | Tier | Change |
|---|---|---|
| `CLAUDE.md` | A | Rewritten as the working rulebook, and the only rule document read every session |
| `docs/BUSINESS-RULES.md` | A | Exists; gains calculation and display sections, each linked to a test |
| `scripts/check-rules-current.ts` | B | New. Three checks |
| `.claude/settings.json` | B | Gains the hook |
| `.claude/skills/fnbapp-bulk-data-change/SKILL.md` | B | New. The bulk-data-change procedure |
| `docs/COLLABORATION.md` | — | **Deleted.** Living content moves to `CLAUDE.md`; history stays in git |
| `AGENTS.md` | — | **Deleted** |
| `docs/FILE-ORGANIZATION.md` | — | **Left untouched in phases 1-2.** It governs where new files go and is still correct for `docs/` and `scripts/`. Phase 3 supersedes it, and retires it then — not before. |

### Why both coordination files are deleted rather than kept

Owner question, 2026-08-01: is `COLLABORATION.md` needed at all, or was it only
needed with two or more AI vendors?

Only with two or more. Its own opening line states its purpose — a single source
of truth that *all agents* read at session start. It existed because each vendor
loads a different instruction file: Claude Code reads `CLAUDE.md`, Codex reads
`AGENTS.md`, Antigravity its own. No file was read by all three, so a neutral
shared document had to sit between them.

With only Opus 5 and Sonnet 5 — **both Claude Code, both auto-loading the same
`CLAUDE.md`** — there is no gap left to bridge. The same reasoning deletes
`AGENTS.md`, which is the Codex convention specifically. If a non-Claude tool
ever joins, recreating a three-line pointer takes a minute; carrying two dead
files until then costs every session.

**Reference impact, measured:** 68 files mention `COLLABORATION.md`. About 30 are
`docs/handoffs/` briefs addressed to Codex or Antigravity — immutable
point-in-time records whose dead links harm nothing. Roughly 11 living documents
(`README.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/TESTING.md`,
`docs/FILE-ORGANIZATION.md`, `docs/ACCESS-MODEL.md`, `docs/FEATURE-CATALOG.md`,
`docs/COMPLETED.md`, `docs/OPEN-ITEMS.md`, `DEVELOPMENT-TRACKING.md`,
`CLAUDE.md`) plus three code comments must be repointed **in the same commit as
the deletion**. A tombstone file would not have avoided that work — it would only
have left a dead end behind. `check-rules-current.ts` check 1 catches any that
are missed, which is the checker earning its keep on its first day.

**This does not violate the repository's preservation rule.** That rule protects
business master data and audit evidence. A superseded process document is
neither, and git retains every version of it.

**Same cleanup, same cause:** `CLAUDE.md` currently instructs every session to
read `docs/handoffs/2026-06-25-codex-handoff-active-task-tracking.md` — a task
brief for an agent that no longer exists. The instruction goes; the file stays
where it is as a historical record.

## 4. Repository structure (phase 3 — direction only)

Detailed design belongs to its own spec. What is settled now is the destination,
because that determines whether the restructure is done once or twice.

**Measured state, 2026-08-01:**

- `lib/` holds 183 `.ts` files, of which **78 are source** and 105 are co-located
  tests. The co-location is fine and stays.
- Total source across `app/`, `lib/`, `components/`: ~42,000 lines.
- The maintainability problem is concentrated in a few oversized files, not in
  directory width:

  | File | Lines |
  |---|---|
  | `components/POSScreen.tsx` | 1,378 |
  | `app/admin/reports/actions.ts` | 1,110 |
  | `lib/history-ops/hong-luc-migration.ts` | 980 |
  | `app/admin/orders/actions.ts` | 755 |

**Direction (D4):** organise by business domain — sales, inventory, purchasing,
reporting, recipes — rather than by technical type (`lib/`, `components/`).
Multi-branch and franchise, the owner's stated later phases, partition along
domain lines; a technical-type layout would have to be redone at that point.

Splitting the oversized files is part of the same phase, and is the part that
most directly serves "easy to fix" — a 1,378-line file cannot be held in working
memory by anyone, human or agent.

Moving files invalidates import paths and documentation references, which is why
§3.3 (risk-indexed rules) must land first.

## 5. Sequencing

| Phase | Work | Gate |
|---|---|---|
| 1 | Working rules — this spec's §3 | `check-rules-current.ts` passes; suite green |
| 2 | Business rules — calculation and display, as tests | Every rule has a passing named test |
| 3 | Repository restructure — domain layout, oversized files split | Suite green; no behaviour change; imports resolve |
| 4 | UI/UX rules | Deferred by owner decision until after phase 3 |

Phases 1 and 2 are small. Phase 3 is the large one and gets its own spec.

## 6. Out of scope

- Everything in `docs/OPEN-ITEMS.md`, explicitly set aside by the owner for this
  work. Item 2b (the 132 spurious backdated-recipe events) remains open and
  time-sensitive on its own track.
- UI/UX rules — phase 4.
- The detailed restructure design — phase 3's own spec.
- Any behaviour change to the application. Phases 1-3 are documentation,
  tooling, and code movement only.

## 7. Verification bar

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — full suite green, no test removed without a stated reason.
- `scripts/check-rules-current.ts` — passes, and demonstrably fails when fed a
  stale path, a retired agent name, or a rule with no test.
- `CLAUDE.md` at or under 130 lines, and the only rule document a session must
  read.
- No living document or code comment still points at `docs/COLLABORATION.md` or
  `AGENTS.md`. Dead links inside `docs/handoffs/**` are accepted and expected.
- No file under `app/`, `lib/`, `components/`, or `supabase/` moved, renamed, or
  edited in phases 1-2. Those phases touch documentation, `.claude/`,
  `.husky/`, and one new script only.
- No push.
