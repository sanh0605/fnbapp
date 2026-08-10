# Plan E — Clear the spent tooling out of `lib/`, then decide whether to split by domain

**Written 2026-08-10 by Opus 5.** Owner chose this work on 2026-08-10, after
Plans C and D closed. It is `docs/OPEN-ITEMS.md` item 27, deferred on 2026-08-02
until the costing change landed. It has landed.

---

## 1. Why the shape of this plan changed before it was written

The deferred work was described as "restructure `lib/` by business domain". Two
independent measurements taken today say that is the **second** job, not the
first.

**Roughly half of `lib/` is no longer on any live path.** Measured three ways:

| Measure | Figure |
|---|---|
| Top-level modules not imported by `app/` or `components/` | **38 of 86** |
| All modules (incl. subdirectories) off the live path | **54 of 106** |
| Modules imported only by `scripts/` | **31–33** |
| Modules imported by nothing at all | **8–9** |

Nearly all of it is one-off repair tooling from Plans C and D — the scripts that
rebuilt the ledger, corrected costs, and retired the backdating machinery. It did
its job. It is not wrong that it exists; the repo deliberately never deletes a
script that has run.

**Sorting rubbish into labelled drawers is still sorting rubbish.** Splitting 106
modules across domain folders when half are spent tooling makes the live surface
look four times more tangled than it is, and every future reader pays that cost.

---

## 2. The measurement, and what two independent runs showed

Both `Sonnet 5` and `Gemini 3.1 Pro` (via Antigravity) measured this
independently, without seeing each other's work. The owner asked whether the
second agent was worth using; this was the test.

**Where they agreed, the number is trustworthy:** both returned **106 modules**,
up from the 78 recorded on 2026-08-02. Both covered all four import forms — the
trap that made the first-ever attempt wrong by a factor of five — and both built
a control before reporting. Sonnet's control caught a 12-module error in its own
first pass (`require(...)` calls it had missed) and it fixed it before reporting.

**Where they diverged, the divergence is the finding.** Gemini counted *who
imports a module*. Sonnet asked *whether the module is still on a live path*. On
the mechanical question they matched; on the question that decides this plan they
did not:

| | Gemini | Verified |
|---|---|---|
| `inventory-consumption` | 27 importers, treated as core | **No live screen uses it.** All 27 are one-off scripts and tests |
| `mac-cogs` | 23 importers, treated as core | **2 live callers**, both the product cost-*estimate* page, not reporting |
| `issue-costing` | not mentioned | **This is the costing engine** — Plan D wrote it; the 2026-08-02 map predates it |
| Old conclusion "the tangle is infrastructure" | *"VẪN CÒN ĐÚNG 100%"* | Restated confidently about modules that no longer run |
| Cluster table | sums to 86 of 106 | Sonnet's sums to exactly 106 |

Recorded because the lesson generalises: **a confident wrong answer is more
dangerous than an uncertain one**, since certainty suppresses the instinct to
check. The verification instinct is also fallible in the other direction — the
coordinator's own check of Sonnet's claim initially matched a *comment*
containing the module name and briefly concluded Sonnet was wrong. Grep does not
know what an import is.

---

## 3. Rules this plan works under

1. **Nothing is deleted.** `CLAUDE.md` section 2 protects master data; the
   repo's own convention protects executed scripts, which stay as the record of
   what was done to real data. Spent tooling is **moved and labelled**, never
   removed — and the modules it depends on must keep compiling.
2. **Every step ships on its own.** A restructure has no owner-visible benefit,
   so it may not carry owner-visible risk. If a step cannot be verified green and
   left alone, it is too big.
3. **Pure moves only in phases E2–E3.** No logic changes, no renames of exported
   symbols, no "while I am here" improvements. A move that also edits behaviour
   cannot be reviewed as a move.

---

## 4. Tasks

- **E1 — Classify every module, and let the owner see the list.**
  Three buckets: **live** (reachable from `app/` or `components/`), **spent**
  (only `scripts/` reaches it), **orphan** (nothing reaches it). Output a table
  naming every module. This is the artifact worth arguing about; everything after
  it is mechanical.

  Two judgement calls to surface rather than silently make: a module used only by
  an *audit* script the shop still runs is **live tooling**, not spent; and a
  module whose only importer is a test is **orphan**, because a test proving that
  dead code still works proves nothing.

- **E2 — Segregate the spent tooling.** Move it under one clearly named
  directory (`lib/historical/` or similar — Sonnet chooses, then says why). Pure
  moves plus import-path updates. `tsc` catches every miss by construction.

  Afterwards `lib/`'s top level shows only what runs. That alone is most of the
  value on offer here.

- **E3 — Deal with the 8–9 orphans.** Nothing imports them. Confirm each is truly
  unreferenced with all four import forms before touching it, then move it beside
  the spent tooling with a one-line note saying when it was last used. Do not
  delete; do not "tidy" it into a shorter file.

- **E4 — DECISION POINT, not a task.** Re-measure after E2 and E3. If the ~50
  surviving live modules are not genuinely tangled across business domains, **the
  domain split does not happen** and this plan ends here. Splitting for tidiness
  is not a reason to touch a working system.

  The 2026-08-02 map concluded the tangle was infrastructural rather than
  cross-domain. That conclusion was reached about a codebase half of which is now
  dead — so it must be re-tested on what remains, not inherited.

- **E5 — Only if E4 says yes.** Split the surviving modules by business domain,
  one domain per step, each shipped separately.

- **E6 — Oversized files, only if E4 says yes.** 10–12 files exceed 500 lines
  (`lib/history-ops/hong-luc-migration.ts` 981, `app/admin/reports/actions.ts`
  902, `components/POSScreen.tsx` **1.378** — the last one absent from Gemini's
  list because the instruction said `app/` and `lib/`, which it flagged rather
  than quietly included). Note that E2 will move some of the largest into the
  historical directory, where their size stops mattering.

---

## 5. Verification bar

`CLAUDE.md` section 9 in full — including `npm run build` and, for anything that
reaches a screen, the owner opening it signed in.

Additionally, for every move:

- **No behaviour change is intended, so no test may change.** If a test needs
  editing to pass after a pure move, the move was not pure — stop and say so.
- Import counts before and after must match per module. A move that loses an
  importer has broken something `tsc` did not catch, such as a dynamic
  `require`.
- `npx vitest run` green, and the count of tests must not fall.

---

## 6. Out of scope

Item 35 (revenue never audited) and item 31 (financial report, parked on assets
and depreciation) are not touched here. Neither is item 37, the missing guard on
deleting an item's last countable conversion — real, and unrelated to moving
files.
