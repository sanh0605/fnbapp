# Sửa phiếu kiểm kê đã xác nhận — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can open the most recent confirmed stocktake, change counted quantities, and the shortfall/found rows move on the count's own date.

**Architecture:** One new Postgres function `edit_confirmed_stocktake_atomic` rewrites `stocktake_lines.counted_qty` and the session's `stock_issues` rows in one transaction; cost of goods is recomputed from `stock_issues` on every report load, so nothing else is recalculated. Two new screens: a read-only stocktake page and an owner-only edit page.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres (plpgsql), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-sua-phieu-kiem-ke-design.md` (rule `BR-INV-012`).

## Hiện trạng

Đã xem: `supabase/migrations/0089_delete_tier2_groups_stocktake_fix.sql` (apply), `0082_retire_ledger_reverse_stocktake.sql` (reverse), `lib/stock/stocktake-transaction.ts` (danh sách hàm), `app/admin/inventory/stocktake/actions.ts`, `page.tsx`, `components/StocktakeLineCards.tsx` (dòng 16–60, 136–160), `components/StocktakeSessionPanels.tsx` (tên hàm), `lib/stock/issue-slip-list.ts` (dòng 70–82), `lib/costing/unit-cost-at.ts`, `lib/costing/issue-costing.ts` (dòng 300–340), `lib/auth/auth.ts` (requireAdmin, requireOwner). Chưa xem: `ActiveSessionView.tsx`, `StocktakeClient.test.tsx`, `lib/stock/stocktake-package-lines.ts`, `lib/auth/delete-guard.test.ts` ngoài 17 dòng đầu.

1. **Trạng thái.** Phiếu kiểm kê có `OPEN` (đang đếm), `CONFIRMED` (đã xác nhận, đặt bởi `apply_stocktake_session_atomic`), `REVERSED` (đã huỷ, đặt bởi `reverse_stocktake_session_atomic`). Việc sửa không thêm trạng thái: phiếu vẫn `CONFIRMED`. Trên trang phiếu, việc sửa có một "lý do không sửa được" (`editBlock`), tính lúc mở trang: `NOT_OWNER`, `NOT_CONFIRMED`, `NOT_LATEST`, `OPEN_SESSION`, hoặc không có (sửa được).
2. **Nút.** Trang phiếu: "Sửa" chỉ hiện khi `editBlock === null`. Chủ quán gặp `NOT_CONFIRMED`/`NOT_LATEST`/`OPEN_SESSION` thấy dòng chữ xám thay cho nút; người không phải chủ quán không thấy gì. Trang sửa: "Lưu" (bấm một lần, quay vòng khi đang lưu, `BR-UI` nút lưu) và "Bỏ" (về trang phiếu). Trang Kiểm kê: thêm liên kết "Xem phiếu" trên khung phiếu gần nhất.
3. **Danh sách.** Trang phiếu và trang sửa liệt kê mọi dòng của phiếu, xếp theo tên hàng (tiếng Việt). Không loại dòng nào. Trang sửa chỉ gửi dòng có số khác số cũ.
4. **Ô nhập.** Mỗi dòng một `NumberInput`, `decimals={3}`, `min={0}`, `required`, đơn vị gốc của hàng. Âm hoặc trống: ô tự báo lỗi, không gửi. Máy chủ chặn lần nữa: số không phải số, số âm, dòng không thuộc phiếu, dòng không phải hàng mua.
5. **Dữ liệu phục vụ.** Phiếu `CONFIRMED` và `REVERSED` (xem). Chỉ phiếu `CONFIRMED` mới nhất khi không có phiếu `OPEN` (sửa). Cố ý không phục vụ: phiếu `OPEN` (trang phiếu chuyển về `/admin/inventory/stocktake`), dòng không phải `PURCHASED_ITEM` (0 dòng trên máy chủ, đo 2026-10-14).

Câu hỏi riêng cho việc này:

6. **Sửa xong, sổ hôm nay đổi bao nhiêu?** Đúng bằng hiệu số đếm mới − cũ, vì sổ = mua − xuất và chỉ dòng xuất của phiếu đổi.
7. **Phiếu kiểm kê mới mở sau khi sửa có đúng không?** Có: phiếu mới chụp sổ lúc mở, sau khi sửa. Sửa trong lúc có phiếu mở bị chặn (`OPEN_SESSION`) vì sổ phiếu đó đã chụp.
8. **Huỷ phiếu sau khi sửa?** Hàm huỷ đảo dấu mọi dòng xuất đang có của phiếu — tức bản đã sửa — nên huỷ vẫn đưa sổ về như chưa kiểm.

## Ví dụ tính sẵn (số thật, đo 2026-10-14)

Phiếu STK-001, xác nhận `2026-08-09T15:02:24.914754+00:00` (22:02 giờ Việt Nam), 50 dòng.

| Thao tác | Trước | Sau |
|---|---|---|
| SKL-00004 Bột cà phê truyền thống Phin Đậm: 4.000 → 5.000 | ISS-00004 `base_quantity` 2000 | ISS-00004 `base_quantity` 1000, `issued_at` không đổi |
| SKL-00007 Bột milkfoam muối biển: 2.000 → 1.500 | không có dòng xuất | dòng mới `ISS-<max+1>`, 500, `issued_at` = 2026-08-09T15:02:24.914754Z, `source` STOCKTAKE, `session_id` STK-001 |
| SKL-00004: 4.000 → 6.000 | ISS-00004 2000 | ISS-00004 không còn |

Giá vốn Bột cà phê Phin Đậm cho trường hợp 1, tính bằng `computePeriodIssuedValue` trên dữ liệu thật: tháng 8 592.067 → 444.050 (−148.017), tháng 9 +340, tháng 10 +131.

## Global Constraints

- Code và chú thích tiếng Anh; chữ hiển thị tiếng Việt.
- Ghi hai bảng trở lên chạy trong một hàm Postgres gọi qua rpc.
- Chỉ vai `ADMIN` sửa, chặn ở máy chủ bằng `requireOwner()`, không phải giấu nút.
- Không cửa sổ bật lên ở trang quản trị (`BR-DATA-007`): ô nhập là trang riêng.
- Máy tính và điện thoại hai bố cục riêng: máy tính bảng, điện thoại thẻ (`.claude/rules/ui-devices.md`).
- Ô số dùng `NumberInput`; nút dùng `Button` (phép kiểm `components/ui/template.guard.test.ts`).
- Migration lên máy chủ phải chủ quán duyệt riêng; code đọc hàm mới lên cùng lúc.

## Review Focus

1. Hai tab cùng sửa một phiếu: lần lưu sau ghi đè lần trước, không nhân đôi dòng xuất — hàm khoá phiếu `for update` và tìm dòng xuất theo (phiếu, hàng), không thêm mù. Test: sửa cùng dòng hai lần liên tiếp chỉ còn một dòng xuất (Task 1, test chữ migration kiểm `for update` và kiểm tồn tại trước khi insert).
2. Số đếm sửa về đúng bằng sổ: dòng xuất bị bỏ, không để dòng 0 (Task 1).
3. Phiếu đã huỷ hoặc không phải mới nhất bị gọi thẳng hàm: hàm từ chối bằng tiếng Việt (Task 1, Task 2).
4. Người quản lý (`MANAGER`) gọi thẳng action sửa: bị từ chối, không ghi gì (Task 2).
5. Sửa số mà không đổi gì (gửi đúng số cũ): không ghi, `changedCount` 0 (Task 1).

---

### Task 1: Hàm Postgres và lớp gọi (Sonnet)

**Files:**
- Create: `supabase/migrations/0110_edit_confirmed_stocktake.sql`
- Create: `tests/migrations/stocktake-edit-migration.test.ts`
- Modify: `lib/stock/stocktake-transaction.ts` (thêm `editConfirmedStocktakeAtomic`)
- Test: the existing test file next to `lib/stock/stocktake-transaction.ts` if one exists, otherwise `lib/stock/stocktake-transaction.edit.test.ts`

**Interfaces:**
- Produces: `editConfirmedStocktakeAtomic(input: { sessionId: string; lines: Array<{ lineId: string; countedQty: number }> }): Promise<{ sessionId: string; changedCount: number; issueIds: string[] }>`; rpc `edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb) returns jsonb` with keys `session_id`, `changed_count`, `issue_ids`.

- [ ] **Step 1: Write the failing migration-text test** in `tests/migrations/stocktake-edit-migration.test.ts`, following `tests/migrations/stocktake-apply-migration.test.ts`'s style (read the SQL file as text). Assert, each as its own `it`:
  - defines `public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)`, `security definer`, `set search_path to 'public'`;
  - locks the session row `for update` and raises unless `status = 'CONFIRMED'`;
  - raises when any `stocktake_sessions` row has `status = 'OPEN'`;
  - raises unless the session is the latest `CONFIRMED` by `confirmed_at desc`;
  - takes `pg_advisory_xact_lock(hashtext('stock_issues:id'))` before numbering `ISS-`;
  - inserts new rows with `issued_at` = the session's `confirmed_at` (not `now()`), `source` `'STOCKTAKE'`;
  - updates an existing row's `base_quantity` to `-v_variance`; deletes it when the variance is 0;
  - skips a line whose `counted_qty is not distinct from` the new value;
  - revokes from `public`, `anon`, `authenticated`; grants execute to `service_role`;
  - error texts are Vietnamese (match the strings in Step 3).

- [ ] **Step 2: Run it, expect FAIL** (file missing): `npx vitest run tests/migrations/stocktake-edit-migration.test.ts`

- [ ] **Step 3: Write the migration**

```sql
-- BR-INV-012 (owner 2026-09-28 1b/2a, 2026-10-14 Q4 "a", "1a 2b 3b"):
-- the owner edits counted quantities of the most recent confirmed stocktake;
-- the session's stock_issues rows move in place, dated the confirmation
-- instant, so the change lands on the count's own date. No reason, no
-- history (owner: added when someone else takes over editing).
create or replace function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_status text;
  v_confirmed_at timestamptz;
  v_latest_id text;
  v_next_issue_number integer;
  v_entry jsonb;
  v_line_id text;
  v_line record;
  v_new_qty numeric(18,6);
  v_variance numeric(18,6);
  v_existing_issue_id text;
  v_existing_count integer;
  v_issue_id text;
  v_note text;
  v_changed integer := 0;
  v_issue_ids jsonb := '[]'::jsonb;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Không có dòng nào để sửa';
  end if;

  select status, confirmed_at into v_status, v_confirmed_at
  from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê %', v_session_id; end if;
  if v_status <> 'CONFIRMED' then
    raise exception 'Phiếu kiểm kê % không ở trạng thái đã xác nhận, không sửa được', v_session_id;
  end if;
  if exists (select 1 from public.stocktake_sessions where status = 'OPEN') then
    raise exception 'Đang có một phiếu kiểm kê mở -- xong phiếu đó rồi mới sửa được phiếu cũ';
  end if;
  select id into v_latest_id from public.stocktake_sessions
  where status = 'CONFIRMED' order by confirmed_at desc limit 1;
  if v_latest_id <> v_session_id then
    raise exception 'Chỉ sửa được phiếu kiểm kê mới nhất (%), không phải %', v_latest_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number from public.stock_issues where id ~ '^ISS-[0-9]+$';

  -- Same note texts as apply_stocktake_session_atomic, dated the count.
  for v_entry in select value from jsonb_array_elements(p_lines) loop
    v_line_id := nullif(btrim(coalesce(v_entry->>'line_id', '')), '');
    if jsonb_typeof(v_entry->'counted_qty') is distinct from 'number' then
      raise exception 'Số đếm của dòng % phải là một số', coalesce(v_line_id, '?');
    end if;
    v_new_qty := (v_entry->>'counted_qty')::numeric;
    if v_new_qty < 0 then raise exception 'Số đếm của dòng % không được âm', v_line_id; end if;

    select id, item_reference, item_type, counted_qty, theoretical_at_count into v_line
    from public.stocktake_lines where id = v_line_id and session_id = v_session_id for update;
    if not found then raise exception 'Dòng % không thuộc phiếu %', coalesce(v_line_id, '?'), v_session_id; end if;
    if v_line.item_type <> 'PURCHASED_ITEM' then
      raise exception 'Dòng % không phải hàng mua, không sửa được', v_line_id;
    end if;
    if v_line.theoretical_at_count is null then
      raise exception 'Dòng % không có số sổ lúc đếm', v_line_id;
    end if;
    if v_line.counted_qty is not distinct from v_new_qty then continue; end if;

    update public.stocktake_lines set counted_qty = v_new_qty where id = v_line_id;
    v_changed := v_changed + 1;
    v_variance := v_new_qty - v_line.theoretical_at_count;

    select count(*), min(id) into v_existing_count, v_existing_issue_id
    from public.stock_issues
    where session_id = v_session_id and purchased_item_id = v_line.item_reference and reverses_issue_id is null;
    if v_existing_count > 1 then
      raise exception 'Phiếu % có % dòng xuất cho cùng một hàng, cần kiểm tay', v_session_id, v_existing_count;
    end if;

    if v_variance > 0 then
      v_note := 'Hàng tìm lại được (BR-INV-008) -- kiểm kê định kỳ ' ||
        to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    else
      v_note := 'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    end if;

    if v_variance = 0 then
      if v_existing_issue_id is not null then
        delete from public.stock_issues where id = v_existing_issue_id;
      end if;
    elsif v_existing_issue_id is not null then
      update public.stock_issues set base_quantity = -v_variance, note = v_note where id = v_existing_issue_id;
      v_issue_ids := v_issue_ids || jsonb_build_array(v_existing_issue_id);
    else
      v_next_issue_number := v_next_issue_number + 1;
      v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
      insert into public.stock_issues (id, purchased_item_id, issued_at, base_quantity, source, session_id, note)
      values (v_issue_id, v_line.item_reference, v_confirmed_at, -v_variance, 'STOCKTAKE', v_session_id, v_note);
      v_issue_ids := v_issue_ids || jsonb_build_array(v_issue_id);
    end if;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'changed_count', v_changed, 'issue_ids', v_issue_ids);
end;
$$;

revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from public;
revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from anon;
revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from authenticated;
grant execute on function public.edit_confirmed_stocktake_atomic(text, jsonb) to service_role;
```

- [ ] **Step 4: Run the migration test, expect PASS.**

- [ ] **Step 5: Wrapper, test first.** Test (mock `getSupabaseClient().rpc` the way the existing stocktake-transaction tests do): calls `rpc("edit_confirmed_stocktake_atomic", { p_session_id: "STK-001", p_lines: [{ line_id: "SKL-00004", counted_qty: 5000 }] })` and maps `{ session_id, changed_count, issue_ids }` to `{ sessionId, changedCount, issueIds }`; an rpc error throws with the database message unchanged. Run, expect FAIL (no export). Then:

```ts
// BR-INV-012: owner edits the most recent confirmed stocktake; the change
// lands on the count's own date (see 0110_edit_confirmed_stocktake.sql).
export async function editConfirmedStocktakeAtomic(input: {
  sessionId: string;
  lines: Array<{ lineId: string; countedQty: number }>;
}): Promise<{ sessionId: string; changedCount: number; issueIds: string[] }> {
  const { data, error } = await getSupabaseClient().rpc("edit_confirmed_stocktake_atomic", {
    p_session_id: input.sessionId,
    p_lines: input.lines.map(l => ({ line_id: l.lineId, counted_qty: l.countedQty })),
  });
  if (error) throw new Error(error.message);
  const result = data as { session_id: string; changed_count: number; issue_ids: string[] };
  return { sessionId: result.session_id, changedCount: Number(result.changed_count), issueIds: result.issue_ids ?? [] };
}
```

Match the error handling the other wrappers in the file use if it differs from `throw new Error(error.message)`.

- [ ] **Step 6: Run both tests and `npx tsc --noEmit`, expect PASS. Do not commit; Opus commits.**

### Task 2: Server actions and the issue-slip link (Sonnet)

**Files:**
- Modify: `app/admin/inventory/stocktake/actions.ts`
- Modify: `app/admin/inventory/stocktake/actions.test.ts` (replace the `it.todo` in "editing a confirmed stocktake (BR-INV-012)" with real tests)
- Modify: `lib/stock/issue-slip-list.ts:77` and its test

**Interfaces:**
- Consumes: `editConfirmedStocktakeAtomic` (Task 1).
- Produces:

```ts
export type StocktakeEditBlock = "NOT_OWNER" | "NOT_CONFIRMED" | "NOT_LATEST" | "OPEN_SESSION";
export interface StocktakeDetailLine {
  id: string; itemReference: string; itemName: string; unitName: string;
  countedQty: number | null; theoreticalAtCount: number | null;
}
export interface StocktakeDetailView {
  id: string;
  status: "OPEN" | "CONFIRMED" | "REVERSED"; // the page redirects OPEN to /admin/inventory/stocktake
  createdByName: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  reversedAt: string | null;
  notes: string;
  lines: StocktakeDetailLine[]; // sorted by itemName, "vi"
  editBlock: StocktakeEditBlock | null;
}
// null only when the id is unknown. An OPEN session comes back with editBlock "NOT_CONFIRMED".
export async function getStocktakeDetail(id: string): Promise<StocktakeDetailView | null>;
// requireOwner(); lines with unchanged numbers may be sent, the database skips them.
export async function editConfirmedStocktake(
  sessionId: string,
  lines: Array<{ lineId: string; countedQty: number }>,
): Promise<ActionResponse & { changedCount?: number }>;
```

- [ ] **Step 1: Failing tests** in `actions.test.ts`, mocking `@/lib/db/tables`, `@/lib/auth/auth` and `@/lib/stock/stocktake-transaction` the way the file already does:
  - `getStocktakeDetail("STK-001")` with sessions `[STK-001 CONFIRMED]`, an ADMIN actor → `editBlock: null`, lines named "Bột cà phê truyền thống Phin Đậm" sorted by name;
  - same with a MANAGER actor → `editBlock: "NOT_OWNER"`;
  - ADMIN, STK-001 CONFIRMED plus STK-002 CONFIRMED with a later `confirmed_at` → STK-001 `NOT_LATEST`;
  - ADMIN, plus an OPEN session → `OPEN_SESSION`; ADMIN, STK-001 REVERSED → `NOT_CONFIRMED`; order of checks: owner, confirmed, latest, open;
  - unknown id → `null`; an OPEN session → `status: "OPEN"`, `editBlock: "NOT_CONFIRMED"` (ADMIN);
  - `editConfirmedStocktake` as MANAGER → `{ error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" }` and the wrapper never called;
  - as ADMIN → wrapper called with `{ sessionId: "STK-001", lines: [{ lineId: "SKL-00004", countedQty: 5000 }] }`, returns `changedCount`, revalidates `/admin/inventory/stocktake`, `/admin/inventory/stocktake/STK-001` and `/admin/inventory/issue-slips`;
  - a negative or non-finite `countedQty`, or an empty `lines` → Vietnamese error, wrapper not called;
  - a wrapper throw → the database message returned through the file's existing `describeActionError`.
  - `lib/stock/issue-slip-list.ts` test: the STOCKTAKE row's `href` is `/admin/inventory/stocktake/STK-001`.
- [ ] **Step 2: Run, expect FAIL** (missing exports; old href).
- [ ] **Step 3: Implement.** `getStocktakeDetail` uses `requireAdmin()` (read), reuses `loadItemNameMaps()`, reads the session by id, all `CONFIRMED` sessions (latest by `confirmed_at`, compared in JS — `findAllWhere` orders only by `id`/`created_at`) and whether any `OPEN` exists. `editConfirmedStocktake` uses `requireOwner()`. Change the issue-slip href to `` `/admin/inventory/stocktake/${s.id}` ``.
- [ ] **Step 4: Run the stocktake and issue-slip tests and `npx tsc --noEmit`, expect PASS.** If `lib/auth/delete-guard.test.ts` or another guard goes red, report it; do not widen an allow-list without saying why.

### Task 3: Screens (Gemini; Opus writes the RED tests first)

**Files:**
- Create: `app/admin/inventory/stocktake/[id]/page.tsx`, `app/admin/inventory/stocktake/[id]/components/StocktakeDetailView.tsx` (+ `.test.tsx`)
- Create: `app/admin/inventory/stocktake/[id]/edit/page.tsx`, `app/admin/inventory/stocktake/[id]/edit/components/StocktakeEditForm.tsx` (+ `.test.tsx`)
- Modify: `app/admin/inventory/stocktake/components/StocktakeSessionPanels.tsx` (`LastConfirmedSessionPanel`: link "Xem phiếu" → `/admin/inventory/stocktake/<id>`)

**Interfaces:** consumes `getStocktakeDetail`, `editConfirmedStocktake`, `StocktakeDetailView` (Task 2).

- [ ] **Step 1 (Opus): RED tests.**
  - `StocktakeDetailView.test.tsx`: title "STK-001"; desktop `hidden md:block` table headers in order Hàng, Đơn vị, Sổ lúc đếm, Đếm được, Chênh lệch; SKL-00004 row reads "6.000", "4.000", "Thiếu 2.000"; a found line reads "Dư 500"; a zero line shows no variance text; phone `md:hidden` cards with `data-line-id`; "Sửa" link to `/admin/inventory/stocktake/STK-001/edit` only when `editBlock` is null; `NOT_LATEST` shows "Đã có phiếu kiểm kê mới hơn nên phiếu này không sửa được."; `OPEN_SESSION` shows "Đang có phiếu kiểm kê mở, xong phiếu đó rồi mới sửa được."; `NOT_CONFIRMED` shows "Phiếu đã huỷ nên không sửa được."; `NOT_OWNER` shows none of these and no "Sửa".
  - `StocktakeEditForm.test.tsx`: one number box per line (`inputMode` decimal), prefilled; typing 5000 in SKL-00004 updates its variance to "Thiếu 1.000"; Lưu sends only changed lines `[{ lineId: "SKL-00004", countedQty: 5000 }]`; success → `router.push("/admin/inventory/stocktake/STK-001")`; a server error shows in a `role="alert"` box and stays; nothing changed → Lưu sends nothing and goes back; no `role="dialog"`; no reason box.
- [ ] **Step 2 (Opus): run, expect FAIL** (missing modules).
- [ ] **Step 3 (Gemini, `agy --model <newest -high> --mode accept-edits`):** build the screens to the spec section 3 and the tests; pages: `[id]/page.tsx` calls `getStocktakeDetail`, `notFound()` when null, `redirect("/admin/inventory/stocktake")` when `status === "OPEN"`. `[id]/edit/page.tsx` redirects to the stocktake page unless `editBlock === null`. Brief says: "Do not run any command; only edit the file(s). Opus runs the tests." Desktop table and phone cards both specified.
- [ ] **Step 4 (Opus):** run tests, tsc, review against the spec, fix small mechanical issues.

### Task 4: Docs, gates, migration (Opus)

- [ ] `BR-INV-012` status → built on the branch with the migration and screens named; `docs/03-workflows/stocktake.md`: flow-decl routes add `/admin/inventory/stocktake/[id]`, `/admin/inventory/stocktake/[id]/edit`, brCodes add `BR-INV-012`; five questions updated (a closed session is no longer final for the owner); dated "Behaviour change — 2026-10-14" note. `docs/03-workflows/stock-issue.md`: the Kiểm kê row opens the stocktake's own page.
- [ ] Five gates; `npx vite-node scripts/verify-cogs.ts` (no data changes, so unchanged).
- [ ] Ask the owner to approve running migration 0110 on the server (separate from push). Until then the edit page answers with the database's "function not found" error on 8386.
- [ ] Master plan row 2 → done; delete this sub-plan after the owner accepts.
