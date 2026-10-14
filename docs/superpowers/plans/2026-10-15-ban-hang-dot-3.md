# Bán hàng, đợt 3: dữ liệu và cấu trúc, chuẩn bị sẵn chờ chủ quán duyệt

Proposal: `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`, sections "Data writes" (1 and 3), "Structure work" and "Order of work" steps 4 and 6. Owner 2026-10-15: *"Tiếp tục các việc khác đi nhé, việc nào anh chưa chốt thì anh sẽ chốt sau. Anh sẽ hỏi lại các việc cần chốt"*. So this batch writes and dry-runs everything. It runs nothing against the server's data or schema; each run waits for the owner.

## Hiện trạng

Measured 2026-10-15 on the live server.

1. **States.**
   - Orders: COMPLETED 3,414, SUPERSEDED 24, VOIDED 37 (3,475 rows). DRAFT is in the status check but used by 0 rows.
   - Dishes: ACTIVE 45, DELETED 3. Sizes: ACTIVE 57, DELETED 3. Every DELETED dish and size was never sold (0 order lines):
     - Cà phê kem dẻo CT1 (PROD-007, VAR-007);
     - Cà phê kem dẻo CT2 (PROD-008, VAR-008);
     - Cà phê đá (PROD-010, VAR-010);
     - each has 1 price history row and 0 options.
   - The audit also found the category Cacao and the duplicate option Dâu sấy DELETED. A3 measures them again.
2. **Buttons.** Not applicable: no screen changes. A1 changes only how the dish page decides "Đã bán".
3. **Lists.**
   - Price history: 37 of 55 rows have new price 0đ, all with effective date 28/06/2026 23:27 (the import).
     - 28 of these sizes were sold, and 27 of those 28 first sold at today's price.
     - 9 were never sold.
   - The dish page shows these rows as "→ 0".
4. **Inputs.**
   - Each script takes only `--apply`. Without it, it prints what it would write and writes nothing.
   - The migration's new checks refuse:
     - a price history row with new price 0 or below;
     - an order code minted past 999 a day (as a wider number, not a cut one).
5. **Data.**
   - Serves:
     - `product_price_history` (data write 1);
     - the never-sold DELETED rows (data write 3);
     - the order tables' dead columns and links (structure batch).
   - Deliberately not served:
     - promotion pricing C10 (new tables, its own four steps);
     - dropping DELETED from the status vocabulary. That touches 50 places across brands, promotions and reports, so it gets its own plan after data write 3 runs.

Own questions:

- **Can this stop the till?** Only the structure migration can. The till's order functions write `cost_at_sale`, `recipe_snapshot_json`, `currency` and `payment_ref` by name. A4 is split so the dangerous order never happens:
  1. **A4a** (code, pushable any time): nothing reads the dead columns.
  2. **The migration** (written by A4b, run only with the owner's approval, outside opening hours): rewrites the order functions to ignore those keys, then drops the columns.
  3. **A4b code** (held on the branch until the migration has run): the till stops sending them.

  If step 3 ships before step 2, the till's inserts lose a NOT NULL value and stop taking orders.
- **Does data write 1 change money?** No. Price history is shown on the dish page only. Orders keep their own `unit_price`, and the till reads `product_variants.price`.
- **What does erasing a DELETED dish take with it?** Its sizes and their price history (CLAUDE.md "Luật dữ liệu": a never-sold dish is erased with its price history). Anything else that points at it is listed in the dry run and stops the script, for example a promotion's dish list, a recipe or an option group link.

Example with real numbers (data write 1): price history row `PPH-002`, Cà phê sữa đá 500ml, reads old — new 0đ, effective 28/06/2026 23:27. Its first sale is line `ol-migrated-cb520e5b-8568-439e-8716-6ee00b131500` at 20.000đ, and today's price is 20.000đ, so the row becomes new 20.000đ. `PPH-012`, Cà phê sữa đá 360ml, was never sold, so it takes today's price, 17.000đ.

Seen: the live columns of the nine sales tables (information_schema), the counts above, `load-product-rows.ts`, `findOrderLineProductAndVariantIds` in `lib/db/tables.ts`, the list of migrations that insert into the order tables. Not seen: the full bodies of the live order functions (A4b reads them), the backup restore path for dropped columns (A4b), who reads `products.description` and the three `sort_order` columns (A4a greps).

## Tickets

All backend: Sonnet (Agent model `sonnet`). Ponytail is a project rule: no excess code. Each ticket starts by challenging this plan. Two agents run in parallel; their files do not overlap:
- **Agent 1** owns A1–A3: `app/admin/products/load-product-rows.ts`, `lib/db/tables.ts`, and new files in `scripts/`.
- **Agent 2** owns A4: `lib/sales/`, `app/admin/orders/order-helpers.ts`, `app/pos/`, `supabase/migrations/`, and `lib/__tests__/fixtures.ts`. It does not edit `lib/db/tables.ts`; it lists the lines there that must change, and Opus applies them.

- **A1. The dish page stops scanning every order line.**
  - Today `loadProductRow` calls `findOrderLineProductAndVariantIds()` for a dish linked to an option. That reads every order line just to get sold option ids.
  - Change: call the existing `find_sold_modifier_ids()` rpc directly. Delete the full-scan helper if nothing else calls it.
  - Test: a linked dish sold only as an option still reads "Đã có đơn".
- **A2. Data write 1, the price history script.**
  - Run it through skill `fnbapp-bulk-data-change`.
  - Rule: a row with `new_price = 0` takes its size's first sale `unit_price` (earliest order, then lowest line number), or today's price when the size was never sold. `old_price` stays as it is.
  - Output: print every change with dish name, size, old value → new value and its source line id. End with "N dòng sẽ sửa trên M dòng lịch sử giá". `--apply` writes, re-reads, and expects 0 rows at 0đ.
  - Test: a core test for the rule (sold, never sold, already non-zero).
- **A3. Data write 3, the never-sold DELETED leftovers.**
  - Erases DELETED dishes and sizes with 0 order lines, together with their price history rows. Also erases DELETED categories with no dish and DELETED options never sold (`find_sold_modifier_ids`).
  - Before writing, it lists every other table that references each row. It checks foreign keys from `pg_constraint`, and it does a text search of promotions' JSON dish lists and the order snapshots. If anything outside price history references a row, it stops and names it.
  - Output and `--apply` as A2. Both writes go in one Postgres function call, so they succeed or fail together (CLAUDE.md ponytail section: writes to two or more tables go through one rpc).
  - Test: a core test for the selection.
- **A4a. Code stops reading the dead columns** (pushable).
  - Columns: `order_lines_v2.cost_at_sale`, `recipe_snapshot_json`, `manual_discount_reason`; `orders_v2.currency`, `payment_ref`; `order_payments.reference`; `products.description`, `products.brand_id`; `sort_order` on products, product_variants and modifiers.
  - Measure each one's readers (grep `app lib scripts`) and remove only the reads. Writes stay until A4b.
  - If a column turns out to be read for a real purpose, stop and report it; do not drop it.
- **A4b. The structure migration and the stop-sending code** (written, not run; its code is held).
  - Migration `supabase/migrations/0121_…sql`:
    - `create or replace` each live order function (find the last migration that redefines each one) so it no longer writes the dead columns;
    - drop the columns;
    - drop DRAFT from the order status check;
    - turn empty text into null in the order link columns, then add their foreign keys. The audit counts five; measure which ones and how many rows hold empty text;
    - `RESTRICT` instead of `CASCADE` on order lines and order events;
    - minting: no `lpad` cut. The daily number grows past 3 digits instead of turning 1000 into 100;
    - a check that `product_price_history.new_price > 0`. This runs only after data write 1, so the migration header says so.
  - Header: the run order (data write 1 first; migration; then push the A4b code) and the measured counts before it.
  - Code: `lib/sales/order-cart.ts`, `order-types.ts`, the fixtures and the till payload stop sending the dropped keys.
  - Commit A4b separately from A4a, so A4a can be pushed alone.
  - The backup restore path must accept a bundle taken before the migration. Check how migration 0120 handled its dropped column and do the same.

Opus: reviews each ticket, applies the `lib/db/tables.ts` lines A4 lists, runs the five gates, and updates the master plan row.

## What was built, 2026-10-15 (differences from the tickets above)

- **A1** as planned: `findSoldModifierIds()` (the rpc only) replaces the full-scan helper, which had no other caller.
- **A2** dry run: 37 of 55 rows will change. 28 take their first sale price; 9 never-sold sizes take today's price. One sold size differs from today's price: `PPH-006`, Cacao latte 500ml, first sold at 27.000đ, today 23.000đ. It takes 27.000đ, the rule's value. The script pages its reads; PostgREST caps a read at 1,000 rows, and the first draft got PPH-006 wrong because of it.
- **A3** needs no migration. The live `erase_never_sold_product_atomic` (0075) already erases a dish with its sizes and price history in one transaction.
  - Dry run: Cà phê kem dẻo CT1, Cà phê kem dẻo CT2, Cà phê đá (3 sizes, 3 price-history rows) and the category Cacao.
  - Kept: the option Dâu sấy (`MOD-007`, DELETED, never sold). The input snapshot of order 260624002014 still names it, although that line points at the live Dâu sấy (`MOD-008`).
  - Opus decision: a row something still points at is kept and reported, not a stop for the whole run.
- **A4 differences:**
  - `order_payments.reference` is kept, because the till's "Mã" box writes it (empty on 1,883 of 1,883 rows today).
  - `voided_by_id` becomes null-only with no foreign key: 2 of its 37 values are `system`.
  - `superseded_by` gets a deferred key, because `supersede_order_v2_atomic` writes it before the new row exists.
  - The `new_price > 0` check is dropped from 0121. A 0đ dish or topping saved from the product screens is legitimate, so data write 1 no longer has to run first.
  - The brand-delete screen stopped counting dishes by `products.brand_id`.
  - The backup restore strips the retired keys, turns `''` into null, and sets `superseded_by` after insert.

## Approvals queued for the owner (asked later, one at a time)

1. Run data write 1 (`--apply`).
2. Run data write 3 (`--apply`).
3. Push A1, A2, A3, A4a (no migration, the till unchanged).
4. Run migration 0121, outside opening hours. This one can stop the till if it goes wrong, so the owner is told beforehand.
5. Push A4b's code, right after 4.
