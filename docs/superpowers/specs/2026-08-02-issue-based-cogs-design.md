# Issue-Based COGS — Design

Date: 2026-08-02
Status: design, pending owner review
Author: Opus 5 coordinator, from a working session with the owner 2026-08-02

## Tóm tắt cho chủ quán

Giá vốn thôi tính theo từng ly bán. Từ nay giá vốn là **giá trị hàng thật sự
xuất khỏi kho**, tính theo giá bình quân tại lúc xuất.

Ví dụ của anh: nhập 10 túi × 10đ, xuất 2 túi → giá vốn 20đ, tồn 8 túi. Bán được
1.000đ trong kỳ → lãi gộp 980đ.

Bốn thứ được bảo tồn nguyên vẹn: **đơn bán hàng, đơn nhập hàng, công thức, và
cách tính doanh thu/giá vốn**. Công thức vẫn lưu nhưng thôi tham gia tính tiền.

Kèm theo là dọn sạch dữ liệu suy ra — khoảng 97,9% sổ kho và cuốn nhật ký sửa
lỗi 15,88 MB — vì chúng chỉ tồn tại để phục vụ cách tính cũ.

---

## 1. The rule

**COGS for a period = the value of goods recorded as issued from stock in that
period**, each issue valued at the weighted average cost of that item at the
moment of issue.

Sales no longer move stock. Recipes no longer drive cost. The two facts that
determine cost are what was purchased and what was issued.

**Worked example, the owner's own numbers, extended to expose the valuation
rule:**

```
02/08  nhập 10 túi × 10đ                    tồn 10 túi, bình quân 10,00đ
02/08  xuất 2 túi                           giá vốn 20,00đ, tồn 8 túi
05/08  nhập 10 túi × 12đ                    tồn 18 túi, bình quân 11,11đ
                                            (8×10 + 10×12) / 18 = 11,11
07/08  xuất 3 túi                           giá vốn 33,33đ, tồn 15 túi
10/08  doanh thu kỳ 1.000đ
       -> giá vốn kỳ = 20,00 + 33,33 = 53,33đ
       -> lãi gộp = 946,67đ
```

Owner decision 2026-08-02: weighted average at issue time, not FIFO, not latest
price. It keeps continuity with the existing MAC concept; only the moment of
application moves — from each sale to each issue.

## 2. Stock lives at the purchased-item level

This is the correction that reshapes the design. The owner: *"anh sẽ xuất trực
tiếp từ hàng mua vào chứ không phải nhóm nguyên liệu nói chung."*

Today `stock_ledger.item_reference` holds a **generic ingredient** id
(`NNL-001` "Sữa tươi"). Several distinct purchased items collapse into one, and
their different prices are averaged together. Measured 2026-08-02:

| Generic ingredient | Purchased items that collapse into it | Spent |
|---|---|---|
| `NNL-001` Sữa tươi | Sữa tươi TH True Milk / Sữa tươi Mlekovita | 50.000đ / 3.614.084đ |
| `NNL-002` Bột cà phê | Phin Đậm / MR.PHIN Robusta Dak Mil / MR.PHIN Pha Phin | 179.000đ / 10.303.000đ / 183.000đ |
| `ING-003` Sữa đặc | Vinamilk / Ngôi Sao Phương Nam / La rosee | 65.000đ / 24.000đ / 4.997.016đ |

Under the new model, stock and issues are tracked per **`purchased_items`** row
(52 of them, `SPM-xxx`). Generic ingredients remain as the vocabulary recipes
speak, not as the thing stock is counted in.

Two consequences worth stating:

- Cost stops blending brands. Robusta Dak Mil at 1.030đ/unit no longer averages
  with Phin Đậm at 358đ/unit.
- The purchased-item → ingredient mapping stops being load-bearing for money.
  That mapping is what produced the `SPM-040` mis-mapping incident on
  2026-07-30; the class of bug disappears rather than being guarded against.

## 3. Units

Owner decision: **the unit is chosen when recording an issue, and conversions
stay stored.** Issue "2 túi" or "500 g" — whichever matches how the stock was
actually handled — and the system converts using the item's existing
`uom_conversions` row.

### The conversion gap, and why it costs the owner nothing

95 of 137 purchase lines carry `base_quantity = 0`, covering **32.751.182đ**.
Under the old model this was survivable because cost came from recipes. Under
this design, purchases are the sole source of cost, so an unvalued purchase line
is fatal.

Measured before assuming the worst: **all 95 lines already carry a
`conversion_id` pointing at an existing `uom_conversions` row.** None is
missing. `base_quantity` was simply never computed and stored.

So this is a recomputation, not a data-entry task. **The owner supplies
nothing.** One script recomputes `base_quantity = quantity × conversion_rate`
for those 95 lines.

## 4. How an issue gets recorded

Owner: *"tuỳ trường hợp"* — both of these must work, and per item.

**Mode A — record each package as it is opened.** Stock falls and cost accrues
immediately. Needs a light "issue" action that does not exist yet.

**Mode B — count what is left at period end.** Issued = opening + purchases −
count. This is a stocktake.

**Mode B is already built and deployed, and has never been used.** Migrations
`0036` and `0037` are applied to production, `apply_stocktake_session_atomic`
exists and writes `STOCK_ADJUST` rows, and the UI is complete under
`app/admin/inventory/stocktake/`. `stocktake_sessions` holds **0 rows**.

The design therefore does not build periodic counting. It exercises what exists
and connects its output to COGS. `docs/OPEN-ITEMS.md` item 18 previously
described this feature as stranded and unapplied; that was false on all three
counts and has been corrected.

## 5. What is deleted

Owner decision 2026-08-02, given after being shown the interim effect and
choosing to proceed anyway. Deletion is not gated on the replacement records
existing.

| Data | Rows | Why it goes |
|---|---|---|
| `SALES_CONSUME` | 6.874 | Stock deduction inferred from recipes at sale |
| `PRODUCTION_CONSUME` | 1.845 | Raw ingredients consumed by implicit production |
| `PRODUCTION_YIELD` | 1.454 | Semi-products created by implicit production |
| `STOCK_ADJUST` | 13 | Not made by the owner — phantom rows already on record |
| `EDIT_REVERSAL` | 72 | Reverses sales-driven stock movement, which no longer exists |
| `data_recovery_changes` | ~46.000 (15,88 MB) | The correction machinery's log; the machinery retires |

`stock_ledger` is left holding **137 `PO_RECEIPT` rows** — exactly what was
purchased. That is the literal form of *nhập gì xuất đó*.

**Storage:** the ledger deletion frees ~3 MB. The recovery log frees ~15,88 MB —
five times more, and 60,4% of all stored data. The larger win is the log, not
the ledger.

### What must survive, in the owner's words

> *"anh chỉ quan tâm đến dữ liệu đơn bán, đơn nhập, công thức và cách tính doanh
> thu, giá vốn được bảo tồn"*

Sales orders and their lines. Purchase orders and their lines. Recipes and their
snapshots. The revenue and COGS computation. Nothing in section 5 touches any of
these.

### Keep the reconstruction engine even after it stops running

The deleted rows are reconstructable from sales orders plus the recipe snapshots
those orders carry — **but only while the code that reconstructs them exists.**
`lib/full-history-recompute.ts` and `lib/inventory-consumption.ts` are that code,
and this design retires them from the running path.

Retire them from execution; keep them in the repository. Deleting both the data
and the means of regenerating it removes the only way back, for no saving.

### The interim, stated plainly

Between deletion and the owner entering historical issues, stock balances read
as everything ever purchased with nothing consumed. Measured examples: Sữa tươi
50.750 g → 134.450 g; Sữa đặc 40.578 g → 104.114 g.

The owner was shown these figures and chose to delete first regardless. Recorded
here so the behaviour is understood as chosen rather than discovered.

## 6. Historical restatement

Owner decision: recompute all history under the new method, entering past issue
records himself where none exist.

**The arithmetic constraint on granularity, which the owner should not be
surprised by later.** A single count taken today yields exactly one figure:

```
hàng đã xuất trong cả giai đoạn = tồn đầu + tổng nhập − đếm hôm nay
```

Splitting that into a May figure, a June figure and a July figure requires a
count at the end of each of those months, and those moments have passed.
Restated COGS is therefore only as granular as the issue records the owner can
supply. Monthly restatement needs monthly evidence.

## 7. What retires

Beyond the two engines above, this design removes the reason for existing for:

- the backdated ledger and recipe event machinery (`lib/backdated-ledger/**`,
  `lib/backdated-recipe-events/**`) and its two review screens
- `app/api/cron/apply-backdated-corrections` — which has never run in
  production anyway (`docs/OPEN-ITEMS.md` items 2b, 19)
- the 1.522 queued correction events, which become permanently moot
- the drift audits and baseline-lock tables built to police per-line cost
- `cost_at_sale` as a computed value; the column stays, frozen

More than twenty files read `cost_at_sale`, and most of them exist only to
repair it. Removing the requirement removes the repair industry around it.

## 8. `CLAUDE.md` section 7 must be rewritten

Section 7 is the inventory ground-truth rule the owner confirmed 2026-07-22 and
every agent reasons from. It currently states that recipes plus sales orders
determine stock deduction, and describes implicit production. **This design
makes all of that false.**

Rewriting it is in scope and must land in the same change, not after. This is
precisely the case `CLAUDE.md` section 6 was written for: a decision that
changes how a number is calculated is recorded in the same session.

The related decision to keep semi-product stock tracking (2026-07-31) also needs
revisiting, since its rationale was serving the inference chain being removed.

## 9. Risks

**Accuracy moves, it does not improve by itself.** Before, correctness depended
on recipes being right. Now it depends on issues being recorded. The owner's own
example shows eight days of selling with no issue recorded; if goods really were
used in those days and nothing was written down, that period's COGS is
understated and gross profit flatters the business. **Issue discipline is where
the numbers now live.**

**Month-boundary timing.** Issuing a month's supply on the 30th puts its whole
cost in that month. The monthly COGS ratio the owner wants to watch will be
noisier than the underlying business unless issues track use.

**No per-product margin.** Accepted explicitly. Reports that break down cost by
drink stop being possible; the target metric is the monthly COGS-to-revenue
ratio.

## 10. Verification bar

- Revenue figures unchanged for every historical month — this design touches
  cost, never revenue. Any movement is a defect.
- Purchase orders, sales orders, recipes byte-identical before and after.
- The 95 recomputed purchase lines reconcile: `quantity × conversion_rate =
  base_quantity`, and the sum of line subtotals still equals each order header.
- After deletion, `stock_ledger` holds exactly 137 rows.
- A full backup taken and verified restorable **before** any deletion runs.
- `npx tsc --noEmit` clean, full suite green.
- No push.

## 11. Out of scope

- The restructure (`docs/OPEN-ITEMS.md` item 27) stays deferred behind this.
- Phase 2 of the rules program (item 26) waits for this to land, since it would
  otherwise encode the calculation being replaced.
- Multi-branch, franchise, UI/UX.
