# Task: UI-REMED-1 Visual Smoke Test (Overdue Verification)

## Context

UI-REMED-1 (TOKEN-SWAP: migrate ~1039 raw Tailwind color occurrences to the
Fresh Blue design system tokens) closed 2026-07-17 across 5 commits
(`c33033f`, `8f93742`, `d239cbb`, `55ef69d`, `ee33450`). It was verified by
TypeScript compilation, production build, and the full test suite (403/403)
— but those checks cannot see color or layout. No one has actually opened
the app in a browser and looked at it since the migration finished. This
task closes that gap. It is pure verification, not new design work — the
migration itself is done and not being revisited here.

Coverage note: the migration reached ~94% (145 raw color occurrences remain
in `ui/*` primitives, gradient stops, and complex utility classes) — that
remainder is known and out of scope for this task; don't chase it down,
just don't be surprised if a handful of spots still look unmigrated.

## Scope

Run the dev server and visually check the following pages at two
breakpoints — mobile (375px) and desktop (1280px+):

- `/pos` — the checkout screen, cart panel, product cards, discount badges
  (these had dedicated redesign work in POS-REDESIGN-1; confirm the color
  migration didn't regress that separately-done work)
- `/admin` dashboard
- `/admin/orders` — table + mobile card fallback
- `/admin/reports/sales` and `/admin/reports/pnl` — including the heatmap
- `/admin/inventory` and at least one sub-page (e.g. `/admin/inventory/items`)
- `/admin/products` and `/admin/products/modifiers`
- Any Dialog/alert triggered from a page above (e.g. a delete confirmation)
  — check the 3 variants (info/warning/danger) render with correct colors
  and icons, since DialogHost variant-to-color mapping was touched in a
  related but separate change (UI-REMED-5)
- `/login`

For each page, look for: wrong/inconsistent color where a token should be
uniform, insufficient contrast (text hard to read against its background),
any element that looks visually broken or misaligned as a side effect of a
class-name change (not a general redesign critique — specifically regressions
from the token swap), and dark-mode/light-mode consistency if the app
supports a theme toggle (check if one exists; if not, skip this point).

## Out of scope

- Do not fix the remaining 145 raw-color occurrences — that's known,
  deferred, not this task.
- Do not do a general UI/UX redesign pass — the owner has a separate,
  larger "UI/UX upgrade and frontend unification" phase planned for later
  in the roadmap (`docs/ROADMAP.md` "Future direction" item 3); this task
  is narrowly a regression check on work already done, not the start of
  that phase.
- Do not touch server actions or data flow — visual-only.

## Expected output

- A short report (in the `DEVELOPMENT-TRACKING.md` entry, no need for a
  separate doc unless you find several issues) listing: pages checked,
  breakpoints checked, and either "no regressions found" or a list of
  specific issues with page + element + what's wrong.
- If you find issues, fix them only if they're small and clearly caused by
  the token migration (e.g., a missed class, a contrast issue from a token
  swap). If a fix would be a real design decision (not a mechanical
  correction), stop and describe it instead of deciding unilaterally.
- No server action / data flow changes expected. If a visual issue turns
  out to need a data-flow change to fix, stop and flag it rather than
  expanding scope.

## Priority

P2 — Codex is mid-Gate-2 on the audit; this is independent, low-risk work
that can run in parallel without touching any file Codex owns.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (Medium)` —
visual QA across several pages, no complex design decisions expected.
