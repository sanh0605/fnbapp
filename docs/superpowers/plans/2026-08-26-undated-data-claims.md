# A gate for undated data claims in the rulebook

**Written 2026-08-26 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1), especially §3's false-positive budget — if it is worse than
measured, say so and stop rather than shipping a noisy gate people learn to
ignore.

## 1. Why

`CLAUDE.md` §7 carried *"`stock_issues` hiện RỖNG … mọi báo cáo giá vốn hiện
0đ"*. True when written on 2026-08-07. False from 2026-08-09, when the first
stocktake closed. Still being read as current fact on 2026-08-26, seventeen days
later, by the agent that reads this file every session. The owner found it.

Told twice that this class "cannot be caught by a machine". **Both times that
was wrong**, and the second time it was wrong after a measurement was available
and not taken. It is catchable, imperfectly, and imperfect is worth having here.

## 2. The rule

In `RULE_DOCS` only: a line containing a **number with a data unit** must have a
**date** within a small window of lines, or the gate names it.

Units that make a number a data claim: `đ`, `dòng`, `đơn`, `món`, `file`,
`bảng`, `phép kiểm`, `MB`, `%`. Dates in either `DD/MM` or `YYYY-MM-DD` form,
both already used throughout the file.

**The date is the whole point.** It does not make the number true; it makes the
number *checkable*, and tells the reader how much to trust it. An undated
figure claims to be current for ever.

## 3. Measured before proposing, on `CLAUDE.md` as it stands

| | |
|---|---|
| Lines with a number and a data unit | **9** |
| Of those, with a date nearby | **5** |
| Flagged | **4**, now **3** after dating the `specs/` count |

Of the three that remain flagged, all are false positives of a kind worth
knowing:

- a quoted example — *"0 dòng lệch"* — illustrating a rule, not asserting data;
- a threshold — `~95%` — a target, not a measurement;
- a historical anecdote whose date sits further up the paragraph than the window.

**Three lines of noise on a 270-line file is the budget.** If the real number
after implementation is much higher, the rule is wrong and should be reported
as wrong rather than tuned until it passes.

**It would have caught the original defect:** the old §7 line carried `0đ` and no
date.

## 4. Design notes

- **An escape hatch is required**, or the false positives will be "fixed" by
  deleting useful sentences. An HTML comment marker on the line — something a
  writer adds deliberately — is enough. Do not make it silent or global.
- Scope to `RULE_DOCS` only. `DEVELOPMENT-TRACKING.md` is a dated log by
  construction and would drown the gate.
- This joins `paths-exist` as a second, weaker net. Neither replaces
  `CLAUDE.md`'s Rule 0, and the report must not imply otherwise.

## 5. The stronger check, for later — not in scope

Where a claim can be expressed as a query, a document could carry the query and
a script could run it, the way `scripts/verify-revenue.ts` already compares live
data to four frozen monthly figures. That is exact where it applies, unlike §2's
heuristic. Worth doing; a separate item, because it needs a database connection
and this gate deliberately runs offline in a pre-commit hook.

## 6. Verification

- **A test that fails first**: a fixture line with an undated `0đ` must be
  named; the same line with a date must pass.
- The escape-hatch marker suppresses exactly one line and not its neighbours.
- **Run against the real tree and report the count**, not just pass/fail. Three
  is the expected number; a different one means the detector disagrees with the
  measurement above and that is worth saying out loud.
- `CLAUDE.md` §9's four gates. Do not push.
