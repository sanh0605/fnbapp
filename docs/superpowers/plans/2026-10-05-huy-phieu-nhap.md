# Huỷ phiếu nhập — Implementation Plan

> **For agentic workers:** backend tasks (1–5) to Sonnet (Agent tool, model `sonnet`); UI task 6 to Gemini via `agy` (newest generation at its highest level, checked with `agy models` at hand-off); Opus runs tests, proves new tests red on the old code, reviews, runs the five gates, writes docs (Task 7), commits. Sonnet first critiques this plan against the spec and reports disagreements before coding. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a purchase order can be cancelled from its own page with a typed reason; it stays listed as "Đã huỷ", leaves stock, cost, P&L and the cash book, and retires its assets — refused before the last stocktake, when stock would go below zero at any moment since the order, or when one of its assets was disposed.

**Architecture:** one migration (`0108`, no `create table`) adds four cancel columns and a check to `purchase_orders`, a read-only check function and an atomic cancel function, and makes the save function refuse a cancelled order. A pure module turns the check's JSON into Vietnamese sentences. Every existing money and stock reader already counts `COMPLETED` only, so none of them changes. A separate fix keeps purchase-line ids stable across an edit, so an edited order's assets stay findable by the cancel.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind, Vitest + Testing Library, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-10-05-huy-phieu-nhap-design.md` (approved 2026-10-05; below-zero check widened the same day). Rule: `BR-INV-015` in `docs/02-rules/business-rules/purchasing.md`. Related: `BR-INV-013`, `BR-COGS-008`, `BR-DATA-007`, `BR-CASH-001`.

## Hiện trạng

1. **Trạng thái.** `purchase_orders.status`: `DRAFT` and `COMPLETED`, set by the form's two save buttons; `CANCELLED` allowed by the `0001` check, written by nothing (199 orders, all `COMPLETED`, 2026-10-05). After this plan: `CANCELLED` is written only by `cancel_purchase_order_atomic`, together with `cancelled_at`, `cancelled_by_id`, `cancelled_by_name`, `cancel_reason`; no way back.
2. **Nút.** Detail page today: "Sửa phiếu" (ADMIN, completed only; a draft opens straight in the form), "Trả bằng" block (ADMIN, MANAGER, completed only). Added: "Huỷ phiếu" (ADMIN, MANAGER; draft or completed; hidden on a cancelled order and for STAFF) → `/admin/inventory/purchase-orders/[id]/cancel`. On a cancelled order: no "Sửa phiếu", no "Huỷ phiếu", "Trả bằng" read-only. Cancel page: "Xác nhận huỷ" (disabled while the reason is blank; absent when blocked), "Quay lại".
3. **Danh sách.** Status filter today: Tất cả (default) / Nháp / Hoàn thành. After: **Chưa huỷ** (default, `ACTIVE` = drafts and completed) / Nháp / Hoàn thành / Đã huỷ / Tất cả; badge "Đã huỷ". Supplier detail lists all of the supplier's orders, cancelled included, with the badge (it passes `status: "ALL"` explicitly, since the default now hides cancelled). Item purchase history and every report keep `COMPLETED` only.
4. **Ô nhập.** One: "Lý do huỷ (bắt buộc)", trimmed, 1–500 characters. Blank → "Lý do huỷ phiếu là bắt buộc"; over 500 → "Lý do huỷ tối đa 500 ký tự" (checked in the browser, the server action and the database function). URL `status`: `ACTIVE` | `DRAFT` | `COMPLETED` | `CANCELLED` | `ALL`; missing or unknown → `ACTIVE`.
5. **Dữ liệu.** Reads `purchase_orders`, `purchase_order_lines`, `stock_issues`, `stocktake_sessions`, `assets`, `asset_disposals`, `purchased_items`, `units`. Writes `purchase_orders` (status + four columns) and `assets.status` (`INACTIVE`). Not served: undoing a cancel; cancelling one line of an order; a month lock; re-pointing the 10 assets already orphaned by past edits (below).

Thêm, riêng cho việc này:
- **Đồng thời.** The cancel takes the advisory lock every stock writer takes (`hashtext('stock_issues:id')`: issue slips create/edit/cancel/reverse, stocktake apply/reverse — 17 migrations, last `0106`), then locks the order row. A slip saved at the same instant waits; a save of the same order waits and then meets `CANCELLED`.
- **Đổi gì, từ khi nào.** Stock and weighted-average cost from the order's moment on; P&L of every month from that month (cost of goods, purchases used at once, depreciation of its assets — all months, earlier ones included); the cash book's day row and every balance after it. Nothing before the order's moment.
- **Tài sản mồ côi (found while planning, 2026-10-05).** Every save of an existing order deletes its lines and re-inserts them with new ids (`buildPurchaseOrderWritePlan`: `POL-${idFactory()}` for every line), so an asset made from a line loses its link the first time the order is edited. Measured: 84 assets, 74 linked, 10 orphaned — `TS-009`, `TS-010` (edit of `PO-098` 26/08/2026) and `TS-012`…`TS-019` (edit of `PO-100` 02/09/2026). Both orders are dated April, before `STK-001`, so neither can be cancelled and this plan does not touch them. Without Task 1, cancelling an order edited after its assets were made would leave those assets depreciating. Task 1 makes an edit reuse the old line ids, matched by item.
- **Thứ tự đưa lên.** Code first (owner approval for the push), then `0108` (separate approval). Between the two: the cancel page shows "Chưa cập nhật dữ liệu, chưa huỷ được phiếu."; nothing else reads the new columns; the TypeScript save refusal works on its own.

**Worked example (measured 2026-10-05 15:50, read only).**

| Order | Line | Item | Order qty | What the check finds | Result |
|---|---|---|---|---|---|
| `PO-147`, 13/08/2026, 20.200đ, Tiền mặt | `POL-b30d3706-a0d6-44dc-a55d-3404a6357305` | Vòi rót rượu | 2 Cái | after `STK-001`; stock never below 2; asset `TS-080` (2 cái, 20.200đ, 12 months), no disposal | cancellable; `TS-080` → `INACTIVE`; depreciation −1.683,33…đ in each of 08, 09, 10/2026 (−5.050đ through October); cash book 13/08: "Nhập hàng · Tiền mặt · 3 đơn nhập · 182.306đ" → "2 đơn nhập · 162.106đ" |
| `PO-064`, 12/08/2026 | `POL-cdfb13c4-3605-45a6-8ba0-9f0a6596e171` | Trứng gà | 60 trái | lowest since 12/08: 21 trái at 03/10/2026 22:32 (today 116) | refused: "…Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái…" |
| `PO-066`, 20/08/2026 | `POL-0086ff53-4002-49a9-a072-dd846e3f8bc9`; `POL-20f8abb7-5430-4de1-ab20-befe661b405c` | Sữa tươi Mlekovita; Đào ngâm Rich | 60.000 ml; 24 miếng | lowest 42.000 ml; lowest 0 miếng | refused, two sentences |
| `PO-063`, 03/08/2026, 736.000đ | — | — | — | before `STK-001` (confirmed 09/08/2026 22:02) | refused: "Phiếu ngày 03/08/2026 nằm trước lần kiểm kê STK-001 (09/08/2026)…" |
| `PO-161`, 10/08/2026 00:00 Saigon | — | — | — | 09/08 17:00 UTC, after `STK-001` as a moment | not refused by the stocktake |

Count: 199 orders; 151 before `STK-001`; of 48 after, 17 refused for stock; 31 cancellable, 3 with assets (`PO-147`, `PO-148`, `PO-149`).

Đã xem: spec; `app/admin/inventory/purchase-orders/actions.ts` (whole), `[id]/page.tsx`, `page.tsx`, `components/PurchaseOrdersClient.tsx` (status filter and badge), `components/PurchaseOrderForm.tsx` lines 68–128 (initial lines drop the line id); `lib/purchasing/purchase-order-list.ts`, `purchase-order-edit-gate.ts`, `purchase-order-transaction.ts`, `purchase-order-write-plan.ts` (line ids); `lib/stock/purchased-item-onhand.ts`; `lib/auth/auth.ts` (`requireAdmin`); `lib/shared/action-error.ts`; `app/admin/inventory/issue-slips/actions.ts` (`cancelIssueSlip` pattern); `app/admin/suppliers/[id]/page.tsx`, `components/SupplierDetailView.tsx` (badge); `app/admin/nav-allowlist.ts`; migrations `0106` (`issue_stock_headroom`, `issue_slip_stocktake_lock`), `0107` (live `save_purchase_order_atomic`), `0069` (`assets`, `trg_assets_touch`); `tests/migrations/cash-book-money-flow-migration.test.ts`. Columns from `information_schema` for `purchase_orders`, `purchase_order_lines`, `assets`, `asset_disposals`, `stocktake_sessions`, `purchased_items`, `units`. Chưa xem: `PurchasePaymentBlock.tsx` (read-only mode may need a prop), `lib/db/backup-restore.ts`, `types/db.ts` beyond `DBPurchaseOrder`, the costing engine's handling of an order that disappears (it reads `COMPLETED` only, per spec §2.5).

## Global Constraints

- Code and comments English; every on-screen word Vietnamese, exactly as in spec §6.
- Numbers in Vietnamese format: `new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 })` → "42.000", "0,5". Dates via `lib/shared/datetime.ts` (`formatDate`, `formatDateTime`) — Saigon, never `toLocaleString` without a zone.
- No row is ever deleted (data rules: orders are never deleted).
- No popup: the reason box is its own page (`BR-DATA-007`).
- A server page passes no function prop to a client component.
- Desktop and phone both usable (`.claude/rules/ui-devices.md`); the cancel page is one column on a phone, buttons full width.
- Roles: ADMIN and MANAGER cancel (`requireAdmin()` on the server); STAFF never sees the button.
- New tests are shown red on the code before the change (Opus runs this and says whether red is a wrong value or a missing function).

## Review Focus

1. **An order with two lines of the same item** — the below-zero check sums them per item (one sentence per item, quantity summed), and Task 1's id reuse matches them in order. Tests in Tasks 1 and 3.
2. **A draft** — "Huỷ phiếu" works with no stock, stocktake or asset check, and the draft never reappears in the default list. Tests in Tasks 2 (function text) and 4.
3. **The cancel page opened on an already-cancelled order, or the order cancelled by someone else while the page was open** — shows "Phiếu đã huỷ rồi.", keeps the typed reason, no second write. Tests in Tasks 3 and 4.
4. **Saving the form of an order that was cancelled in another tab** — refused with "Phiếu đã huỷ, không sửa được", no asset created, no edit-trail row. Test in Task 4.
5. **Before `0108` runs** — the cancel page says "Chưa cập nhật dữ liệu, chưa huỷ được phiếu." instead of the generic error; detail and list pages work. Test in Task 4.

---

### Task 1 (Sonnet): an edit keeps its line ids

**Files:**
- Modify: `lib/purchasing/purchase-order-write-plan.ts`
- Modify: `app/admin/inventory/purchase-orders/actions.ts` (`savePurchaseOrder`, the block that reads `existingLines`)
- Test: `lib/purchasing/purchase-order-write-plan.test.ts`, `app/admin/inventory/purchase-orders/actions.edit-trail.test.ts` (or a new `actions.line-ids.test.ts`)

**Interfaces:**
- Produces: `buildPurchaseOrderWritePlan(input: { …existing…, existingLines?: ReadonlyArray<{ id: string; purchased_item_id: string }> })`. For each submitted line, in submitted order, reuse the id of the first not-yet-used existing line with the same `purchased_item_id`; otherwise `POL-${idFactory()}`. Ids come only from the server's read of this order's lines, never from the browser.

- [ ] **Step 1: Write the failing tests**

```ts
it("reuses the saved line id of the same item on an edit", () => {
  const plan = buildPurchaseOrderWritePlan({
    ...baseInput,
    lines: [{ ...eggLine }, { ...milkLine }],
    existingLines: [
      { id: "POL-old-milk", purchased_item_id: milkLine.purchased_item_id },
      { id: "POL-old-egg", purchased_item_id: eggLine.purchased_item_id },
    ],
    idFactory: () => "new",
  });
  expect(plan.lines.map(l => l.id)).toEqual(["POL-old-egg", "POL-old-milk"]);
});

it("matches two lines of one item in order and mints an id for a third", () => {
  const plan = buildPurchaseOrderWritePlan({
    ...baseInput,
    lines: [{ ...eggLine }, { ...eggLine }, { ...eggLine }],
    existingLines: [
      { id: "POL-a", purchased_item_id: eggLine.purchased_item_id },
      { id: "POL-b", purchased_item_id: eggLine.purchased_item_id },
    ],
    idFactory: () => "new",
  });
  expect(plan.lines.map(l => l.id)).toEqual(["POL-a", "POL-b", "POL-new"]);
});

it("mints every id for a new order", () => {
  const plan = buildPurchaseOrderWritePlan({ ...baseInput, lines: [{ ...eggLine }], idFactory: () => "new" });
  expect(plan.lines[0].id).toBe("POL-new");
});
```

Action-level: saving an existing completed order whose stored line `POL-x` is Vòi rót rượu sends `POL-x` again to `savePurchaseOrderAtomic` (mock it, read `lines[0].id`).

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run lib/purchasing/purchase-order-write-plan.test.ts`: the first two fail on value (`POL-new` instead of the old id); the third passes (pin).
- [ ] **Step 3: Implement** — in the write plan, build `Map<item, string[]>` from `existingLines`, `shift()` per submitted line. In `savePurchaseOrder`, pass `existingLines: existingLines.filter(l => l.purchase_order_id === id)` (the array already read for `previousLineCount`; keep reading it with the same filter).
- [ ] **Step 4: Run, expect PASS**; also `npx vitest run app/admin/inventory/purchase-orders lib/purchasing`.
- [ ] **Step 5: Hand back to Opus** (no commit by Sonnet).

The database function deletes and re-inserts the lines in one transaction (`0107`), so reusing an id is safe: the old row is gone before the new one is inserted.

### Task 2 (Sonnet): migration `0108_purchase_order_cancel.sql`

**Files:**
- Create: `supabase/migrations/0108_purchase_order_cancel.sql`
- Create: `tests/migrations/purchase-order-cancel-migration.test.ts`
- Modify: `types/db.ts` (`DBPurchaseOrder`: `cancelled_at?`, `cancelled_by_id?`, `cancelled_by_name?`, `cancel_reason?`, all `string | null`)

**Interfaces:**
- Produces (SQL, `service_role` execute only, `public`/`anon`/`authenticated` revoked):
  - `purchase_order_cancel_check(p_id text) returns jsonb` → `{ "blocked": Blocker[], "assets": Asset[] }`, where Blocker is one of `{code:"NOT_FOUND"}`, `{code:"ALREADY_CANCELLED"}`, `{code:"STOCKTAKE", stocktake_id, confirmed_at, order_at}`, `{code:"NEGATIVE", item_id, item_name, low_balance, low_at, order_qty, base_unit}`, `{code:"DISPOSED", asset_id, name}`; Asset is `{id, name, quantity, total_cost}`.
  - `cancel_purchase_order_atomic(p_id text, p_reason text, p_actor_id text, p_actor_name text) returns jsonb` → `{cancelled:false, blocked:[…]}` or `{cancelled:true, retired_asset_ids:[…]}`.

Header comment must carry: spec and plan paths; triggers read from migration text (`purchase_orders`: `trg_purchase_orders_touch` (`0001`), `assets`: `trg_assets_touch` (`0069`), both BEFORE UPDATE `touch_updated_at()` — `updated_at` moves on the cancelled order and on each retired asset, nothing else); writer inventory for the new check (spec §3: `save_purchase_order_atomic` redefined here, `setPurchaseOrderPayment` touches two columns of a `COMPLETED` row only, the new cancel function, backup restore restores rows as they are); deploy order (code first; nothing breaks before this file runs).

- [ ] **Step 1: Write the failing migration-text test** (pattern of `tests/migrations/cash-book-money-flow-migration.test.ts`):

```ts
const raw = readFileSync(resolve(process.cwd(), "supabase/migrations/0108_purchase_order_cancel.sql"), "utf8");
const m = raw.toLowerCase();
// Body of one function, from its "create or replace function" to the closing delimiter.
function fnBody(name: string): string {
  const start = m.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const open = m.indexOf("$function$", start);
  const close = m.indexOf("$function$", open + 1);
  return m.slice(open, close);
}

it("adds the four cancel columns and ties CANCELLED to a reason", () => {
  for (const col of ["cancelled_at timestamptz", "cancelled_by_id text", "cancelled_by_name text", "cancel_reason text"]) {
    expect(m).toContain(`add column ${col}`);
  }
  expect(m).toContain("constraint purchase_orders_cancelled_has_reason check");
  expect(m).toMatch(/\(status = 'cancelled'\) = \(cancelled_at is not null and nullif\(btrim\(coalesce\(cancel_reason, ''\)\), ''\) is not null\)/);
});

it("save refuses a stored CANCELLED order and any status but DRAFT/COMPLETED", () => {
  expect(raw).toContain("Phiếu đã huỷ, không sửa được");
  expect(m).toMatch(/not in \('draft', 'completed'\)/);
});

it("check: stocktake lock as a moment, lowest balance since the order, disposals, non-inactive assets", () => {
  const check = fnBody("purchase_order_cancel_check");
  expect(check).toContain("public.issue_slip_stocktake_lock(v_at)");
  expect(check).toContain("coalesce(v_po.transaction_date, v_po.created_at)");
  expect(check).toContain("si.issued_at > v_at and si.base_quantity > 0");
  expect(check).toContain("order by item, balance asc, at asc");
  expect(check).toContain("from public.asset_disposals");
  expect(check).toContain("r.status <> 'inactive'");
  expect(check).not.toMatch(/::date/);
  expect(m).toMatch(/purchase_order_cancel_check\(p_id text\)\s+returns jsonb language plpgsql stable/);
});

it("cancel: same stock lock as the slip writers, row lock, reason limits, one transaction, no delete", () => {
  const cancel = fnBody("cancel_purchase_order_atomic");
  expect(cancel).toContain("pg_advisory_xact_lock(hashtext('stock_issues:id'))");
  expect(cancel).toMatch(/from public\.purchase_orders\s+where id = p_id\s+for update/);
  expect(cancel).toContain("lý do huỷ phiếu là bắt buộc");
  expect(cancel).toContain("lý do huỷ tối đa 500 ký tự");
  expect(cancel).toContain("char_length(v_reason) > 500");
  expect(cancel).toMatch(/update public\.assets\s+set status = 'inactive'/);
  expect(cancel).not.toContain("delete from");
  // The copied save function keeps its own delete-and-reinsert of lines; nothing else deletes.
  expect(fnBody("purchase_order_cancel_check")).not.toContain("delete from");
});

it("both new functions and the save are service_role only", () => {
  for (const sig of [
    "public.purchase_order_cancel_check(text)",
    "public.cancel_purchase_order_atomic(text, text, text, text)",
    "public.save_purchase_order_atomic(jsonb, jsonb, boolean)",
  ]) {
    expect(m).toContain(`revoke all on function ${sig} from public, anon, authenticated`);
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
  }
});
```

- [ ] **Step 2: Run, expect FAIL** (file missing).
- [ ] **Step 3: Write the migration.**

```sql
alter table public.purchase_orders
  add column cancelled_at timestamptz,
  add column cancelled_by_id text,
  add column cancelled_by_name text,
  add column cancel_reason text;

alter table public.purchase_orders
  add constraint purchase_orders_cancelled_has_reason check (
    (status = 'CANCELLED') = (cancelled_at is not null and nullif(btrim(coalesce(cancel_reason, '')), '') is not null)
  );
```

`save_purchase_order_atomic`: copy the `0107` body verbatim; add, before the `v_po_id` logic,
`if coalesce(nullif(p_order->>'status', ''), 'DRAFT') not in ('DRAFT', 'COMPLETED') then raise exception 'p_order.status must be DRAFT or COMPLETED'; end if;`
and in the replace branch read `status` with the row lock and refuse:

```sql
    select id, status into v_existing_id, v_existing_status
    from public.purchase_orders where id = v_po_id for update;
    if v_existing_id is null then
      raise exception 'Purchase order % does not exist', v_po_id;
    end if;
    if v_existing_status = 'CANCELLED' then
      raise exception 'Phiếu đã huỷ, không sửa được';
    end if;
```

Check function:

```sql
create or replace function public.purchase_order_cancel_check(p_id text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_po record;
  v_at timestamptz;
  v_lock text;
  v_blocked jsonb := '[]'::jsonb;
  v_assets jsonb := '[]'::jsonb;
  r record;
begin
  select id, status, transaction_date, created_at into v_po
  from public.purchase_orders where id = p_id;
  if not found then
    return jsonb_build_object('blocked', jsonb_build_array(jsonb_build_object('code', 'NOT_FOUND')), 'assets', '[]'::jsonb);
  end if;
  if v_po.status = 'CANCELLED' then
    return jsonb_build_object('blocked', jsonb_build_array(jsonb_build_object('code', 'ALREADY_CANCELLED')), 'assets', '[]'::jsonb);
  end if;
  if v_po.status <> 'COMPLETED' then
    -- A draft touched no stock, cost, money or asset.
    return jsonb_build_object('blocked', '[]'::jsonb, 'assets', '[]'::jsonb);
  end if;

  v_at := coalesce(v_po.transaction_date, v_po.created_at);

  v_lock := public.issue_slip_stocktake_lock(v_at);
  if v_lock is not null then
    v_blocked := v_blocked || jsonb_build_object(
      'code', 'STOCKTAKE', 'stocktake_id', v_lock,
      'confirmed_at', (select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock),
      'order_at', v_at);
  end if;

  -- Lowest balance of each item from the order's moment to now (formula of
  -- issue_stock_headroom, 0106), compared with what the order brought in.
  for r in
    with q as (
      select l.purchased_item_id as item, sum(l.base_quantity) as qty, min(l.base_unit) as base_unit
      from public.purchase_order_lines l where l.purchase_order_id = p_id
      group by l.purchased_item_id
    ), pts as (
      select q.item, v_at as at from q
      union
      select si.purchased_item_id, si.issued_at
      from public.stock_issues si join q on q.item = si.purchased_item_id
      where si.issued_at > v_at and si.base_quantity > 0
    ), bal as (
      select pts.item, pts.at,
        coalesce((select sum(pol.base_quantity) from public.purchase_order_lines pol
                  join public.purchase_orders po on po.id = pol.purchase_order_id
                  where po.status = 'COMPLETED' and pol.purchased_item_id = pts.item
                    and coalesce(po.transaction_date, po.created_at) <= pts.at), 0)
        - coalesce((select sum(si.base_quantity) from public.stock_issues si
                    where si.purchased_item_id = pts.item and si.issued_at <= pts.at), 0) as balance
      from pts
    ), low as (
      select distinct on (item) item, at, balance from bal order by item, balance asc, at asc
    )
    select low.item, pi.name, low.balance, low.at, q.qty, coalesce(u.name, q.base_unit, '') as unit
    from low
    join q on q.item = low.item
    join public.purchased_items pi on pi.id = low.item
    left join public.units u on u.id = q.base_unit
    where low.balance - q.qty < 0
    order by pi.name
  loop
    v_blocked := v_blocked || jsonb_build_object(
      'code', 'NEGATIVE', 'item_id', r.item, 'item_name', r.name,
      'low_balance', r.balance, 'low_at', r.at, 'order_qty', r.qty, 'base_unit', r.unit);
  end loop;

  for r in
    select a.id, a.name_snapshot, a.quantity, a.total_cost, a.status,
      exists (select 1 from public.asset_disposals d where d.asset_id = a.id) as disposed
    from public.assets a
    join public.purchase_order_lines l on l.id = a.purchase_order_line_id
    where l.purchase_order_id = p_id
    order by a.id
  loop
    if r.disposed then
      v_blocked := v_blocked || jsonb_build_object('code', 'DISPOSED', 'asset_id', r.id, 'name', r.name_snapshot);
    end if;
    if r.status <> 'INACTIVE' then
      v_assets := v_assets || jsonb_build_object('id', r.id, 'name', r.name_snapshot, 'quantity', r.quantity, 'total_cost', r.total_cost);
    end if;
  end loop;

  return jsonb_build_object('blocked', v_blocked, 'assets', v_assets);
end
$function$;
```

Cancel function:

```sql
create or replace function public.cancel_purchase_order_atomic(p_id text, p_reason text, p_actor_id text, p_actor_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_check jsonb;
  v_asset_ids text[];
begin
  if nullif(btrim(coalesce(p_actor_id, '')), '') is null then raise exception 'p_actor_id is required'; end if;
  if nullif(btrim(coalesce(p_actor_name, '')), '') is null then raise exception 'p_actor_name is required'; end if;
  if v_reason = '' then raise exception 'Lý do huỷ phiếu là bắt buộc'; end if;
  if char_length(v_reason) > 500 then raise exception 'Lý do huỷ tối đa 500 ký tự'; end if;

  -- Same lock as every stock writer (issue slips, stocktake): a slip saved at
  -- the same instant waits, so the below-zero check reads settled stock.
  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform 1 from public.purchase_orders
  where id = p_id
  for update;

  v_check := public.purchase_order_cancel_check(p_id);
  if jsonb_array_length(v_check->'blocked') > 0 then
    return jsonb_build_object('cancelled', false, 'blocked', v_check->'blocked');
  end if;

  select coalesce(array_agg(a->>'id'), '{}') into v_asset_ids
  from jsonb_array_elements(v_check->'assets') a;

  update public.purchase_orders
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by_id = p_actor_id,
      cancelled_by_name = p_actor_name, cancel_reason = v_reason
  where id = p_id;

  update public.assets
  set status = 'INACTIVE'
  where id = any(v_asset_ids);

  return jsonb_build_object('cancelled', true, 'retired_asset_ids', to_jsonb(v_asset_ids));
end
$function$;
```

Grants as in the test, one `revoke all … from public, anon, authenticated` and one `grant execute … to service_role` line per function. Keep the `$function$` delimiters: the test finds each body by them.

- [ ] **Step 4: Run, expect PASS** — `npx vitest run tests/migrations`.
- [ ] **Step 5: Hand back to Opus.** Opus then runs the `bal`/`low` query inline, read-only, against the live database for `PO-147`, `PO-064`, `PO-066` (substituting `p_id` and `v_at`) and compares with the worked example before review.

### Task 3 (Sonnet): pure module — parse, sentences, reason

**Files:**
- Create: `lib/purchasing/purchase-order-cancel.ts`
- Test: `lib/purchasing/purchase-order-cancel.test.ts`

**Interfaces:**
- Produces:

```ts
export const CANCEL_REASON_MAX = 500;
export type CancelBlocker =
  | { code: "NOT_FOUND" }
  | { code: "ALREADY_CANCELLED" }
  | { code: "STOCKTAKE"; stocktakeId: string; confirmedAt: string; orderAt: string }
  | { code: "NEGATIVE"; itemId: string; itemName: string; lowBalance: number; lowAt: string; orderQty: number; baseUnit: string }
  | { code: "DISPOSED"; assetId: string; name: string };
export type CancelAsset = { id: string; name: string; quantity: number; totalCost: number };
export type CancelCheck = { blocked: CancelBlocker[]; assets: CancelAsset[] };
export type CancelOutcome = { cancelled: true; retiredAssetIds: string[] } | { cancelled: false; blocked: CancelBlocker[] };

export function parseCancelCheck(raw: unknown): CancelCheck;      // throws on a shape it does not know
export function parseCancelOutcome(raw: unknown): CancelOutcome;
export function describeCancelBlocker(b: CancelBlocker): string;
export function validateCancelReason(input: string): { ok: true; value: string } | { ok: false; error: string };
```

Sentences (spec §6, exact):
- `NOT_FOUND` → "Không tìm thấy phiếu nhập."
- `ALREADY_CANCELLED` → "Phiếu đã huỷ rồi."
- `STOCKTAKE` → `Phiếu ngày ${formatDate(orderAt)} nằm trước lần kiểm kê ${stocktakeId} (${formatDate(confirmedAt)}), nên không huỷ được: lần kiểm kê đã đếm lại hàng trên kệ.`
- `NEGATIVE` → `Huỷ phiếu này làm tồn kho âm: ${itemName} lúc thấp nhất (${formatDateTime(lowAt)}) chỉ còn ${qty(lowBalance)} ${baseUnit}, phiếu có ${qty(orderQty)} ${baseUnit}. Hàng của phiếu đã được dùng, nên phiếu này là thật.`
- `DISPOSED` → `Tài sản ${assetId} ${name} của phiếu đã thanh lý, nên không huỷ được phiếu.`

`qty` = `new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format`. Numeric fields arrive from Postgres JSON as numbers or numeric strings: `Number(...)`, refuse `NaN`.

- [ ] **Step 1: Failing tests** with the worked example's real values:

```ts
expect(describeCancelBlocker({ code: "NEGATIVE", itemId: "x", itemName: "Trứng gà", lowBalance: 21,
  lowAt: "2026-10-03T15:32:00Z", orderQty: 60, baseUnit: "trái" }))
  .toBe("Huỷ phiếu này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái. Hàng của phiếu đã được dùng, nên phiếu này là thật.");
expect(describeCancelBlocker({ code: "NEGATIVE", itemId: "y", itemName: "Sữa tươi Mlekovita", lowBalance: 42000,
  lowAt: "2026-10-05T08:42:00Z", orderQty: 60000, baseUnit: "ml" })).toContain("chỉ còn 42.000 ml, phiếu có 60.000 ml");
expect(describeCancelBlocker({ code: "STOCKTAKE", stocktakeId: "STK-001",
  confirmedAt: "2026-08-09T15:02:00Z", orderAt: "2026-08-02T17:00:00Z" }))
  .toBe("Phiếu ngày 03/08/2026 nằm trước lần kiểm kê STK-001 (09/08/2026), nên không huỷ được: lần kiểm kê đã đếm lại hàng trên kệ.");
expect(validateCancelReason("   ")).toEqual({ ok: false, error: "Lý do huỷ phiếu là bắt buộc" });
expect(validateCancelReason("a".repeat(501))).toEqual({ ok: false, error: "Lý do huỷ tối đa 500 ký tự" });
expect(validateCancelReason(` ${"a".repeat(500)} `)).toEqual({ ok: true, value: "a".repeat(500) });
expect(parseCancelCheck({ blocked: [{ code: "NEGATIVE", item_id: "x", item_name: "Trứng gà", low_balance: "21.000000",
  low_at: "2026-10-03T15:32:00+00:00", order_qty: "60.000000", base_unit: "trái" }], assets: [] }).blocked[0])
  .toMatchObject({ code: "NEGATIVE", lowBalance: 21, orderQty: 60 });
expect(() => parseCancelCheck({ blocked: [{ code: "WHAT" }], assets: [] })).toThrow();
```

Plus: `parseCancelCheck` maps `assets` (`TS-080`, "Vòi rót rượu", 2, 20200); `parseCancelOutcome` both shapes.
- [ ] **Step 2: Run, expect FAIL** (module missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS** — also run under `TZ=UTC` (bash) so the 22:32 is proven to be Saigon time, not the machine's.
- [ ] **Step 5: Hand back to Opus.**

### Task 4 (Sonnet): server actions, save refusal, list filter

**Files:**
- Create: `lib/purchasing/purchase-order-cancel-transaction.ts` (RPC wrappers)
- Modify: `app/admin/inventory/purchase-orders/actions.ts`
- Modify: `lib/purchasing/purchase-order-list.ts`
- Modify: `app/admin/suppliers/[id]/page.tsx` (pass `status: "ALL"`)
- Test: `app/admin/inventory/purchase-orders/actions.cancel.test.ts`, `lib/purchasing/purchase-order-list.test.ts`, `app/admin/inventory/purchase-orders/actions.test.ts` (save refusal)

**Interfaces:**
- Consumes: Task 3's types and functions; Task 2's two RPC names and argument names.
- Produces:

```ts
// lib/purchasing/purchase-order-cancel-transaction.ts
export class CancelFunctionMissingError extends Error {}
export async function fetchPurchaseOrderCancelCheck(id: string): Promise<CancelCheck>;   // rpc("purchase_order_cancel_check", { p_id })
export async function cancelPurchaseOrderAtomic(input: { id: string; reason: string; actorId: string; actorName: string }): Promise<CancelOutcome>;
// Both throw CancelFunctionMissingError when PostgREST answers that the function does not exist
// (error.code === "PGRST202" or /could not find the function/i), any other error as Error(`<rpc>: <message>`).

// app/admin/inventory/purchase-orders/actions.ts
export type PurchaseOrderCancelView =
  | { state: "missing-migration" }
  | { state: "not-found" }
  | { state: "ready"; order: { id: string; dateText: string; supplierName: string; totalAmount: number; paymentLabel: string; status: string };
      blockedMessages: string[]; assets: CancelAsset[] };
export async function getPurchaseOrderCancelView(id: string): Promise<PurchaseOrderCancelView>;
export async function cancelPurchaseOrder(input: { id: string; reason: string }): Promise<ActionResponse>;
```

`cancelPurchaseOrder`: `requireAdmin()` (STAFF → its existing message); `validateCancelReason`; RPC; `{cancelled:false}` → `fail(blocked.map(describeCancelBlocker).join("\n"))`; missing function → `fail("Chưa cập nhật dữ liệu, chưa huỷ được phiếu.")`; success → `revalidateTag("sheets-Purchase_Orders")`, `revalidatePath` of the list, the order, `/admin/inventory/assets`, `/admin/finance`, `/admin/reports/pnl`, then `ok({ retiredAssetIds })`. `getPurchaseOrderCancelView`: `requireAdmin()`; reads the order with `findById` (not found → `not-found`); calls the check (missing → `missing-migration`); order header fields formatted as the list does.

`savePurchaseOrder`: right after reading `previousPo`, `if (previousPo?.status === "CANCELLED") return fail("Phiếu đã huỷ, không sửa được");` — before any write, asset creation or trail row. Works without `0108`.

List: `filters.status` — `"ALL"` → no status filter; `"DRAFT" | "COMPLETED" | "CANCELLED"` → that status; anything else, missing included → `ACTIVE` (status ≠ `CANCELLED`).

- [ ] **Step 1: Failing tests:**
  - STAFF → refused, RPC never called; `"   "` and 501 characters → the two messages, RPC never called; actor name passed is `auth.actor.name`, not anything from the input.
  - RPC returns `{cancelled:false, blocked:[NEGATIVE Trứng gà…]}` → the error is the Trứng gà sentence.
  - RPC error `{ code: "PGRST202", message: "Could not find the function public.cancel_purchase_order_atomic…" }` → "Chưa cập nhật dữ liệu, chưa huỷ được phiếu."; same error on the check → view `missing-migration`.
  - Save over a stored `CANCELLED` order → the message; `savePurchaseOrderAtomic`, `insert("assets", …)` and `insert("purchase_order_edits", …)` never called.
  - List: default hides a `CANCELLED` order; `status: "CANCELLED"` shows only it; `"ALL"` shows all three states; unknown `"XYZ"` behaves as default.
  - Supplier page passes `status: "ALL"` (spy on `getPurchaseOrdersPage`).
- [ ] **Step 2: Run, expect FAIL** — missing functions for the cancel actions; wrong value for the list default (today shows `CANCELLED`) and the save (today proceeds to the RPC).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS** — `npx vitest run app/admin/inventory/purchase-orders app/admin/suppliers lib/purchasing`.
- [ ] **Step 5: Hand back to Opus.**

### Task 5 (Sonnet): read-only check script for after the release

**Files:**
- Create: `scripts/check-purchase-order-cancel.ts`
- Test: `scripts/check-purchase-order-cancel.test.ts` (argument parsing and output only, RPC mocked)

**Interfaces:**
- Consumes: `fetchPurchaseOrderCancelCheck`, `describeCancelBlocker`.
- Produces: `npx vite-node scripts/check-purchase-order-cancel.ts PO-147 PO-064 PO-066` prints, per order, "huỷ được" plus the assets it would retire, or each refusal sentence. Never writes; no `--apply` flag exists. Uses the service-role client the other `verify-*` scripts use (it is the only role allowed to execute the check).

- [ ] Steps as above: failing test (module missing) → implement → pass → hand back.

### Task 6 (Gemini via `agy`): screens

Brief written by Opus with the Write tool; says "no shell commands"; lists the exact files and the props from Task 4. Run: `agy --model <newest-high> --mode accept-edits -p "$(cat brief)"`.

**Files:**
- Create: `app/admin/inventory/purchase-orders/[id]/cancel/page.tsx`, `…/cancel/components/CancelPurchaseOrderForm.tsx`, their tests
- Modify: `app/admin/inventory/purchase-orders/[id]/page.tsx` (+ `page.test.tsx`), `components/PurchaseOrdersClient.tsx` (+ test), `app/admin/suppliers/[id]/components/SupplierDetailView.tsx` (+ test), `[id]/components/PurchasePaymentBlock.tsx` only if a read-only mode is needed, `app/admin/nav-allowlist.ts` (`/admin/inventory/purchase-orders/[id]/cancel`, reason "reached from the purchase-order detail page — legitimately unlinked")

Behaviour (spec §5):
- Detail: "Huỷ phiếu" (danger outline) for ADMIN/MANAGER when status is `DRAFT` or `COMPLETED`, linking to `…/[id]/cancel?returnTo=<this page>`; on `CANCELLED`: badge "Đã huỷ" (muted), block "Lý do huỷ: {reason} · Huỷ bởi {name} lúc {formatDateTimeFull(cancelled_at)}", no "Sửa phiếu", no "Huỷ phiếu", "Trả bằng" shown without its save; a cancelled order never opens the form, even with `?edit=1` or as a draft-like state.
- Cancel page (server component calls `getPurchaseOrderCancelView`; STAFF redirected to the detail page): header code, date, supplier, total, Trả bằng. `missing-migration` → "Chưa cập nhật dữ liệu, chưa huỷ được phiếu." and "Quay lại". `blockedMessages` non-empty → one paragraph each, no box, only "Quay lại". Otherwise: "Phiếu sẽ không còn tính vào tồn kho, giá vốn, lãi lỗ và sổ thu chi từ ngày {date}."; if assets, "Các tài sản sau sẽ ngừng, khấu hao đã tính cho các tháng trước được gỡ ra:" and one line each (code, name, quantity, `formatNumber(totalCost)`đ); textarea "Lý do huỷ (bắt buộc)" with `maxLength={500}` and a counter; "Xác nhận huỷ" disabled while trimmed text is empty; on refusal the message shows above the box and the text stays; on success `router.push` to the detail page.
- List: options Chưa huỷ (`ACTIVE`, default, also the reset value) / Nháp / Hoàn thành / Đã huỷ / Tất cả (`ALL`); badge "Đã huỷ" muted; desktop and phone cards both.
- Supplier detail: badge "Đã huỷ".
- Phone: cancel page one column, buttons full width.

Tests: detail (cancelled shows reason, no edit, no "Huỷ phiếu"; STAFF no "Huỷ phiếu"; MANAGER sees it on a draft); cancel form (blocked → messages and no textbox; assets listed with `TS-080`; button disabled for blank, enabled after typing; refusal keeps text); list (default value `ACTIVE`, "Đã huỷ" option, badge); supplier badge.

### Task 7 (Opus): verify, docs, release

- [ ] Prove every new test red on the old code (stash the implementation, run, note wrong value vs missing function), then green.
- [ ] Run the check query inline (read-only) for `PO-147`, `PO-064`, `PO-066`, `PO-063`, `PO-161`; compare with the worked example.
- [ ] Review Sonnet's and Gemini's diffs against this plan and the spec; open the cancel page on the dev server for `PO-064` (refused) and `PO-147` (form shown) **without pressing "Xác nhận huỷ"** — real data.
- [ ] Docs: `docs/03-workflows/purchasing.md` (cancel flow, roles, refusals), `docs/01-system/TABLE-DICTIONARY.md` (four columns), `BR-INV-015` status → built, regenerate the system map if the docs check asks.
- [ ] Five gates (`tsc`, `vitest`, rules check, docs check, `npm run build` in a throwaway worktree).
- [ ] Commit. Then ask the owner, separately: push; then run `0108`. After `0108`: `npx vite-node scripts/check-purchase-order-cancel.ts PO-147 PO-064 PO-066` reproduces the worked example before anyone cancels anything.
