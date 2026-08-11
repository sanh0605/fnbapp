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
| `inventory-consumption` | 27 importers, treated as core | **See the correction below — the original claim here was wrong** |
| `mac-cogs` | 23 importers, treated as core | **2 live callers**, both the product cost-*estimate* page, not reporting |
| `issue-costing` | not mentioned | **This is the costing engine** — Plan D wrote it; the 2026-08-02 map predates it |
| Old conclusion "the tangle is infrastructure" | *"VẪN CÒN ĐÚNG 100%"* | Restated confidently about modules that no longer run |
| Cluster table | sums to 86 of 106 | Sonnet's sums to exactly 106 |

### 2a. Correction, 2026-08-10, from Sonnet's challenge round

**The `inventory-consumption` row above was wrong, and it was the row this plan
leaned on hardest.** It read "no live screen uses it". Sonnet re-ran the
reachability as a proper graph walk instead of a single hop and found:

```
app/admin/products/cogs-estimate/page.tsx → lib/mac-cogs.ts → lib/inventory-consumption.ts
```

The error was mine and Sonnet's together: their 2026-08-10 map counted **direct**
importers only, and this plan quoted that number as verification without walking
the graph. Ten modules move from "spent" to "live" once the walk is done — the
counts become **56 live / 42 spent / 8 orphan**, not 46/31/8.

**And the corrected version needs one more correction.** `lib/mac-cogs.ts:1`
reads `import type { ConsumptionRow }` — a **type-only import, erased at
compile time**. So no runtime code from `inventory-consumption` executes on that
path. Three statements, all imprecise: "no live caller" (wrong), "live via
mac-cogs" (true of compilation, not of execution), "still core" (wrong about its
role). The accurate one is narrower: **its runtime code is dead; only its type
declarations are still reached.**

**This creates a category E1 must carry: type-only edges.** A module reachable
from a live root *only* through `import type` has dead runtime code and live
declarations. It cannot simply be moved to the historical directory, and it is
not simply live either — the types want extracting. Classify these separately
rather than forcing them into one of the three buckets.

### 2b. Correction the third, 2026-08-10 — and the pattern is the point

**E1 measured it and `inventory-consumption` is plainly live.** Verified
directly: `lib/report-v2-allocators.ts:17` imports `buildLineConsumptionRows`
**without** `type`, calls it at line 204, and that file is imported by
`app/admin/page.tsx`, `app/admin/reports/actions.ts` and `app/pos/actions.ts`.
Real code, running on the dashboard, the sales report and the till.

Final counts: **54 live / 1 type-edge-only / 43 spent / 8 orphan = 106.** The
type-edge bucket was worth creating and holds exactly one module — not this one.

**Three wrong answers about one module, and all three failed the same way:**

| # | Who | Method | Conclusion |
|---|---|---|---|
| 1 | Sonnet's map | counted direct importers | "no live caller" |
| 2 | this plan | quoted that as verification | repeated it |
| 3 | this plan again | found the `mac-cogs` type edge | "runtime code is dead" |

The third is the instructive one, because it was written *while correcting the
first two*. Having found **a** path, it stopped and generalised from it — the
identical error to counting direct importers and stopping, approached from the
other direction and dressed as a more careful analysis.

**The rule this yields, and it governs E2 onward:** *is this module live?* cannot
be answered by finding one path. It is answered by enumerating **every** path and
finding no value edge. A single value import anywhere is enough to make a module
live; no number of type edges proves the opposite.

**Sonnet's own limit, self-declared and worth keeping:** it confirmed that
`report-v2-allocators` calls the function, not that every live caller reaches the
branch containing line 204. That is branch-level reachability, which nothing in
this plan has attempted and which E2 does not need — a module with a reachable
value import stays where it is regardless.

**On Gemini:** section 2 used the wrong row as the main evidence that Gemini's
count was misleading. It was less wrong than stated — it saw a real edge this
plan denied. What survives is the narrower point, about **role rather than
reachability**: the engine reports run on is `issue-costing`, which its report
never mentions, and "VẪN CÒN ĐÚNG 100%" remained an overclaim.

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

  **"The shop still runs it" requires evidence, not a plausible filename**
  (Sonnet's refinement, accepted). Valid evidence: listed in `package.json`
  scripts, wired into `.husky/`, or documented as a recurring job. Applied to the
  data, exactly **one** of the 31 script-only modules qualifies —
  `check-rules-current.ts`, in `.husky/pre-commit`. The other 30 are one-off
  investigations from Plans A–C; they are **spent** unless the owner says he
  still runs one by hand.

  **The roots list in this plan was wrong and is corrected here.** The real
  entry points:

  - `app/**` — but only `page.tsx` / `layout.tsx` / `route.ts` and Next.js's
    other special files are true roots. A component sitting in `app/` is reached
    *through* a page, so it needs the same graph walk. Sonnet flagged that its
    first pass treated all of `app/**` as roots and that this bound has not been
    tightened yet — do it in E1.
  - `components/**` — reached through `app/`, not an independent root.
  - `supabase/functions/backup-to-drive/**`, `backup-to-sheets/**`,
    `user-admin/**` — **three** edge functions. This plan named one.
  - `scripts/check-rules-current.ts`.
  - `middleware.ts` — a root, though it currently imports nothing from `lib/`.

  None of the three edge functions imports from `lib/` today, so the counts do
  not move — but they belong on the list so a future import is not missed.

  **`supabase/functions/backup-to-drive/core.ts` does not import
  `lib/backup-restore.ts`.** This plan asserted it did. The only occurrence of
  that path in the file is a comment about restore ordering. The coordinator
  wrote that assertion **into the same document that warns about being fooled by
  a module name inside a comment**, one turn after making the identical mistake
  while checking Sonnet's work. The trap does not care who is looking for it.
  `lib/backup-restore.ts` has exactly one real user:
  `scripts/restore-backup-to-target.ts`, run by hand.

  **"Orphan" is not "unchecked".** `tsc --noEmit` compiles every `.ts`/`.tsx` in
  the repo regardless of who imports it, so an orphan is still type-checked. It
  means "does not run in production", nothing more.

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

  ### E4 answered 2026-08-11: STOP. E5 and E6 do not happen.

  After E2 and E3, `lib/` holds **55 live modules** and `lib/historical/` holds
  **50**. For context, the 2026-07-24 audit counted ~85 modules in a flat `lib/`
  — the live surface is now **smaller than before Plans A–D began adding tooling
  to it**.

  Cross-domain usage of the 55, counted across `pos`, `admin/inventory`,
  `admin/reports`, `admin/orders`, `admin/products`:

  | Used by | Modules |
  |---|---|
  | exactly one domain | **29** |
  | two domains | 6 |
  | three or more | **4** |
  | reached only indirectly | 16 |

  **The four heavily-shared modules are `sheets_db`, `auth`, `format` and
  `order-types`** — database access, sign-in, number formatting, shared types.
  Infrastructure and a type module. Every domain using them is correct, in the
  way every room in a building uses the same wiring.

  **No business-logic module spans domains.** Twenty-nine already sit in exactly
  one. The 2026-08-02 conclusion survives re-testing on a codebase half of which
  has since been retired.

  **So the split would only make the folder tree resemble an arrangement that is
  already correct** — at the cost of touching 55 files. The burden is asymmetric:
  proceeding needs positive evidence of a tangle, stopping needs only the absence
  of it, and the absence is what was measured.

  **Limit of this measurement, stated rather than hidden:** it counted direct
  imports across five app areas, not the transitive walk E1 used, so the 16
  indirect modules are not precisely placed. The owner was offered a rigorous
  re-measure before committing to stop and chose to stop — reasonable, since a
  more careful measurement could only reveal *more* tangle, and 29-in-one-domain
  leaves little room for that to change the answer.

  **Redirected instead to `components/POSScreen.tsx`, 1.378 lines.** It is the
  till. A file that long means every change requires reading a thousand lines
  first, and every change is a chance to break the screen that takes money.
  Smaller job, concentrated risk, real benefit — unlike shuffling 55 files for a
  tidier tree.

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
