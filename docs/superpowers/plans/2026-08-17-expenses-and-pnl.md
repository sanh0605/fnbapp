# Plan J — Expense entry, an asset register, and a real P&L

**Written 2026-08-17 by Opus 5**, after reading the owner's own accounting
spreadsheet at his invitation. Closes `OPEN-ITEMS 8` and unblocks
`OPEN-ITEMS 31`.

---

## 1. What the owner already has, measured from his sheet

Not assumed — read from the file he shared:

- **113 expense rows** (`EX000001`…), every one a payment out. Columns:
  date, Thu/Chi, **Loại phí** (Biến phí 110 / Định phí 3), **Danh mục**
  (Vận hành 39, Điện/nước/gas 9, Marketing 4, blank 61), value, **Người chi**
  (FNB 74, Sanh 37), note, and a link to a purchase order.
- **60 of 62 purchase orders have a matching expense row.** Buying is paying,
  in one act. There is no credit, no unpaid balance — confirmed by the owner
  2026-08-17 after this plan's author wrongly assumed otherwise.
- **An equipment register with depreciation already exists**: each purchase
  line carries `Khoảng thời gian khấu hao` = **12 months**, a monthly figure,
  and an end date. The owner did not over-engineer this; per-item detail is
  correct for assets.
- **A P&L sheet** with section A (Doanh thu, Giá vốn, Lợi nhuận gộp, **Thuế
  GTGT 3%**, **Thuế TNCN 1,5%**, Lợi nhuận ròng) and section B (Nhân sự,
  Dụng cụ, Set up).

**Two defects in that sheet, reported to the owner and part of why this
exists:** `Giá vốn`, `Lợi nhuận gộp` and `Lợi nhuận ròng` all read `#REF!` —
the three lines that matter produce nothing. And **section B's expenses are
never subtracted from section A**, so "Lợi nhuận ròng" is really profit after
tax and *before* operating costs. Do not reproduce that structure.

---

## 2. Scope, set by the owner 2026-08-17

**In:**

1. **Expense entry** for spending the system does not already know about —
   Vận hành, Điện/nước/gas, Marketing, Nhân sự. Purchases are **not**
   re-entered: they are already `purchase_orders`.
2. **Equipment (CCDC) register** with per-item straight-line depreciation over
   N months, default **12**, matching what the owner already does.
3. **A P&L** that replaces the broken sheet.

**Out, each on an explicit owner decision today, with his reasoning:**

- **No cash balance, no opening/closing balance.** *"Tiền có thể linh hoạt xử
  lý được… số dư đầu kỳ hay cuối kỳ cơ bản đều không quan trọng."*
- **No supplier debt, no paid/unpaid state.** Every purchase is settled at
  once (§1).
- **No capital-contribution accounting.** *"Cứ mặc định là tiền của quán bỏ
  ra"* — profit sharing does not follow contribution ratio anyway. `Người chi`
  is not modelled.

---

## 3. The trap this plan exists to avoid: counting cost twice

The owner's sheet contains **both** `Mua nguyên liệu` (money out, a cash-flow
figure) and `Giá vốn` (cost of goods, a P&L figure). Those belong to two
different statements and describe the same money at two different moments.

**In this system, ingredient purchases must never appear as an expense line in
the P&L.** They enter the P&L as `Giá vốn`, computed from `stock_issues` when
goods leave stock (`BR-COGS-005`, Plan C). A purchase in June consumed in
August is an August cost, not a June one.

If the expense screen ever lets a purchase be recorded as an expense, every
ingredient is counted twice and the P&L is wrong by roughly the entire
purchase total. **The screen must make that impossible, not merely discourage
it** — see §5's gate.

---

## 3b. COGS is not spread across months — owner decision 2026-08-18

Measured while asking: the first count (49 rows, 2026-08-09) is worth
**34.864.627đ** and the manual slips since are **1.127.515đ**, together the
**35.992.142đ** now in the owner's own sheet — a figure that matches this
system's engine to the dong.

That figure covers consumption **from opening to 2026-08-09**, so a monthly
P&L shows nothing for April to July and a **−26.529.142đ gross loss in
August**, which is an artefact of when the count happened, not of trading.

Two options were put to the owner with worked numbers — spread it across the
months in proportion to revenue (a flat 63% everywhere, which is arithmetic
rather than measurement), or report by count-period. **He chose neither:
leave it exactly as it falls.** *"Mình cũng đã chốt sẽ chấp nhận các tháng
trước bị 0 và từ tháng kiểm kê lần đầu tính tiếp… chủ yếu cũng có thể nắm
được toàn bộ năm 2026 đã diễn ra thế nào… sai số vài tháng không quan
trọng."*

**This is sound for the purpose he stated, and not merely accepted:** the
annual total is correct under every option, because allocation only moves
money between months inside the year. He is reading the year, so the
distortion does not touch what he uses.

**What the report must therefore do:** show COGS where it falls, and carry a
short line saying months before the first count read 0đ because nothing had
been counted yet, not because nothing was consumed — the same sentence
`app/admin/reports/issued` already carries.

**The permanent rule this leaves in place**, and the thing a future reader
must not mistake for a one-off: **a stocktake's value belongs to the period
since the previous count.** Every future count behaves the same way; the
first is only unusual in that its period is four months. Counting more often
makes each figure smaller and easier to read — which is the real argument for
a second count soon, not any adjustment to the report.

**A related misunderstanding, corrected with the owner 2026-08-18:** selling a
drink creates no issue row (`BR-COGS-005` — sales do not deduct stock), so the
1.127.515đ of manual slips is breakage and giveaways, not August's cost of
sales. August's real cost is still unknown and arrives with the second count.

---

## 4. Tasks

- **J1 — Expense entry.** Table + screen + link in the sidebar (owner's
  explicit requirement: *"có nơi bấm vào đường dẫn, tránh xảy ra trường hợp
  anh cứ phải hỏi anh bấm vào đâu"*). Phone-first per `CLAUDE.md` section 8 as
  amended 2026-08-17: the phone layout is the build target, desktop is a later
  pass. Fields: date (default today), amount (`inputMode="numeric"`),
  category, fixed/variable, note. Categories seeded from the owner's own list.
- **J2 — Equipment register with depreciation.** Item, purchase date, cost,
  months (default 12), and a derived monthly charge. Straight-line, no salvage
  value. The monthly figure is **derived, never stored** — same rule as costs
  (`BR-COGS-006`), so a corrected term or amount fixes every past period.
- **J3 — The P&L.** Doanh thu → Giá vốn → Lợi nhuận gộp → Chi phí (J1 + J2's
  monthly charge) → Thuế GTGT 3% and TNCN 1,5% on revenue → **Lợi nhuận
  ròng, after expenses, not before**.
- **J4 — Record the rules** in `docs/BUSINESS-RULES.md`: the two tax rates,
  straight-line depreciation with its default term, and §3's
  purchases-are-not-expenses rule, which is the one a future reader is most
  likely to get wrong.

---

## 5. Verification bar

`CLAUDE.md` section 9 in full, plus:

- **The double-count gate:** a test that fails if any figure feeding the P&L's
  expense total can originate from `purchase_orders`. Assert it structurally,
  not by inspection.
- **Revenue and COGS must not move.** `scripts/verify-revenue.ts` identical
  before and after, and the issued-value total unchanged. This plan adds a
  statement on top of existing figures; it does not recompute them.
- **A worked example, checked by hand before the screen is trusted:** one real
  month, with revenue, COGS, the entered expenses, the depreciation charge and
  both taxes, reconciling to a profit figure the owner can verify on a
  calculator.
- The owner **opens both screens on a phone while logged in** — section 9's
  last clause.
