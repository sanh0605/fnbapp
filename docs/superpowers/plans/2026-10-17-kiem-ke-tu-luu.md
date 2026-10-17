# Kiểm kê tự lưu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On an open stocktake's counting screen:
- a line saves itself when the cursor leaves that line's boxes;
- clearing every box of a saved line puts it back to "Chưa đếm";
- each package size keeps its own typed number after a reload;
- the converted total shows while typing.

**Architecture:**
- Migration `0137` adds `stocktake_lines.package_counts jsonb`. It replaces `save_stocktake_line_atomic` with a 3-argument version: a null count clears the line, and the package split is stored.
- The existing server action `saveStocktakeLine` takes the per-package numbers. It validates them against `uom_conversions`, computes the base quantity on the server, and calls the function.
- The count view drops its per-row button and saves when focus leaves the line.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres (plpgsql), Vitest.

**Spec:** this plan (it changes something that already exists, so the design lives here). Rules: `BR-INV-007`, `BR-INV-011`, and new `BR-INV-023` in `docs/02-rules/business-rules/stocktake.md`.

Owner's request, 2026-10-17, looking at `STK-002`: *"có cần nút xác nhận ở mỗi dòng không ? … có cần phải hiển thị hết tất cả đơn vị không ? Nếu có 2 loại đóng gói khác nhau thực tế thì sẽ nhập như thế nào để cộng dồn cho đúng số lượng tồn ?"*

The answer offered was:
- drop the row button, so a line saves itself when the cursor leaves it;
- clearing the boxes puts the line back to "Chưa đếm";
- keep one box per package size;
- show the converted total while typing.

He replied: *"Ok, làm luôn"*.

Revised 2026-10-17 after the Sonnet critique:
- the save happens when focus leaves the line, not each box;
- one action instead of two;
- the grants are written out;
- the boxes stay enabled while a line saves;
- "Xem trước" waits for running saves;
- no `revalidatePath` on a line save.

## Hiện trạng

**Đã xem:**
- `app/admin/inventory/stocktake/[id]/components/StocktakeCountView.tsx` (toàn bộ)
- `app/admin/inventory/stocktake/actions.ts` (dòng 30–170, 298–352, 420–431)
- `lib/stock/stocktake-package-lines.ts`
- `lib/stock/stocktake-transaction.ts` (dòng 80–92)
- `components/ui/NumberInput.tsx` (props, dòng 250–270)
- `supabase/migrations/0136_6d_batch_2c.sql` (`save_stocktake_line_atomic`, dòng 447–510)
- `lib/db/backup-restore.ts` (dòng 100–128)
- `docs/03-workflows/stocktake.md`
- `docs/02-rules/business-rules/stocktake.md` (BR-INV-011, BR-INV-022)

Qua bản phản biện của Sonnet (Sonnet đã đọc, em chưa tự đọc):
- `0056_found_stock.sql:149-151` (quyền gọi hàm);
- `0136` dòng 167, 234–274 (`planHash` không gồm `counted_at` hay `package_counts`; dòng trống bị bỏ khi chốt);
- `StocktakeCountView.test.tsx` dòng 52–448.

**Chưa xem:**
- `useStocktakeLinesFilter.ts`
- trang sửa phiếu đã xác nhận (`StocktakeEditForm.tsx`)

1. **Trạng thái.**
   - Mỗi dòng có ba trạng thái, suy ra lúc đọc, không lưu: `BLANK` (`counted_qty` null), `MATCH` (đếm = sổ), `OFF` (khác sổ).
   - Hiện nay một dòng đã lưu không quay về `BLANK` được: hàm từ chối số null.
   - Sau việc này: xoá trắng mọi ô của một dòng đã lưu rồi rời dòng thì dòng về `BLANK`. Hàm xoá `counted_qty`, `theoretical_at_count`, `counted_at`, `package_counts`.
   - Trên màn hình, mỗi dòng có một dòng chữ trạng thái lưu, chỉ giữ trong trình duyệt: "Đang lưu…", "✓ Đã lưu", hoặc chữ đỏ báo lỗi.
2. **Nút.**
   - Hiện nay mỗi dòng có nút "Xác nhận" (dòng có kiểu đóng gói) hoặc "Lưu". Sau việc này nút bị bỏ.
   - Rời một dòng có giá trị khác lần lưu trước thì tự lưu.
   - "Xem trước" chờ mọi lần lưu đang chạy xong rồi mới gọi máy chủ.
   - Ô bị khoá khi đang xem trước, như cũ. Ô không bị khoá khi đang lưu.
   - "Huỷ phiên" không đổi.
3. **Danh sách.**
   - Mỗi mặt hàng có một ô cho mỗi kiểu đóng gói `ACTIVE`, không phải `purchase_only` (`buildPackageLines`).
   - Đo 2026-10-17 trên `STK-002`: 69 dòng. 53 dòng có 1 ô, 16 dòng có 2–3 ô, 0 dòng không có ô nào.
   - Không đổi gì ở danh sách.
4. **Ô nhập.**
   - Ô kiểu đóng gói: `NumberInput decimals={0}`. Bàn phím số trên điện thoại; ô tự không nhận dấu chấm. Gói đã mở không đếm (`BR-INV-007`).
   - Trong một dòng có ít nhất một ô có số, ô trống tính là 0 gói loại đó. "Trống không phải 0" (`BR-INV-011`) áp cho cả dòng, không cho từng ô.
   - Mọi ô trống: dòng chưa lưu thì không gửi gì. Dòng đã lưu thì gửi "xoá", để dòng về `BLANK`.
   - Máy chủ kiểm lại:
     - mã kiểu đóng gói phải thuộc đúng mặt hàng của dòng, `ACTIVE`, không `purchase_only`;
     - số nguyên ≥ 0;
     - tổng > tổng đã mua thì hàm vẫn từ chối như cũ (`BR-INV-005`).
   - Dòng không có kiểu đóng gói (hiện 0 dòng) vẫn một ô, `decimals={3}`, gửi thẳng số lượng.
5. **Dữ liệu phục vụ.**
   - Phục vụ: dòng của phiên đang mở (`OPEN`).
   - Cố ý không phục vụ trang sửa phiên đã xác nhận. Trang đó vẫn một ô tổng mỗi dòng.
   - Sửa phiên đã xác nhận không đụng `package_counts`, nên cột này có thể cũ sau khi sửa. Cột chỉ được đọc khi phiên còn `OPEN`, mà phiên đã xác nhận không mở lại được, nên không ai thấy số cũ đó.

Câu hỏi riêng cho việc này:

6. **Gõ hai ô của cùng một dòng?**
   - Ví dụ: gõ "3" ở ô Cây, chuyển sang ô Cái. Focus vẫn trong dòng, nên chưa lưu.
   - Gõ "12", rồi bấm ra ngoài dòng. Máy lưu một lần: 162 Cái.
   - Cách bắt: `onBlur` đặt trên khung bọc các ô của dòng (React `onBlur` nổi bọt). Bỏ qua khi `e.currentTarget.contains(e.relatedTarget)`.
7. **Hai lần lưu cùng một dòng chồng nhau?**
   - Mỗi dòng giữ một lần lưu đang chạy. Rời dòng khi lần trước chưa xong thì đánh dấu "lưu lại", và khi xong lưu thêm một lần với giá trị mới nhất.
   - Con số cuối trên máy chủ luôn là số đang hiện.
8. **Mất mạng?**
   - Dòng hiện chữ đỏ "Chưa lưu được: <lý do>. Bấm vào ô rồi bấm ra ngoài để thử lại." Giá trị vẫn giữ.
   - Lần rời dòng sau thử lại, kể cả khi giá trị không đổi.
9. **Tải lại trang?**
   - Mỗi ô hiện đúng số đã gõ, đọc từ `package_counts`.
   - Dòng đã đếm trước bản này có tổng mà không có `package_counts`. Anh có thể đang đếm `STK-002` bằng bản cũ, nên chuyện này có thể xảy ra. Gặp dòng như thế:
     - các ô để trống, dưới ô hiện "Đã lưu: 162 Cái";
     - rời dòng mà không gõ gì thì không gửi gì. Phải so với giá trị lúc mở trang, không so với "trống" để rồi gửi xoá.
10. **Xem trước có lấy đúng số mới?**
    - Có. Xem trước đọc máy chủ, và chờ mọi lần lưu đang chạy.
    - Lưu thêm sau khi xem trước: lúc xác nhận, máy báo "số đã đổi", như hiện nay (`actions.ts:360`).
11. **Bản đang chạy trên mạng có hỏng khi đổi hàm không?**
    - `0137` xoá hàm 2 tham số, tạo hàm 3 tham số với tham số thứ ba mặc định null.
    - Bản cũ gọi với 2 tham số có tên, vẫn khớp.
    - Chạy `0137` trước khi đẩy code mới.
12. **Lưu một dòng có làm tải lại cả trang không?** Không. Action lưu dòng bỏ `revalidatePath`; màn hình tự cập nhật từ số máy chủ trả về.

## Ví dụ tính sẵn (số thật, đo 2026-10-17, phiên `STK-002`)

| Dòng | Mặt hàng | Gõ | `package_counts` lưu | `counted_qty` lưu |
|---|---|---|---|---|
| SKL-00106 | Ly Nhựa PET 98 - 16OZ - 500ml | Cây (QD-162, ×50): 3 · Cái (QD-069, ×1): 12 | `{"QD-162":3,"QD-069":12}` | 162 |
| SKL-00082 | Dâu sấy | Túi 100 g (QD-038): 1 · Túi 500 g (QD-051): 2 · Túi 1.000 g (QD-043): trống | `{"QD-038":1,"QD-051":2}` | 1100 |
| SKL-00082 | Dâu sấy | sau đó xoá trắng cả ba ô | null | null (về Chưa đếm) |
| SKL-00106 | Ly Nhựa PET 98 - 16OZ - 500ml | gửi kèm `{"QD-038":1}` (mã của Dâu sấy) | — | bị từ chối: "Kiểu đóng gói không thuộc mặt hàng này" |
| SKL-00106 | Ly Nhựa PET 98 - 16OZ - 500ml | gửi `{"QD-162":2.5}` (chỉ có thể qua gọi thẳng) | — | bị từ chối: "Chỉ nhập số nguyên gói còn nguyên seal" |

Dòng tổng dưới ô lúc gõ:
- SKL-00106 hiện "= 162 Cái".
- SKL-00082 hiện "= 1.100 g" (`formatNumber`).

## Global Constraints

- Code and comments in English; on-screen text in Vietnamese.
- Ponytail, level full: no extra code, no extra options.
- No popups (`BR-DATA-007`).
- Phone and desktop layouts both stay.
- `0137` is a new file. Never edit an applied migration.

## Review Focus

1. Type in two boxes of one line, then click away. Exactly one save is sent, with both boxes' numbers.
2. A saved line, every box cleared, focus leaves. It must become "Chưa đếm", not 0.
3. A line saved by the old code (count, no `package_counts`), focus in then out without typing. Nothing is sent and the count is not cleared.
4. A conversion id from another item, or 2.5, posted to the action. The server refuses.
5. Reload after saving 3 Cây + 12 Cái. The boxes show 3 and 12.

---

### Task 1: Database and server (backend-coder)

**Files:**
- Create: `supabase/migrations/0137_stocktake_package_counts.sql`
- Create: `tests/migrations/0137-stocktake-package-counts.test.ts`
- Modify: `lib/stock/stocktake-transaction.ts`: `saveStocktakeLineAtomic` input becomes `{ lineId: string; countedQty: number | null; packageCounts: Record<string, number> | null }` and passes `p_package_counts`. Update its test if one pins the payload.
- Modify: `app/admin/inventory/stocktake/actions.ts`:
  - `StocktakeLineView` gains a required `packageCounts`;
  - `getStocktakeSessionData` fills it;
  - `saveStocktakeLine` gets the new signature.
- Modify: `app/admin/inventory/stocktake/actions.test.ts`: assertions on `getStocktakeSessionData` (~375–444, ~761), plus new cases.
- Modify the fixtures, adding `packageCounts: null`:
  - `app/admin/inventory/stocktake/[id]/components/StocktakeDetailView.test.tsx:45`
  - `app/admin/inventory/stocktake/[id]/cancel/components/CancelStocktakeForm.test.tsx:49`

**Interfaces (Task 2 relies on these exact names):**

```ts
// actions.ts
export interface StocktakeLineView { /* existing fields */ packageCounts: Record<string, number> | null; }
// counts object = conversionId -> whole sealed packages (package lines);
// number = direct base quantity (lines without packages); null = clear back to BLANK.
export async function saveStocktakeLine(
  lineId: string,
  value: Record<string, number> | number | null,
): Promise<ActionResponse & { countedQty?: number | null }>;
```

**Migration `0137`:**
- `alter table public.stocktake_lines add column package_counts jsonb;` Nullable, no default, no backfill.
- `drop function public.save_stocktake_line_atomic(text, numeric);`
- `create function public.save_stocktake_line_atomic(p_line_id text, p_counted_qty numeric, p_package_counts jsonb default null)`, with the 0136 body plus:
  - `p_counted_qty is null` clears the line: `counted_qty`, `theoretical_at_count`, `counted_at`, `package_counts` all null. The session must still be `OPEN`. Return the same jsonb shape.
  - Otherwise, as 0136, and also `package_counts = p_package_counts`.
- Grants, as 0056:149-151 did for the old signature:
  - `revoke all on function public.save_stocktake_line_atomic(text, numeric, jsonb) from public, anon, authenticated;`
  - `grant execute ... to service_role;`
- No SQL function calls `save_stocktake_line_atomic`; grep confirmed it. Say so in one line in the migration header.

**Action `saveStocktakeLine`:**
- `requireAdmin()`.
- An object:
  - Load the line's `item_reference`, then that item's rows in `uom_conversions`.
  - Refuse, in Vietnamese:
    - a key that is not an `ACTIVE`, non-`purchase_only` conversion of that item: "Kiểu đóng gói không thuộc mặt hàng này";
    - a value that is not an integer ≥ 0: "Chỉ nhập số nguyên gói còn nguyên seal".
  - `countedQty = Σ qty × conversion_rate`. An empty object is treated as null.
- A number: as today (finite, ≥ 0), `packageCounts` null.
- `null`: clear.
- Return `{ countedQty }`, the number stored (null when cleared). No `revalidatePath`.
- `getStocktakeSessionData` maps `line.package_counts` to `packageCounts`, with values as numbers.

`backup-restore.ts`: no change. Old backups lack the column, and it is nullable. Say so in the commit message.

- [ ] Step 1: write the 0137 migration-text test. Check:
  - the column is added;
  - the 2-arg function is dropped;
  - exactly one `create function save_stocktake_line_atomic` with 3 args;
  - null clears;
  - revoke and grant are present.

  Run it; expect FAIL because the file is missing.
- [ ] Step 2: write the migration. The test passes.
- [ ] Step 3: write the action tests. Titles carry `BR-INV-023`. Cases:
  - SKL-00106 `{"QD-162":3,"QD-069":12}` → rpc gets 162 and that object;
  - a foreign `QD-038` → refused;
  - 2.5 → refused;
  - `null` → rpc gets null count;
  - number 5 → rpc gets 5 and null counts;
  - `getStocktakeSessionData` returns `packageCounts`.

  Run; expect FAIL.
- [ ] Step 4: implement. Tests pass. `npx tsc --noEmit` may still fail only in `StocktakeCountView*`, which Task 2 owns.
- [ ] Step 5: commit.

### Task 2: Counting screen (Gemini Flash)

**Files:**
- Modify: `app/admin/inventory/stocktake/[id]/components/StocktakeCountView.tsx`
- Modify: `app/admin/inventory/stocktake/[id]/components/StocktakeCountView.test.tsx` (fixtures gain `packageCounts`). The old test "all pack boxes blank … shows error" (~384–427) is rewritten to the new rule: on an unsaved line nothing is sent; on a saved line, clearing sends null.

**Consumes:** `saveStocktakeLine(lineId, Record<string, number> | number | null)` returning `{ error?, countedQty? }`, and `StocktakeLineView.packageCounts`.

**Behaviour:**
- Remove the per-row "Xác nhận"/"Lưu" button from both layouts.
- Package boxes use `decimals={0}`. Lines without packages keep `decimals={3}`.
- Initial box values come from `line.packageCounts`; legacy lines use `countedQty`. Keep, per line, the last value sent successfully, starting from the initial values.
- Wrap each line's boxes in an element with `onBlur`. When focus leaves the wrapper (`!e.currentTarget.contains(e.relatedTarget)`):
  1. Build the value: an object of the non-blank boxes, or the legacy number. All blank gives null.
  2. If it equals the last value sent and the last attempt did not fail, do nothing. This covers "all blank on an untouched line".
  3. If a save is running for this line, mark "save again" and stop.
  4. Otherwise call `saveStocktakeLine`. Keep the promise in a ref map so "Xem trước" can `await Promise.all(...)` before calling the preview.
- Track the saving state per line. Boxes are not disabled while saving; they are disabled only while previewing.
- **One status text per line:**
  - "Đang lưu…";
  - "✓ Đã lưu" when the line has a count;
  - red "Chưa lưu được: <message>. Bấm vào ô rồi bấm ra ngoài để thử lại.";
  - nothing for an untouched blank line.

  Drop "Đã sửa".
- **Under a package line's boxes:**
  - any box has a number: "= 162 Cái" (`formatNumber(total)` + `line.unitName`);
  - otherwise, the line has a count but no `packageCounts`: "Đã lưu: 162 Cái".
- After a save, update the line's `countedQty`, `state` and difference from the returned `countedQty` and `theoreticalAtCount` (the book figure the server stored). Null sets `BLANK`.
- Desktop: the "Thao tác" column becomes "Trạng thái" and holds the status text. Phone: the status text sits where the button was.

Tests (titles carry `BR-INV-023`):
- typing in two boxes then blurring out of the line sends one call with both numbers;
- re-blurring with no change sends nothing;
- clearing a saved line sends null;
- an untouched line saved by the old code sends nothing on blur;
- the live total text;
- prefill from `packageCounts`;
- "Xem trước" waits for a running save;
- no "Xác nhận"/"Lưu" row button remains.

### Task 3: Docs (Opus, done in the worktree)

- `docs/02-rules/business-rules/stocktake.md`: `BR-INV-023`.
- `docs/03-workflows/stocktake.md`: behaviour-change paragraph; question 2's button list.

### Order and approvals

1. Tasks 1 and 2 run in `.worktrees/kk-tu-luu` in parallel; they touch different files.
2. Reviewer, then the five checks, then a local merge to main.
3. Playwright on 8386, against the code merged on main. `page.route` aborts every POST, so nothing is written to `STK-002`. The column does not exist until `0137` runs, so the page reads `packageCounts` as null.
4. The owner approves running `0137` plus its `migration repair` (one question), then the push (another question). `0137` runs before the push.
