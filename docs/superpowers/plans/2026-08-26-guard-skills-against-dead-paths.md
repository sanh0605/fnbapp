# Put the skills behind the same gate as the rulebook

**Written 2026-08-26 by Opus 5.** Handoff to Sonnet 5. Two lines of change; the
reason is longer than the diff.

## 1. Why

`.claude/skills/fnbapp-bulk-data-change/SKILL.md` — read before every bulk write
to production — described a nightly job at `/api/cron/apply-backdated-corrections`
sweeping two queue tables. Measured 2026-08-26: `app/api/cron/` is empty,
`vercel.json` is `{}`, and neither table exists. Retired by Plan C Task 6, the
warning left behind for weeks.

`check-rules-current` would have caught it — but only if two things were true,
and neither was:

1. The skill is in `RULE_DOCS`. It is not; the list is `CLAUDE.md`,
   `docs/BUSINESS-RULES.md`, `docs/OPEN-ITEMS.md` and the operations docs.
2. The path is written repo-relative. `looksLikePath`
   (`scripts/check-rules-current-core.ts:30`) accepts a token only when it
   starts with one of `PATH_PREFIXES` (`app/`, `lib/`, …) or is a bare `.md`
   filename. `/api/cron/...` matches neither.

**Both verified by experiment**, not by reading: a scratch document containing
the same route written both ways was run through `checkRulesCurrent`. The
`app/api/...` form was reported as missing; the `/api/...` form passed silently.

## 2. The change

Add the skill documents to `RULE_DOCS` in `scripts/check-rules-current.ts` —
every `.claude/skills/**/SKILL.md`, discovered rather than hard-coded, so a new
skill is covered the day it is written.

`PATH_PREFIXES` already contains `.claude/`, so paths inside skills resolve.

## 3. What this does not fix, and must not be claimed to

- **Table and column names.** `backdated_ledger_events` is backticked in the
  same sentence and no offline check can know it is gone. That needs a check
  that queries the database, which this gate deliberately is not — it runs in a
  pre-commit hook. A separate on-demand script is the right home; not in scope.
- **Numbers written into prose.** Nothing can tell a recorded measurement from a
  claim about the present. Only `CLAUDE.md`'s Rule 0 covers that, and it is
  discipline rather than a gate. Say so plainly in the report rather than
  letting this change imply broader coverage than it has.

## 4. Verification

- **A test that fails first**: put a dead repo-relative path into a scratch
  skill file, run the gate, confirm it is named. Then remove it.
- Run the gate against the **real** tree afterwards: it must pass, which also
  proves no existing skill carries a dead path today.
- `CLAUDE.md` §9's four gates. Do not push.
