# Import 53 purchase orders from the owner's sheet

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1) — in particular §5's trigger analysis and §6's decision that
the owner reviews a total rather than a dry-run dump.

**This writes money into production.** `fnbapp-bulk-data-change` applies in full.

---

## 1. What the owner asked for, and one thing he asked not to have

Enter the purchase orders from his Google Sheet that are not yet in the system,
**one system order per `NH` code** — his words: *"nhập đúng từng mã đơn chứ
không phải nhập một loạt dồn hết tất cả vào cùng 1 mã đơn."*

He also declined the usual dry-run review: *"em đối chiếu và giúp anh xử lý, anh
vibecode thì có đọc cũng không hiểu."* That is a fair refusal — 53 orders × 107
lines of raw output is not something he can judge.

**So the approval shape changes, not the approval.** He approves on a figure he
can judge (§6). The line-by-line checking is the reviewer's job, not his.

## 2. Inputs, all owner-confirmed

Four files in `scratchpad/`, produced during the 2026-08-27 session:

| File | What it is |
|---|---|
| `sheet2.txt` | the sheet as text, **re-downloaded after his last edit** |
| `owner-map.json` | 31 sheet names → system names, **confirmed by him line by line** |
| `unit-rules.json` | 15 unit decisions: which unit to record and what to multiply the sheet quantity by |
| `todo-codes.json` | the 53 `NH` codes not yet in the system |

**Re-derive all four before running.** He edits the sheet between sessions —
twice already during this work — and every figure below has a measurement date
for that reason.

## 3. Preparation, both owner-approved

1. **Create 16 suppliers**, exactly as named in the sheet: `ShopGiaDungTienIchSale`,
   `GIA DỤNG ROSE`, `VANA AUTO`, `TÍN PHÁT SÀI GÒN`, `Gia Dụng Cương Nga`,
   `UNMEI_MART_TÂN PHÚ`, `NHỰA DUY TÂN - SHOP`, `HỘ KINH DOANH NGỌC PHÁT`,
   `Cửa hàng điện E78`, `THEA OFFICIAL STORE`, `ookas.lighting`, `THƯ PHA CHẾ`,
   `Thiên Phúc`, `Thành Danh`, `Cửa Hàng B&B Supplier Ly - Bar`,
   `CÔNG TY TMĐT Ô MUA ĐI`. The duplicate-name guard applies; a near-match
   warning must be surfaced, not auto-confirmed.
2. **Retitle two conversions** from `Cái` to `Hộp`: `SPM-105` Hộp nhựa 1500ml,
   `SPM-123` Hộp nhựa có nắp gài 1000ml. Both have **0 purchase lines**
   (verified 2026-08-27), so nothing historical moves — re-verify before doing it.

## 4. The import

One `purchase_orders` row per `NH` code, carrying the sheet's **transaction
date**, supplier, source, `Mã phiếu` into `supplier_invoice_code`, and the
header amounts: subtotal, shipping (net of the shipping discount), voucher,
discount, tax.

Per line: the mapped item, the unit from `unit-rules.json`, and the sheet
quantity **multiplied by that rule's factor** — 10 for `Chai nhựa HDPE 1000ml`
(1 Combo 10 = 10 chai), 50 for `Combo ly + nắp nhựa PP`, 1 for the rest.

**Do not copy the sheet's `Giá nhập thực tế`.** That column is already allocated;
the system performs its own allocation (`BR-COGS-006`) and copying it would
allocate twice. Enter unit price and quantity, and put shipping and voucher on
the order header.

**Idempotent, and prove it:** re-running must insert nothing. Key on
`supplier_invoice_code` where present, and on (date, supplier, total) where the
sheet has no code — 39 of the sheet's successful orders have no code, so this
half is not optional.

## 5. The trigger nobody should discover afterwards

`fnbapp-bulk-data-change` step 1. Triggers on the tables this writes:

| Table | Trigger | What it does |
|---|---|---|
| `purchase_orders` | `trg_purchase_orders_touch` | `BEFORE UPDATE` only — does not fire on insert |
| `uom_conversions` | `trg_uom_conversions_touch` | `BEFORE UPDATE` — fires on §3.2's retitle |
| **`stock_ledger`** | **`trg_stock_ledger_inventory_balances`** | **`AFTER INSERT OR DELETE OR UPDATE` → `stock_ledger_apply_inventory_balance_delta()`** |

**The third one means this import is not only bookkeeping — it moves stock.**
Each purchase writes a `stock_ledger` row, and each of those updates
`inventory_balances`. That is correct behaviour (goods arrived), but it must be
stated in the report with the before/after balance counts, not discovered later.

Nothing here feeds a queue or schedules unattended work: there is no cron in
this repository (`app/api/cron/` is empty, `vercel.json` is `{}`, verified
2026-08-26).

## 6. Verification — and what the owner is actually shown

**Measured 2026-08-27, before anything runs:**

| | |
|---|---|
| Orders in the system | 100 |
| Purchase lines | 190 |
| `stock_ledger` rows | 267 |
| `inventory_balances` rows | 73 |
| Suppliers | 33 |
| Sum of `total_amount` | **58.903.591đ** |

**And what the 53 orders must add**, computed from the sheet and internally
consistent — subtotal + shipping + voucher + discount + tax equals the stated
total on **53 of 53** orders:

| | |
|---|---|
| Orders | **53** |
| Lines | **107** |
| Goods | 28.326.579đ |
| Shipping, net of its discount | 536.872đ |
| Voucher | −997.675đ |
| Discount | −401đ |
| Tax | 1.139.322đ |
| **Total to add** | **29.004.697đ** |

So after the import: **153 orders**, **297 lines**, and a summed
`total_amount` of **87.908.288đ**.

**That last figure is what the owner approves against.** Give him the arithmetic
in one line — 58.903.591 + 29.004.697 = 87.908.288 — not a dump. If it lands on
a different number, stop and report rather than explaining the difference away.

Also verify, and report each with its denominator:

- every one of the 53 `NH` codes produced exactly one order, none produced two;
- 107 lines, and each line's `base_quantity` equals quantity × conversion rate;
- `scripts/verify-revenue.ts` unchanged — purchases are not revenue, so any
  movement here means something is badly wrong;
- `inventory_balances` moved for the items purchased and for no others;
- a second run inserts nothing.

## 7. Done means

`CLAUDE.md` §9 in full, plus §6. **Dry run first and show the reviewer the full
detail** — the owner opted out of reading it, the reviewer did not. Do not
`--apply` until he has approved the total.
