# Retire the stock ledger

**Written 2026-08-28 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

**Deletes two tables the entire operational core writes to.** The cost was put
to the owner twice — 21 functions, the money path, weeks — and he decided
anyway, with a reason worth recording:

> *"Nếu sau này xoá, em vẫn sẽ đọc lại, như vậy còn làm tốn kém hơn, xoá luôn
> bây giờ và chữa các lỗ hổng rồi sau này chỉ việc xây thôi."*

Deferring means re-deriving this whole picture later. That cost is real — this
session spent most of a day rebuilding exactly this understanding.

---

## 1. Why the data deserves retiring, measured

`stock_ledger` holds **382 rows** and every one duplicates a row that already
exists elsewhere, keyed better:

| Movement | Authoritative table | Ledger copy |
|---|---:|---:|
| Purchases | 299 `purchase_order_lines` | 299 — exact duplicate |
| Manual issues | 45 `stock_issues` | 45 — exact duplicate |
| Stocktake variance, 2026-08-09 | **49** `stock_issues` | **38 — incomplete** |

**Where the copy differs from the original it is the less complete one.** A
report reading the ledger for the first stocktake sees 38 of 49 adjustments.

**Nothing sold has ever touched it.** Only `PO_RECEIPT` (299) and `STOCK_ADJUST`
(83) exist — no sales row, because selling stopped deducting stock at the
2026-08-07 cutover. So `void_order_atomic` and `supersede_order_v2_atomic` read
the ledger for an order and find nothing, every time.

**The live on-hand figure already ignores it.** `computeOnHandByPurchasedItem`
derives on-hand from `purchase_order_lines` minus `stock_issues`, keyed by
`purchased_item_id`.

## 2. The blast radius, enumerated not estimated

This is the check that was missed on `0072` and cost three days of broken order
editing. **21 database functions reference the two tables. 13 are live** —
called from `lib/` or `app/` outside tests and historical tooling:

`apply_stocktake_session_atomic`, `approve_stock_adjustment_atomic`,
`close_shift_stock_check_atomic`, `create_issue_slip_atomic`,
`open_shift_stock_check_atomic`, `reverse_manual_issue_atomic`,
`reverse_stocktake_session_atomic`, `save_purchase_order_atomic`,
`save_stocktake_line_atomic`, `submit_stock_adjustment_atomic`,
`supersede_order_v2_atomic`, `void_order_atomic`, `create_pos_order_atomic`.

**8 are dead** and can be dropped outright: `apply_hong_to_luc_migration`,
`apply_purchase_cost_recovery`, `rollback_purchase_cost_recovery`,
`rebuild_inventory_balances`, `rebuild_stock_ledger_for_order`,
`get_pos_inventory_state`, `create_pos_order_atomic_unvalidated_0025`,
`save_production_order_atomic`.

Plus one trigger, `trg_stock_ledger_inventory_balances`, and 8 TypeScript sites.

**Re-derive this list before acting.** It was produced by grep on 2026-08-28 and
a function added tomorrow will not be in it.

## 3. Phase A — stop reading, delete the screen

Owner instruction: *"Anh không xài báo cáo tồn kho với những thông tin đó, sẽ
xây lại chuẩn chỉnh sau, xoá đi."*

- Delete `app/admin/reports/stock/` — screen, actions, nav entry. Update
  `nav-guard.test.ts` in the same commit.
- Remove the reorder suggestion from the daily report. The owner set its
  condition himself: *"Khi nào cần nhắc nhở đặt hàng? Khi đã chỉn chu xong
  những điều cơ bản nhất."* Not now.
- Remove the ledger read from `voidOrderV2` and `editOrderV2`. **It returns
  nothing today** — prove that with a test asserting zero rows for a real order
  before deleting the code, so the removal is evidenced rather than assumed.
- `app/admin/products/page.tsx` and `products/cogs-estimate/page.tsx` read the
  ledger beside `Recipes` — both die with recipes in the other plan. Coordinate;
  do not fix them twice.
- **POS stock status** (`loadPOSStockStatus`, `app/pos/actions.ts:223`) shows
  cashiers what is in stock from `Inventory_Balances`. That number comes from
  the incomplete copy. **Ask the owner before changing what a cashier sees** —
  it is the only reader in this phase that faces a person mid-shift.

**Gate:** POS sells, orders void and edit, full suite, `npm run build`.

## 4. Phase B — drop the 8 dead functions

One migration. Each is unreferenced; **prove it per function**, do not batch the
proof. `save_production_order_atomic` also dies with the recipes plan — whichever
lands first takes it.

## 5. Phase C — remove the write from the 13 live functions

**One function per commit, POS last.** Each is a mechanical removal of an
`insert into stock_ledger` block and its `p_ledger` argument — not a logic
rewrite. Copy the body forward otherwise unchanged, the same discipline `0074`
used.

**Two of these need a decision, not an edit:** `open_shift_stock_check_atomic`
and `close_shift_stock_check_atomic` may exist *only* to write the ledger. If
removing the write leaves an empty function, say so and stop — deleting a
feature is the owner's call, not a consequence of this plan.

**After each commit:** the POS completes a sale, a purchase saves, an issue slip
saves. Not at the end — after each.

## 6. Phase D — drop the trigger, then the tables

`trg_stock_ledger_inventory_balances` first, then `inventory_balances`, then
`stock_ledger`.

**Export both tables to `docs/audits/2026-08-28-stock-ledger-backup.json`
first** and verify the file re-reads. 382 + the balance rows. After this they
exist nowhere else.

`fnbapp-bulk-data-change` applies. Owner approves the drop separately from
approving this plan.

## 7. Verification

- **On-hand unmoved for every item**, before and after every phase — diff the
  whole `computeOnHandByPurchasedItem` map, not a sample. This is the figure
  that must survive, and it is the one this plan claims already ignores the
  ledger. If it moves, the claim was wrong and the plan stops.
- `scripts/verify-revenue.ts` byte-identical throughout.
- COGS unmoved: `stock_issues` is untouched by all four phases — assert its row
  count and sum before and after.
- Full `CLAUDE.md` §9 at each phase, including `npm run build`.

## 8. Done means

`CLAUDE.md` §9. Do not push without approval. **And the owner must sell a real
drink on the real POS after phase C and after phase D** — thirteen functions on
the money path are being edited, and no gate here has ever caught a failure that
only appears in a logged-in session.
