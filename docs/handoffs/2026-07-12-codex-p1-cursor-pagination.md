# Task: P-1 Alternative B — Cursor Pagination

## Context

- P-1 gốc (tăng PAGE_SIZE 1000→5000 trong code) **không khả thi**: Supabase PostgREST cap cứng 1000 rows/response ở server-side. Verify bằng `scripts/test-supabase-cap.ts`:
  - `.range(0, 4999)` trên stock_ledger (7280 rows) → chỉ trả 1000 rows.
  - `.limit(5000)` cũng chỉ trả 1000 rows.
- Mục tiêu P-1 vẫn đáng làm: giảm round trip overhead cho bảng lớn. Stock_Ledger 7280 rows = 8 round trips × ~150ms = ~1.2s chỉ cho 1 bảng.
- Alternative B: chuyển từ **offset pagination** (`.range()`) sang **cursor pagination** (`.gt('id', lastId) + .order('id') + .limit()`). Cùng số round trips nhưng bỏ được offset/count overhead của PostgREST, và stable hơn với data thay đổi.

## Scope

File duy nhất: `lib/sheets_db.ts`

Hai functions cần refactor:
1. `findAllNoCache` (line 187-211) — paginate toàn bộ bảng.
2. `findAllWhere` (line 220-275) — paginate với filter.

## Current pattern (offset-based)

```ts
// findAllNoCache
let page = 0;
while (true) {
  const { data } = await supabase
    .from(tableName)
    .select('*')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (!data || data.length === 0) break;
  // push rows + serialize
  if (data.length < PAGE_SIZE) break;
  page += 1;
}
```

## Target pattern (cursor-based)

```ts
// Cursor pagination (ascending by id)
let lastId: string | null = null;
while (true) {
  let query = supabase
    .from(tableName)
    .select('*')
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);
  if (lastId !== null) {
    query = query.gt('id', lastId);  // next page: rows with id > lastId
  }
  const { data, error } = await query;
  if (error) throw new Error(`findAll(${sheetName}): ${error.message}`);
  if (!data || data.length === 0) break;
  // push rows + serialize
  if (data.length < PAGE_SIZE) break;
  lastId = data[data.length - 1].id;
}
```

## Constraints

1. **Không break API surface**: signature của `findAllNoCache` và `findAllWhere` giữ nguyên. Return type giữ nguyên (array).
2. **Order behavior**: 
   - `findAllNoCache`: hiện không explicit order. Cursor yêu cầu stable order → default `order('id', { ascending: true })`. Acceptable vì callers hiện không phụ thuộc thứ tự raw (đã verify bằng grep — callers iterate/lookup/filter).
   - `findAllWhere`: caller có thể specify `filters.order`. Implement:
     - Nếu `filters.order` không có → default cursor theo `id`.
     - Nếu `filters.order.column === 'id'` → cursor theo `filters.order.column` + direction.
     - Nếu `filters.order.column !== 'id'` → **composite cursor** (column + id) để đảm bảo stable. Hoặc throw nếu quá phức tạp — em recommend composite, nhưng Codex quyết định implementation.
3. **Cursor column phải unique** để tránh loop infinite. `id` là PK (unique). Nếu filter order theo column khác, phải thêm tiebreaker.
4. **Serialize logic giữ nguyên** (`serializeRow` với jsonCols + booleanCols).
5. **PAGE_SIZE constant giữ 1000** (vẫn là cap server).

## Verification (bắt buộc — không skip)

1. **Parity test**: chạy `vite-node scripts/benchmark-shim.ts`. Script đã có parity check giữa legacy load (in-memory filter) và `findAllWhere` SQL push-down (line 89-131). Cursor pagination phải pass parity này.
2. **Benchmark before/after**: 
   - Before: chạy benchmark-shim.ts, ghi lại time cho Stock_Ledger, Orders_V2, Order_Lines_V2, Order_Events.
   - Implement cursor.
   - After: chạy lại, so sánh.
   - Kỳ vọng: cursor nhanh hơn hoặc ít nhất bằng offset (vì bỏ count overhead).
3. **Test suite**: `vitest run` — toàn bộ test phải pass (đặc biệt là `lib/sheets_db.test.ts` nếu có, và các test dùng findAll/findAllWhere).
4. **TypeScript**: `tsc --noEmit` — 0 errors.
5. **Git diff clean**: `git diff --check` — no whitespace errors.

## Out of scope

- Không refactor `findById`, `getHeadersNoCache`, `insert`, `update`, `updateMany` — chỉ 2 function findAll* dùng pagination.
- Không thay đổi cache layer (`unstable_cache` wrapper giữ nguyên).
- Không thêm SQL push-down mới (P-2, separate task).
- Không xóa `scripts/test-supabase-cap.ts` (giữ làm documentation cho decision).

## Expected output

- 1 commit với message: `Codex perf: cursor pagination for findAll* (P-1 alternative B)`
- Commit message body: tóm tắt before/after timing cho Stock_Ledger + Orders_V2.
- Update `DEVELOPMENT-TRACKING.md`: append entry ngày 2026-07-12.

## Questions trước khi code

Nếu bất kỳ điểm nào không rõ hoặc có approach tốt hơn (vd: keyset pagination với composite key, hoặc raw SQL qua `supabase.rpc()`), ping Claude để thảo luận trước khi implement.
