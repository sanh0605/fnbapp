# Gate 7 Large-Table Query Audit

Date: 2026-07-19

## Tóm tắt cho chủ doanh nghiệp

Ba màn hình tải nhiều dữ liệu nhất đã được thu hẹp mà không đổi số liệu người dùng nhìn thấy: chi tiết đơn hàng, báo cáo bán hàng và báo cáo lãi lỗ. Kiểm tra trực tiếp trên dữ liệu thật xác nhận danh sách dòng trước và sau giống nhau. Không có dữ liệu nào bị sửa.

Trong khoảng 01–19/07, truy vấn báo cáo giảm từ 1.593 xuống 424 đơn và từ 2.279 xuống 617 dòng món. Thời gian đọc tương ứng giảm từ khoảng 2,1–2,5 giây xuống 0,1–0,2 giây trong lần đo này. Chi tiết một đơn giảm từ việc đọc toàn bộ ba bảng xuống đúng một chuỗi phiên bản, một dòng món và một sự kiện trong mẫu kiểm tra.

## Scope and method

The audit cataloged direct reads of `orders_v2`, `order_lines_v2`, `order_events`, and `stock_ledger` from the three highest-count admin action modules. It then converted only read paths whose row set could be narrowed without changing page semantics.

`scripts/audit-gate7-large-table-query-scope.ts` compares the old in-memory-filtered row IDs with the new server-filtered row IDs against production. It exits non-zero on any missing or extra row and performs no writes.

## Call-site catalog

| Module / operation | Previous large-table read | Need | Decision |
|---|---|---|---|
| `orders/getOrdersV2` | All orders and all lines | Existing order page is an all-time list with all completed orders and their lines | Keep for this gate. Meaningful pagination would change visible behavior and requires a separate product decision. |
| `orders/getOrderDetailV2` | All orders, lines, and events | One order, its version chain, its lines, and chain events | Converted to `findById`, filtered child-version query, and batched foreign-key reads. |
| `orders/voidOrderV2` | All orders and ledger | One order and its consumption reversal inputs | Not a page load; Gate 4 atomic mutation path. Deferred to avoid mixing transaction remediation into Gate 7. |
| `orders/editOrderV2` | All orders, lines, and ledger | One order and lines, but full historical ledger is used for sale-time MAC replay | Not a page load; transaction path. Deferred. |
| `reports/getPnLDataV2` | Date-filtered completed orders, all lines, all ledger | Lines for report orders; full ledger history for MAC attribution | Lines converted to batched order-ID query. Ledger intentionally retained. |
| `reports/getSalesDataV2` | Date-filtered completed orders and all lines | Lines for report orders | Converted to batched order-ID query. |
| `reports/getPromotionPerformanceV2` | All orders | Completed orders in the selected date/brand range | Converted to the existing filtered completed-order query. |
| `reports/getHourlyHeatmapV2` | Already uses filtered completed-order query | Completed orders in selected range | No change needed. |
| `inventory/getRealtimeStock` | All ledger rows | Current balance is the sum of the complete append-only ledger | Keep. A database aggregate or stored balance would be a separate architecture change. |

Reference/catalog tables remain cached and were not part of this conversion.

## Query helper

`findAllWhereInBatches` reuses the existing `findAllWhere` cursor-pagination behavior while splitting large `IN` lists into groups of 100. This avoids oversized PostgREST URLs for high-volume date ranges. Batches run concurrently and the combined result is sorted by primary key, preserving the deterministic ordering supplied by the old full-table read.

## Production measurement

Window: 2026-07-01 through 2026-07-19, interpreted in `Asia/Ho_Chi_Minh`.

| Population | Old full read | New scoped read | Old elapsed | New elapsed | Row-set parity |
|---|---:|---:|---:|---:|---|
| Completed report orders | 1,593 table rows | 424 matching orders | 2,134.0 ms | 123.2 ms | Pass |
| Report order lines | 2,279 table rows | 617 matching lines | 2,504.9 ms | 198.2 ms | Pass |
| Sample detail orders | 1,593 table rows | 1 chain row | Included above | 252.5 ms for all scoped detail reads | Pass |
| Sample detail lines | 2,279 table rows | 1 line | Included above | Included above | Pass |
| Sample detail events | 1,606 table rows | 1 event | 1,975.9 ms | Included above | Pass |
| Current-stock/MAC ledger | 8,253 rows | 8,253 rows | 3,187.2 ms | Not converted | Intentionally complete |

The timings are one production sample, not a load benchmark. The row-count reduction and exact ID parity are the correctness evidence; latency is included only as a directional measurement.

## Verification

- TDD red/green coverage for 100-row `IN` batching and deterministic merge order.
- Report tests prove P&L and Sales request lines only for the server-filtered order IDs.
- Order-detail test proves no full-table order, line, or event read remains.
- Focused suite: 38 tests passed.
- TypeScript: 0 errors.
- Production row-set parity: pass.
- No data was written.
