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
  monthly charge) → **Lợi nhuận ròng, after expenses, not before**. Period
  selectable by month, quarter, year and a free date range (owner, 2026-08-17).
- **J4 — Record the rules** in `docs/BUSINESS-RULES.md`: straight-line
  depreciation with its default term, the count-or-expense judgement in §7.3,
  and §3's purchases-are-not-expenses rule, which is the one a future reader is
  most likely to get wrong.

**No tax line — owner decision 2026-08-17, reversing §1's description of his
old sheet.** He pays none: annual revenue is under the 1 billion đồng
threshold, and he has not yet decided between a household business and a
company, which changes the regime. *"Có lẽ nên đảm bảo đăng ký loại hình nào
rồi thì mới cần bổ sung thêm tính năng này."* Build no tax arithmetic now;
leave the P&L's shape able to take a rate later.

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
  month, with revenue, COGS, the entered expenses and the depreciation charge,
  reconciling to a profit figure the owner can verify on a calculator.
- The owner **opens both screens on a phone while logged in** — section 9's
  last clause.

---

## 7. Interview, 2026-08-17/18 — what the app is actually missing

The owner objected that this plan was written before he had been interviewed
properly, and he was right; three of his corrections came from parts of his
spreadsheet its author had not read. Recorded here because it changes the
shape of the work far more than the original §4 tasks did.

### 7.1 There are two parallel systems, and they barely overlap

Measured from his workbook against the database:

| | In the app | In his spreadsheet |
|---|---|---|
| Nguyên liệu | 52 items, **64 purchase orders**, 49.305.880đ | listed, purchases not held here |
| Công cụ dụng cụ | **nothing** | 71 items, 48 orders, 11.163.120đ |
| Vật tư tiêu hao | **nothing** | 26 items, 17 orders, 15.803.989đ |

**Not an oversight on his part — a deliberate split**, because the app has
nowhere to put the other two. `OPEN-ITEMS 8` is the visible corner of this.

**Safe to import:** of his 62 purchase orders, **none contains an ingredient
line** (44 CCDC, 14 VTTH, 3 mixed CCDC+VTTH, 1 CCDC+Tài liệu). So bringing
them in cannot disturb any ingredient's share of order-level shipping and
vouchers, and **the 35.992.142đ COGS figure cannot move**. That was the
largest risk in this work and it does not exist.

### 7.2 His three item types already are three accounting treatments

| His `Loại sản phẩm` | Treatment | Reaches the P&L as |
|---|---|---|
| Nguyên liệu | stock → count → issue | Giá vốn |
| Vật tư tiêu hao | stock → count → issue | Giá vốn |
| Công cụ dụng cụ | asset → depreciate | Chi phí, monthly |

He classified these himself before any of this was discussed. Nothing new to
teach; the app has to catch up to a distinction he already makes.

### 7.3 Counting is decided per item by what counting costs, not by principle

Owner decisions 2026-08-18, after being shown that he holds roughly **4.655
unused cups** (8.550 bought against 3.895 drinks sold) — so purchases are not
yet a proxy for consumption, and his own "it converges once volumes are large"
argument does not hold yet:

- **Counted** — ly and nắp (sleeves of 50, easy), and **ống hút**, which
  arrives in 500g bags; he will start entering it by bag rather than by kg so
  it becomes countable. **12.455.231đ, 78,8%.**
- **Not counted, expensed in the month bought** — muỗng (loose, thousands at a
  time: *"công đếm còn đắt hơn"*), every kind of túi (*"không có cách nào để
  đếm được, việc phải cân để biết thì công luôn rất đắt"*), and the small
  operational items. **3.348.758đ, 21,2%.**

**The principle, in his words about group 3: "dùng là xuất".** Count a thing
only when counting it costs less than the error of not counting it — the same
judgement already applied to đá viên, chanh and tắc via `is_non_inventory`.

### 7.4 The daily-expense items have no cost path at all

`Đá viên` (`SPM-005` → `ING-001`) and `Khoai lang` (`SPM-052` → `NNL-012`)
exist as purchased items linked to `is_non_inventory` ingredients, and have
**zero purchase lines** — measured, not assumed. Nothing marked
`is_non_inventory` has ever been bought through the app, so **0đ of 49,3
million** in app purchases is daily-expense material.

That is the mechanism `OPEN-ITEMS 8` needs: a non-inventory purchase must
reach the P&L as an expense in the month bought. The flag already exists; the
path from it to a report does not.
