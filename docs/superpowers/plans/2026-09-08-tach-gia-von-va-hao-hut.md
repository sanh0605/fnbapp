# Plan — split Giá vốn from Hao hụt in the P&L

Owner decision 2026-09-08, recorded in `docs/02-rules/business-rules/cogs.md`
under `BR-COGS-007`. Read that rule first; this plan implements it and does not
restate its reasoning.

## Hiện trạng

`getPnLDataV2` (`app/admin/reports/actions.ts:172`) feeds every non-equipment
`stock_issues` row into `computePeriodIssuedValue` with no source filter and
reports the result as one number, `totalCOGS`. `PnLReportResult` carries no
shrinkage field.

**Corrected 2026-09-08, after Sonnet measured it.** This section first claimed
`computeIssueCosting` already tags each event with `source` and "the engine knows
the difference today". That is false. `computeIssueCosting` returns `ItemCost[]`
— one cumulative record per item, no per-event breakdown at all. The `Issue` type
carries a `source` field and the replay loop never reads it: a dead field.
`byEvent[].source` belongs solely to `computeWeightedAverageIssuedValue` in
`scripts/verify-cogs-core.ts:324`, the deliberately independent reimplementation
that must never be imported into `lib/costing`. The engine accepts the field and
ignores it, which makes this change more invasive than "carry an id through an
existing structure" — see the design below.

**There is no P&L page.** `getPnLDataV2` is imported by nothing except
`app/admin/reports/actions.test.ts` — verified by grep across all of `app/`,
`lib/` and `components/`. The three report pages that exist (`daily`, `issued`,
`sales`) show no Giá vốn or Lãi gộp line anywhere. A stale comment at
`app/admin/reports/sales/page.tsx:49` refers to "the P&L page" as if it existed.
So this report has real, correct numbers and no screen: the owner has never been
able to open it. That is a scope question, held below.

Measured 2026-09-08 against production, unbounded period: revenue 71.525.000đ
across 2.588 orders, `totalCOGS` 47.885.076đ = 13.020.449đ MANUAL (90 events) +
34.864.627đ STOCKTAKE (49 events, all of them `STK-001`). `STK-002` was
cancelled and produced 0 rows. 0 of 139 rows carry a source outside
{MANUAL, STOCKTAKE}.

1. **Có mấy trạng thái, đặt mỗi trạng thái bằng cách nào?** Per stocktake
   session, one new boolean: counts as shrinkage, or does not. Set by migration
   for the two existing sessions (`STK-001` false, `STK-002` true — moot, it has
   no rows), default true for every session created afterwards. No UI sets it;
   see cross-impacts.
2. **Có những nút nào, mỗi nút làm gì, nút nào không nên hiện khi nào?** Không
   áp dụng, vì this adds no control — it changes what two existing report lines
   contain. The P&L has no buttons in the affected area.
3. **Danh sách chứa gì, loại cái gì ra, vì lý do gì?** The Giá vốn line contains
   MANUAL issues plus STOCKTAKE issues from sessions flagged not-shrinkage. The
   Hao hụt line contains STOCKTAKE issues from every other session. Equipment
   issues stay excluded from both, unchanged (`filterOutEquipmentIssues`,
   already in place, `BR-COGS-005` §3.2).
4. **Mỗi ô nhập nhận giá trị nào, nhập ngoài khoảng thì sao?** Không áp dụng,
   vì there is no input. The only new value is a boolean written by migration.
5. **Phục vụ loại dữ liệu nào, cố ý không phục vụ loại nào?** Serves issue-based
   cost for any period. Deliberately does **not** serve the third line
   (`Nguyên liệu mua dùng ngay`) — see "Phase 2, not in this plan".

## Thiết kế rút gọn

**One replay, tagged — never two replays subtracted.** The split must come from
a single combined chronological replay whose events are then attributed, exactly
as `splitIssuedValueBySource` does. Replaying a subset shifts the weighted-average
pool for every later event and answers a different question. This was established
2026-09-08 the hard way: subset replay produced 12.984.483đ / 34.900.592đ, the
tagged replay 13.020.449đ / 34.864.627đ, and `BR-COGS-007`'s own figure recorded
2026-08-19 — 34.864.627đ — settles which is right. Do not re-litigate this.

**The flag rides on the session, not on the issue row and not on an id in code.**
Add a column to `stocktake_sessions`. The raw `stock_issues` rows carry
`session_id` already (measured: 0 of 90 MANUAL rows carry one, 0 of 49 STOCKTAKE
rows lack one — a clean partition).

**Build the split as a new, additive function; do not change
`computeIssueCosting` or `computePeriodIssuedValue`'s signatures.** Sonnet's
recommendation, adopted. Splitting inside the existing engine means new bucketed
accumulation per item *and* teaching `computePeriodIssuedValue`'s
two-replays-and-subtract shape to subtract per bucket. Worse, those two functions
have a second caller with a different purpose — see below — which would inherit a
change it does not want. `getPnLDataV2` alone calls the new function.

**`lib/reports/issued-value-report.ts` must not change, and that is a decision.**
It imports `computeIssueCosting` and `computePeriodIssuedValue` directly, across
three tabs, and already groups per-event by `session_id`/`issue_slip_id`, labelling
STOCKTAKE groups "Kiểm kê định kỳ". It deliberately reports **unified** value
because it answers "what physically left the warehouse", not "how is this
classified financially". It is also the screen `lib/costing/CLAUDE.md` tells you
to open and eyeball after any costing change. Leaving it untouched is the intent,
not an oversight.

**Rounding.** Each displayed line rounds up from its own exact value (owner rule
2026-07-30). Gross profit is `totalRevenue` minus the **exact** total, not minus
the sum of the two rounded lines. Today both paths give 47.885.076đ, but only
because `ceil(a) + ceil(b)` happened to match `ceil(a+b)` for these fractions —
do not build as if that holds.

## Tasks

- [ ] **Task 0 — measure before touching anything.** Re-run `verify-cogs` and
  record the three figures. Confirm `byEvent` exposes what you need to attribute
  a stocktake event to its session; if it does not, say so before designing
  around it.
- [ ] **Task 1 — migration.** Add the boolean to `stocktake_sessions`, default
  true, not null. Backfill `STK-001` to false in the same migration, and **raise**
  if that update touches anything other than exactly 1 row. Per the repo's
  trigger rule, list `stocktake_sessions`' triggers in the migration header and
  say what each does with the updated row.
- [ ] **Task 2 — the split, test-first.** Extend the costing path to return the
  two figures. Write the failing test first and say in the commit whether it is
  red for a wrong value or a missing function.
- [ ] **Task 3a — the data layer.** `PnLReportResult` gains the shrinkage
  figure and `getPnLDataV2` returns it. Not blocked; do this with Tasks 1–2.
- **Task 3b — the screen. Not in this plan, settled 2026-09-08.** There is no
  P&L page to add a line to, and the owner chose to fold building one into the
  financial-reports work rather than raise a standalone screen now and reshape it
  later: *"Gộp vào đợt báo cáo tài chính."* Building it is a new folder under
  `app/` by `CLAUDE.md`'s own milestone test, so it needs the full four-step
  process and a spec in `docs/superpowers/specs/` — it could not have been an
  extension of this reduced plan in any case. The split ships as data and waits
  there for the screen that will read it.
- [ ] **Task 4 — the slip-count guard `BR-COGS-007` already requires.** The rule
  says the report shows the period's issue-slip count beside the shrinkage figure
  so a reader can see for themselves whether the number means anything. It does
  not today. Build it with this, not later.

## Worked example, real data

Period unbounded, measured 2026-09-08. Before: **Giá vốn 47.885.076đ**. After:
**Giá vốn 47.885.076đ, Hao hụt 0đ** — identical, because `STK-001` is flagged
not-shrinkage and it is the only stocktake source that exists. Gross profit
stays 23.639.924đ on 71.525.000đ of revenue either way.

That the visible numbers do not move is the point, and it is also the trap: a
green run proves nothing on its own. **The test that proves the split works must
flip the flag.** With `STK-001` counted as shrinkage instead, the same period
must read Giá vốn 13.020.449đ / Hao hụt 34.864.627đ, gross profit unchanged at
23.639.924đ. If those two numbers do not appear, the wiring is wrong however
green the default case looks.

The one MANUAL slip that predates `STK-001` is `ISL-00041` (row `ISS-00119`),
2026-07-09 21:49 giờ Việt Nam, one line of *Baking Soda Caster* (`SPM-067`),
454 base units at 107đ = 48.600đ. It stays in Giá vốn in both cases; use it as a
fixture anchor if you need a MANUAL row that sits before the count.

## Cross-impacts

- **No screen sets the flag.** Deliberate: nothing today can set it wrongly, and
  a screen for a column with one historical exception is machinery nobody asked
  for. If a future count ever needs marking, that is a small separate change.
  Do not build it here.
- **`verify-cogs` prints a FINDING about this exact gap** (`scripts/verify-cogs.ts:186`).
  Once the split ships, that text is stale. Update it in the same commit; it is
  the script's own claim about the app and must not outlive the thing it claims.
- **`BR-COGS-007`'s worked example** cites the 12% issue rate against August
  revenue. Nothing in this change touches it.

## Phase 2, not in this plan

The owner chose the three-line shape, and the third line — **Nguyên liệu mua
dùng ngay** — is not built here. `is_non_inventory` exists on `base_ingredients`
and `purchased_items` (migration `0068`) but today only controls stocktake
eligibility; nothing values those purchases into a money line. That is Plan J
batch 5's unbuilt job and needs its own plan. It is deferred, not dropped, and
the owner has been told so in those words.

## Chưa xem

Đã xem: `app/admin/reports/actions.ts`, `scripts/verify-cogs-core.ts`,
`docs/02-rules/business-rules/cogs.md`, and the production figures above.
**Chưa xem:** `lib/costing/issue-costing.ts`'s internals, the P&L's rendering
components, `stocktake_sessions`' triggers, and whether any other consumer reads
`PnLReportResult.totalCOGS` expecting it to include shrinkage — check that
before changing its meaning.
