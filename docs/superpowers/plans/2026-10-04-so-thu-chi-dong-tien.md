# Sổ thu chi: mọi dòng tiền, chuyển tiền, đầu kỳ và cuối kỳ — Implementation Plan

> **For agentic workers:** backend tasks (1–5) to Sonnet (Agent tool, model `sonnet`); UI tasks (6–8) to Gemini via `agy` (newest generation at its highest level, checked with `agy models` at hand-off); Opus runs tests, proves new tests red on the old code, reviews, runs the five gates, writes docs, commits. Sonnet first critiques this plan against the spec and reports disagreements before coding. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the cash book shows sales and purchase-order money as day rows, records drawer↔bank transfers, and shows opening and closing balances for cash, bank and total.

**Architecture:** one migration adds `cash_transfers`, the payment fields on `purchase_orders`, and a read-only view `cash_book_daily` that sums completed sales and purchase orders per Saigon day and method. A pure module `lib/finance/cash-flow.ts` turns view rows, hand rows and transfers into balances, totals and list rows. The screen receives plain data computed on the server.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind, Vitest + Testing Library, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-10-04-so-thu-chi-dong-tien-design.md` (approved 2026-10-04). Rules: `BR-CASH-001`, `BR-CASH-007`, `BR-CASH-008`.

## Hiện trạng

1. **Trạng thái.** Hand rows `ACTIVE`/`CANCELLED` as today. Transfers the same: created `ACTIVE`; "Huỷ" sets `CANCELLED` (stays visible, counts nowhere); ADMIN "Xoá" removes it. Day rows have no state: they exist while at least one completed order (or purchase order) of that day and method exists. Purchase orders: `DRAFT` may have no payment method; `COMPLETED` must have one (database check).
2. **Nút.** List: "+ Ghi khoản mới", "+ Chuyển tiền"; bin and tick box only on hand and transfer rows, ADMIN only (`canRemove` returns false for day rows). Transfer detail: "Chỉnh sửa", "Huỷ" (hidden once cancelled), "Xoá" (ADMIN). Transfer edit: "Lưu", "Bỏ". Day row: none, the row opens the day's list. Purchase-order form: "Trả bằng", "Tài khoản". Completed purchase-order detail: a "Trả bằng" block with "Lưu" (ADMIN, MANAGER).
3. **Danh sách.** For the range: hand rows, transfers, day rows (sale and purchase, per method). Status filter "Đang dùng" (default) hides cancelled hand rows and transfers; "Đã huỷ" shows only those and no day row; "Tất cả" shows everything. "Loại" filter: Tất cả / Bán hàng / Nhập hàng / Ghi tay / Chuyển tiền. 20 a page, newest date first. Balances and totals always cover the whole range, never the page or the filters.
4. **Ô nhập.** Transfer: Ngày (required, real calendar date, else "Chọn ngày chuyển"); Số tiền (`MoneyInput`, whole đồng > 0, else "Số tiền phải lớn hơn 0"); Từ / Đến ("Tiền mặt (két)" or an active bank account; same on both sides → "Nơi chuyển và nơi nhận phải khác nhau"; unknown or stopped account → "Tài khoản không còn dùng"); Ghi chú optional, trimmed. Purchase order: Trả bằng nothing pre-chosen; saving as completed without it → "Chọn cách trả tiền"; Chuyển khoản without Tài khoản → "Chọn tài khoản nhận chuyển khoản"; a draft may leave both empty. URL: `kind` unknown → Tất cả; `page` < 1 or not a number → 1, beyond last → last; date range as today (`resolveDateRange`).
5. **Dữ liệu.** Reads `orders_v2` (status `COMPLETED`), `order_payments`, `purchase_orders` (status `COMPLETED`), `cash_entries`, new `cash_transfers`, `cash_categories`, `bank_accounts`. Writes only `cash_transfers` and the two new `purchase_orders` fields. Not served: which account a POS transfer reached; per-account balances; P&L (unchanged).

Thêm, riêng cho việc này:
- **Không chép.** No sale or purchase is ever written into `cash_entries` or `cash_transfers`.
- **Ngày.** Saigon calendar day of `orders_v2.created_at`; of `coalesce(purchase_orders.transaction_date, created_at)`; `entry_date`; `transfer_date`.
- **Thứ tự đưa lên.** The view and table must exist before the new cash book code runs, and the purchase-order check must not exist before the code that sends the payment fields runs. Order: push code, then apply the migration right after (each with its own approval). In the minutes between, `/admin/finance` errors; purchase-order saves keep working (the old function ignores the new fields). Said to the owner before the push.
- **Lỗi lệch giờ của danh sách đơn hàng** (spec §6.3) is fixed by the separate time-zone audit plan (`docs/superpowers/plans/2026-10-04-ra-soat-lech-gio.md`, site A1), done before Task 6, not here.

**Worked example (measured 2026-10-04, read only), filter 01/09/2026–30/09/2026:**

| | Tiền mặt | Ngân hàng | Tổng |
|---|---|---|---|
| Đầu kỳ 01/09/2026 | −10.341.000đ | 23.756.578đ | 13.415.578đ |
| Cuối kỳ 30/09/2026 | −7.351.887đ | 27.972.578đ | 20.620.691đ |

Tổng thu 17.885.400đ = sales 15.442.000đ (cash 11.226.000đ / 465 orders, transfer 4.216.000đ / 159 orders) + `CE-040` Vốn góp 2.443.400đ. Tổng chi 10.680.287đ = 25 purchase orders 9.043.287đ + hand expense 1.637.000đ. 13.415.578 + 17.885.400 − 10.680.287 = 20.620.691. Rows on 15/09/2026: Bán hàng · Tiền mặt · 23 đơn · 522.000đ; Bán hàng · Chuyển khoản · 11 đơn · 482.000đ; Nhập hàng · Tiền mặt · 2 đơn nhập · 536.023đ (`PO-180` "Không rõ" 30.000đ, `PO-181` Thế Kỷ Xanh 506.023đ). September: 46 sale rows, 17 purchase rows, 8 hand rows.

Đã xem: spec, `app/admin/finance/page.tsx`, `actions.ts`, `CashBookClient.tsx`, `lib/finance/cash-entry-rules.ts`, `supabase/migrations/0078_retire_ledger_purchase_order.sql` (live `save_purchase_order_atomic`), `0101_cash_book.sql` (triggers, RLS, grants), `lib/purchasing/purchase-order-transaction.ts`, `app/admin/inventory/purchase-orders/actions.ts` (`savePurchaseOrder` to line 140), `[id]/page.tsx`, `page.tsx`, `lib/purchasing/purchase-order-list.ts` (filters), `app/admin/nav-allowlist.ts`, `lib/db/tables.ts` (`generateNewId`). Chưa xem: `PurchaseOrderForm.tsx` body, `PurchaseOrdersClient.tsx`, the rest of `savePurchaseOrder` (edit trail, asset creation), `findAllWhere` caching.

## Global Constraints

- Code and comments English; every on-screen word Vietnamese.
- Whole đồng everywhere; no rounding (`BR-CASH-005`, `BR-DATA-*`).
- No popups on admin screens (`BR-DATA-007`); yes/no `confirm` from `@/lib/shared/dialog` is allowed.
- A server page passes no function prop to a client component.
- Desktop table and phone cards, both usable (`.claude/rules/ui-devices.md`).
- Permanent deletion ADMIN only, checked with `requireOwner()` on the server.
- New tests are shown red on the code before the change (Opus runs this).

## Review Focus

1. **Range starting before 2026-03-26 or ending in the future** — opening is 0đ / closing counts only what exists; no error. Test in Task 2.
2. **A cancelled transfer or cancelled hand row before the range** — must not move the opening balance. Test in Task 2.
3. **A purchase order completed with "Chuyển khoản" and then its account stopped** — the day row still shows, with the account name, and the order can still be re-saved only after choosing an active account. Test in Task 5.
4. **Editing a completed purchase order through the existing "Sửa phiếu" form** — the form must carry the saved payment method, not blank it (a blank would be refused on save). Test in Task 8.
5. **Filter "Đã huỷ"** — day rows never appear, balances unchanged. Test in Task 6.

---

### Task 1 (Sonnet): migration `0107_cash_book_money_flow.sql`, types

**Files:**
- Create: `supabase/migrations/0107_cash_book_money_flow.sql`
- Create: `tests/migrations/cash-book-money-flow-migration.test.ts`
- Modify: `types/db.ts` (add `DBCashTransfer`, `DBCashBookDailyRow`; add `payment_method`, `bank_account_id` to `DBPurchaseOrder`)

**Interfaces — Produces:**
```ts
export interface DBCashTransfer {
  id: string; transfer_date: string; amount: number;
  from_account_id: string | null; to_account_id: string | null; // null = cash drawer
  note: string; status: "ACTIVE" | "CANCELLED";
  created_at: string; created_by_id: string | null; created_by_name: string | null;
  updated_at: string; updated_by_id: string | null; updated_by_name: string | null;
}
export interface DBCashBookDailyRow {
  source: "SALE" | "PURCHASE"; day: string; method: "CASH" | "BANK_TRANSFER";
  bank_account_id: string | null; doc_count: number; amount: number;
}
// DBPurchaseOrder gains:
payment_method?: "CASH" | "BANK_TRANSFER" | null;
bank_account_id?: string | null;
```

- [ ] **Step 1: Failing migration-text test** asserting the file: creates `public.cash_transfers` with `check (amount > 0)`, `from_account_id is distinct from to_account_id`, both account FKs `on delete restrict`, the `touch_updated_at` trigger, RLS enabled and grants to `service_role` only; adds `payment_method` with default `'CASH'` and then `drop default`; adds `purchase_orders_completed_has_payment` and the method/account check; creates view `public.cash_book_daily` using `at time zone 'Asia/Saigon'` for both sources and `status = 'COMPLETED'` for both; redefines `save_purchase_order_atomic(jsonb, jsonb, boolean)` writing `payment_method` and `bank_account_id` in **both** the insert and the replace branch.
- [ ] **Step 2: Write the migration.** Copy RLS/grant/trigger lines from `0101_cash_book.sql`. Copy the function body from `0078` (the live definition; Sonnet confirms there is no later one) with `create or replace` and the two fields added. Core DDL:

```sql
create table public.cash_transfers (
  id text primary key,
  transfer_date date not null,
  amount bigint not null check (amount > 0),
  from_account_id text references public.bank_accounts(id) on delete restrict,
  to_account_id text references public.bank_accounts(id) on delete restrict,
  note text not null default '',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  created_by_id text, created_by_name text,
  updated_at timestamptz not null default now(),
  updated_by_id text, updated_by_name text,
  constraint cash_transfers_two_ends check (from_account_id is distinct from to_account_id)
);

alter table public.purchase_orders
  add column payment_method text default 'CASH',
  add column bank_account_id text references public.bank_accounts(id) on delete restrict;
-- The default only fills the rows that exist today (198 completed, measured
-- 2026-10-04; BR-CASH-001 answer 3a). New orders must choose (answer 1a).
alter table public.purchase_orders alter column payment_method drop default;
alter table public.purchase_orders
  add constraint purchase_orders_payment_method_valid
    check (payment_method is null or payment_method in ('CASH', 'BANK_TRANSFER')),
  add constraint purchase_orders_completed_has_payment
    check (status <> 'COMPLETED' or payment_method is not null),
  add constraint purchase_orders_account_matches_method
    check ((payment_method = 'BANK_TRANSFER') = (bank_account_id is not null));

create view public.cash_book_daily with (security_invoker = true) as
with sale_money as (
  select o.id,
         (o.created_at at time zone 'Asia/Saigon')::date as day,
         coalesce(p.method, o.payment_method) as method,
         coalesce(p.amount, o.net_total) as amount
  from public.orders_v2 o
  left join public.order_payments p on p.order_id = o.id
  where o.status = 'COMPLETED'
)
select 'SALE'::text as source, day, method, null::text as bank_account_id,
       count(distinct id)::int as doc_count, sum(amount)::bigint as amount
from sale_money group by day, method
union all
select 'PURCHASE'::text,
       (coalesce(transaction_date, created_at) at time zone 'Asia/Saigon')::date,
       payment_method, bank_account_id, count(*)::int, sum(total_amount)::bigint
from public.purchase_orders where status = 'COMPLETED'
group by 2, 3, 4;
grant select on public.cash_book_daily to service_role;
```
- [ ] **Step 3: Writer inventory** (`fnbapp-bulk-data-change` §6): grep every insert/update of `purchase_orders` in `supabase/migrations/*.sql`, `app/`, `lib/`, `scripts/`; report each writer and whether it satisfies the new checks. Report the triggers on `purchase_orders` (live query by Opus if needed).
- [ ] **Step 4:** test green; `npx tsc --noEmit` clean. Do **not** apply the migration.

### Task 2 (Sonnet): `lib/finance/cash-flow.ts`

**Files:** Create `lib/finance/cash-flow.ts`, `lib/finance/cash-flow.test.ts`.

**Interfaces — Consumes:** Task 1 types; `DBCashEntry`, `DBCashCategory`. **Produces:**
```ts
export interface Balance { cash: number; bank: number; total: number }
export interface CashBookTotals {
  totalIncome: number; totalExpense: number;      // transfers excluded
  salesIncome: number; purchaseExpense: number;
  handIncome: number; handExpense: number; incomeOutsidePnl: number;
}
export interface CashBookSummary {
  opening: Balance; closing: Balance; totals: CashBookTotals;
  byGroup: { key: string; name: string; side: "INCOME" | "EXPENSE"; total: number }[]; // "SALE"/"PURCHASE" keys + category ids
  unknownCategoryIds: string[];
}
export function summariseCashBook(input: {
  dayRows: DBCashBookDailyRow[]; entries: DBCashEntry[]; transfers: DBCashTransfer[];
  categories: DBCashCategory[]; start: string; end: string; // "YYYY-MM-DD", inclusive
}): CashBookSummary;
```
Inputs may contain rows before `start` (for the opening) and must not contain rows after `end` that count; rows after `end` are ignored.

- [ ] **Step 1: Failing tests**, one per line of spec §4's table; plus:
  - opening counts days `< start`, closing counts days `<= end`;
  - cancelled hand rows and cancelled transfers count nowhere, before or inside the range;
  - a 5.000.000đ transfer cash→`BA-001` on a day in range: cash −5.000.000, bank +5.000.000, total, `totalIncome`, `totalExpense` unchanged;
  - identity `closing.total === opening.total + totalIncome - totalExpense` on a mixed fixture;
  - a hand row with an unknown category counts in neither balance nor totals and is listed in `unknownCategoryIds` (keeps the identity);
  - range before any data: opening and closing all 0;
  - **September 2026 fixture**: day rows giving cash sales 11.226.000, transfer sales 4.216.000, cash purchases 9.043.287; hand income 2.443.400 (`CE-040`, category with `affects_pnl: false`), hand cash expense 1.637.000; opening movements summing to cash −10.341.000 / bank 23.756.578 → expect the closing figures of the worked example and `incomeOutsidePnl` 2.443.400.
- [ ] **Step 2:** run, see them fail (missing module).
- [ ] **Step 3:** implement: map every row to `{ day, side: "CASH" | "BANK", signed amount }` (`method === "CASH"` → cash side; transfer: `from === null` → cash −, else bank −; `to === null` → cash +, else bank +), then sum by `day < start` and `day <= end`. Totals and `byGroup` only from rows with `start <= day <= end`.
- [ ] **Step 4:** green, `tsc` clean.

### Task 3 (Sonnet): transfer rules and actions

**Files:**
- Create: `lib/finance/cash-transfer-rules.ts`, `lib/finance/cash-transfer-rules.test.ts`
- Create: `app/admin/finance/transfers/actions.ts`, `app/admin/finance/transfers/actions.test.ts`

**Produces:**
```ts
export interface CashTransferInput { transfer_date: string; amount: string; from: string; to: string; note: string } // from/to: "CASH" or a bank account id
export interface CashTransferFields { transfer_date: string; amount: number; from_account_id: string | null; to_account_id: string | null; note: string }
export function parseCashTransfer(input: CashTransferInput, activeAccountIds: string[]): ParseResult<CashTransferFields>;
// actions (all "use server"):
getCashTransfer(id: string): Promise<DBCashTransfer | null>          // requireAdmin
getCashTransfers(throughDay: string): Promise<DBCashTransfer[]>      // requireAdmin, transfer_date <= throughDay
addCashTransfer(fd: FormData): Promise<ActionResponse>               // requireAdmin, id via generateNewId("Cash_Transfers", "CT")
updateCashTransfer(fd: FormData): Promise<ActionResponse>            // requireAdmin, refuses a cancelled one: "Dòng đã huỷ, không sửa được"
cancelCashTransfer(fd: FormData): Promise<ActionResponse>            // requireAdmin, "Dòng đã huỷ rồi" if already
deleteCashTransfer(fd: FormData): Promise<ActionResponse>            // requireOwner
```
Form field names: `id`, `transfer_date`, `amount`, `from`, `to`, `note`. Audit columns via `creationAudit` / `updateAudit` (`lib/finance/audit-columns.ts`). Amount parsing: the same digits-or-dot-groups rule as `parseCashEntry` — reuse its amount helper (export it if it is private; no copy). `revalidatePath("/admin/finance")`.

- [ ] **Step 1: Failing tests:** every message in Hiện trạng §4 for transfers; `CASH`→`CASH` refused; `BA-001`→`BA-001` refused; stopped account refused; `150.000` accepted as 150000; `delete` refused for MANAGER; `update` refused on a cancelled row; `add` writes `status: "ACTIVE"` and audit fields. Mock `lib/db/tables` and `lib/auth/auth` as `app/admin/finance/actions.test.ts` does.
- [ ] **Steps 2–4:** fail, implement, green, `tsc`.

### Task 4 (Sonnet): cash book data loader and list rows

**Files:**
- Create: `lib/finance/cash-book-daily.ts` (reads the view), `lib/finance/cash-book-rows.ts`, `lib/finance/cash-book-rows.test.ts`
- Modify: `app/admin/finance/actions.ts` (`getFinancePageData`), `app/admin/finance/actions.test.ts`
- Create: `scripts/verify-cash-book.ts`, `scripts/verify-cash-book-core.ts`, `scripts/verify-cash-book-core.test.ts`

**Produces:**
```ts
// lib/finance/cash-book-daily.ts -- direct Supabase read, no cache: sales change every minute.
export async function readCashBookDaily(throughDay: string): Promise<DBCashBookDailyRow[]>;

// lib/finance/cash-book-rows.ts
export type CashBookRowKind = "SALE" | "PURCHASE" | "HAND" | "TRANSFER";
export interface CashBookRow {
  key: string;               // unique: "SALE:2026-09-15:CASH", "CE-040", "CT-001"
  kind: CashBookRowKind;
  id: string | null;         // null for day rows
  date: string;              // "YYYY-MM-DD"
  groupLabel: string;        // "Bán hàng" | "Nhập hàng" | category name | "Chuyển tiền"
  sideLabel: "Thu" | "Chi" | "Chuyển";
  amount: number;
  methodLabel: string;       // "Tiền mặt" | "Chuyển khoản" | "Két → ACB - Phin Di"
  accountLabel: string;      // "—" when none
  note: string;              // "23 đơn", "2 đơn nhập", hand note, transfer note
  creator: string;           // "—" for day rows
  status: "ACTIVE" | "CANCELLED";
  href: string;              // no returnTo; the client appends it for HAND and TRANSFER
}
export function buildCashBookRows(input: {
  dayRows: DBCashBookDailyRow[]; entries: DBCashEntry[]; transfers: DBCashTransfer[];
  categories: DBCashCategory[]; accounts: DBBankAccount[];
}): CashBookRow[];
// hrefs: HAND "/admin/finance/<id>"; TRANSFER "/admin/finance/transfers/<id>";
// SALE "/admin/orders?from=D&to=D&payment=Tien%20mat|Chuyen%20khoan" (the values that list already reads);
// PURCHASE "/admin/inventory/purchase-orders?from=D&to=D&pay=CASH|BANK_TRANSFER".

// app/admin/finance/actions.ts
export async function getFinancePageData(start: string, end: string): Promise<{
  rows: CashBookRow[];            // only start..end, all statuses
  summary: CashBookSummary;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
}>;
```
The loader reads hand rows, transfers and day rows **through `end`** (everything before `start` is needed for the opening), passes them to `summariseCashBook`, and builds rows only for `start..end`.

- [ ] **Step 1: Failing tests:** `buildCashBookRows` for each kind on the 15/09/2026 example (three day rows exactly as in the worked example, hrefs exact); a transfer from cash to `BA-001` reads "Két → ACB - Phin Di"; `getFinancePageData` asks for hand rows with `lte entry_date end` and no `gte`, and returns only in-range rows.
- [ ] **Step 2–4:** fail, implement, green.
- [ ] **Step 5: `scripts/verify-cash-book.ts`** (read only, no `--apply`): for each month end from 2026-03 to the current month, compute closing cash/bank/total with the app's own loader path (`summariseCashBook` over the same rows) and with an independent SQL that sums raw `orders_v2`/`order_payments`/`purchase_orders`/`cash_entries`/`cash_transfers` (not the view). Print "0 lệch trên N tháng × 3 số" or each difference. The core comparison lives in `verify-cash-book-core.ts` with its own test. Runs only after the migration is applied.

### Task 5 (Sonnet): purchase-order payment, backend

**Files:**
- Create: `lib/purchasing/purchase-order-payment.ts`, `lib/purchasing/purchase-order-payment.test.ts`
- Modify: `app/admin/inventory/purchase-orders/actions.ts` (`savePurchaseOrder` passes the fields; new `setPurchaseOrderPayment`), its tests
- Modify: `lib/purchasing/purchase-order-list.ts` (`pay` filter; `PurchaseOrderListRow.paymentLabel`), its test; `app/admin/inventory/purchase-orders/page.tsx` (read `pay`)

**Produces:**
```ts
export type PurchasePaymentMethod = "CASH" | "BANK_TRANSFER";
export function parsePurchaseOrderPayment(input: {
  status: string; method: string; bankAccountId: string;
  activeAccountIds: string[]; currentAccountId?: string | null; // the order's saved account, allowed even if stopped
}): ParseResult<{ payment_method: PurchasePaymentMethod | null; bank_account_id: string | null }>;
export async function setPurchaseOrderPayment(fd: FormData): Promise<ActionResponse>; // fields: id, payment_method, bank_account_id; requireAdmin; only COMPLETED orders; updates those two columns only
// PurchaseOrderListFilters gains: pay?: string   ("CASH" | "BANK_TRANSFER"; anything else ignored)
// PurchaseOrderListRow gains: paymentLabel: string  ("Tiền mặt" | "Chuyển khoản" | "—")
```
Form field names on the purchase-order form: `payment_method`, `bank_account_id`.

- [ ] **Step 1: Failing tests:** completed + empty method → "Chọn cách trả tiền"; draft + empty → ok with nulls; `BANK_TRANSFER` + empty account → "Chọn tài khoản nhận chuyển khoản"; `CASH` + account → account cleared to null; stopped account refused unless it equals `currentAccountId` (Review Focus 3); `savePurchaseOrder` puts both fields into the `order` object sent to `savePurchaseOrderAtomic`; `setPurchaseOrderPayment` refuses a draft ("Phiếu nháp: chọn cách trả trong phiếu") and an unknown id, and writes only `payment_method`, `bank_account_id`; list `pay=BANK_TRANSFER` keeps only those rows.
- [ ] **Steps 2–4:** fail, implement, green, `tsc`.

### Task 6 (Gemini): cash book screen

**Files:** Modify `app/admin/finance/page.tsx`, `app/admin/finance/components/CashBookClient.tsx`, `CashBookClient.test.tsx`.

**Consumes:** `getFinancePageData` (Task 4), `CashBookRow`, `CashBookSummary`.

- Header actions: "+ Ghi khoản mới" (as today) and "+ Chuyển tiền" → `/admin/finance/transfers/new?returnTo=<encoded list url>`.
- Above the totals: two cards "Đầu kỳ (dd/MM/yyyy)" and "Cuối kỳ (dd/MM/yyyy)", each Tiền mặt / Ngân hàng / Tổng; negative numbers in `text-danger` with the minus sign. Phone: the two cards stacked.
- Totals: Tổng thu, Tổng chi, "trong đó Thu ngoài lãi lỗ"; Theo nhóm from `summary.byGroup`.
- FilterCard gains "Loại" (`kind` in the URL: `SALE`, `PURCHASE`, `HAND`, `TRANSFER`; omitted = Tất cả). Status filter "Đã huỷ" shows no day row (Review Focus 5).
- Columns: Mã (`id` or "—"), Ngày, Nhóm, Bên, Số tiền, Cách trả, Tài khoản, Ghi chú, Người tạo, Trạng thái (day rows: no badge). Default sort date desc (unchanged `parseSort(..., "date")`).
- Row link: `row.href`, plus `returnTo` for HAND and TRANSFER. `removal.canRemove: (r) => r.kind === "HAND" || r.kind === "TRANSFER"`; remove calls `deleteCashEntry` or `deleteCashTransfer` by kind; ADMIN only, as today.
- Tests: the 15/09/2026 day rows render with their labels and hrefs; day rows have no checkbox; `kind=SALE` shows only sale rows; status `CANCELLED` shows no day row and the balance cards keep their numbers; balance cards show the September figures from a fixture summary; no link contains `/edit`.

### Task 7 (Gemini): transfer pages

**Files:** Create `app/admin/finance/transfers/new/page.tsx`, `[id]/page.tsx`, `[id]/components/CashTransferDetailView.tsx`, `[id]/edit/page.tsx`, `components/CashTransferForm.tsx`, `components/return-to.ts`, tests beside each; Modify `app/admin/nav-allowlist.ts` (add `/admin/finance/transfers/new`, reason "reached from the cash book -- legitimately unlinked").

- Copy the shape of `app/admin/finance/[id]/**` and `app/admin/finance/new/page.tsx` (wave 6). Form fields per Hiện trạng §4: Ngày, Số tiền (`MoneyInput`), Từ, Đến (options "Tiền mặt (két)" value `CASH` + active accounts), Ghi chú. Detail: FieldList Mã, Ngày, Số tiền, Từ, Đến, Ghi chú, Trạng thái, Người tạo; actions "Chỉnh sửa", "Huỷ" (confirm "Huỷ dòng chuyển tiền này? Số dư sẽ tính lại."), "Xoá" (ADMIN). Unknown id → `notFound()`. `returnTo` accepts `/admin/finance` with query and `/admin/finance/transfers/<id>`.
- Tests: form refuses same from/to before submit; detail hides "Huỷ" on a cancelled row; MANAGER sees no "Xoá"; page passes no function props.

### Task 8 (Gemini): purchase-order screens

**Files:** Modify `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`, `[id]/page.tsx` (+ a new `[id]/components/PurchasePaymentBlock.tsx`), `components/PurchaseOrdersClient.tsx`, their tests.

- Form: "Trả bằng" radio Tiền mặt / Chuyển khoản, nothing pre-selected on a new order; "Tài khoản" select shown for Chuyển khoản, preselected when exactly one active account. Editing an existing order starts from its saved values (Review Focus 4). Messages from Task 5 shown inline.
- Detail page of a completed order: in "Thông tin thanh toán", a "Trả bằng" block showing the current value and, for ADMIN/MANAGER, the same two inputs and "Lưu" calling `setPurchaseOrderPayment`; inline, no popup.
- List: secondary column "Trả bằng" (`paymentLabel`), filter "Trả bằng" (`pay`).
- Tests: new order has no radio checked; saving completed without one shows "Chọn cách trả tiền"; editing PO with `BANK_TRANSFER`/`BA-001` shows both selected; the detail block calls the action with `id`, `payment_method`, `bank_account_id`.

### Task 9 (Opus): docs, gates, release

- `docs/03-workflows/cash-book.md` (day rows, transfers, balances), `docs/01-system/TABLE-DICTIONARY.md` (`cash_transfers`, view `cash_book_daily`), the purchase-order flow doc (Trả bằng), `BR-CASH-*` status lines from "not built yet" to built, with test links.
- Red-on-old proof for every new test; five gates (build in a worktree).
- Before the push, ask separately: push, then migration `0107`. After the migration: run `scripts/verify-cash-book.ts`, expect 0 lệch on every month × 3 figures, and the September figures above.
- Owner check list: `/admin/finance` for September 2026 (the balance cards and the three rows of 15/09/2026), a test transfer is **not** created on real data by Claude; `PO-181` detail shows "Trả bằng: Tiền mặt".
