# Full System Audit And Optimization Roadmap

Date: 2026-06-25
Repo: `fnbapp`
Mode: local commits only, no push

## 1. Mục tiêu

Đây là tài liệu điều phối cho giai đoạn tối ưu lại toàn bộ hệ thống. Mục tiêu không chỉ là sửa từng bug rời rạc, mà là đưa hệ thống về trạng thái có thể tin được ở 4 lớp:

1. Dữ liệu Google Sheet sạch, không còn sheet dư làm nhiễu audit.
2. Luồng nghiệp vụ bán hàng, sửa đơn, nhập hàng, tồn kho, giá vốn chạy nhất quán.
3. Code có module rõ ràng, test được, giảm script một lần và giảm logic trùng.
4. UI mobile-first đủ tốt cho vận hành thật: POS, đơn hàng, nhập hàng, tồn kho, báo cáo.

Từ điển chuẩn dùng chung:

- `docs/domain-dictionary.md`

Nguyên tắc thực thi:

- Mỗi phase/task phải có audit trước và verify sau.
- Mỗi nhóm thay đổi có commit riêng.
- Không push nếu chưa được yêu cầu.
- Không xoá dữ liệu vận hành nếu chưa có audit và lý do rõ ràng.
- Dữ liệu lịch sử phải được bảo toàn bằng snapshot hoặc ledger, không lấy giá/công thức hiện tại để ghi đè lịch sử nếu nghiệp vụ cần giá trị tại thời điểm tạo đơn.
- Tên tính năng, trạng thái, ledger, snapshot, discount và UI label phải đối chiếu với `docs/domain-dictionary.md`.

## 2. Baseline hiện tại

Kết quả mới nhất sau phase cleanup:

- Google Sheet usage audit: `KEEP 29`, `REVIEW 0`, `ARCHIVE_CANDIDATE 28`.
- Review sheet content audit: `0` sheet còn cần review.
- Order ledger audit: `0` mismatch, `0` orphan ledger row.
- Purchase ledger audit: `0` ledger mismatch, `0` ambiguous conversion row, `0` missing conversion row.
- Current stock audit: `0` tracked item âm, `0` unknown item ref.
- COGS drift audit: `0` mismatched orders, `0` mismatched lines, delta `0đ`.
- Test suite: `155/155` tests pass.

Lệnh verify baseline:

```powershell
node_modules\.bin\vite-node.cmd scripts\audit-sheet-usage.ts
node_modules\.bin\vite-node.cmd scripts\audit-review-sheet-content.ts
node_modules\.bin\vite-node.cmd scripts\audit-order-ledger.ts
node_modules\.bin\vite-node.cmd scripts\audit-purchase-ledger.ts
node_modules\.bin\vite-node.cmd scripts\audit-current-stock.ts
node_modules\.bin\vite-node.cmd scripts\audit-cogs-drift.ts
npx.cmd vitest run
```

## 3. Những việc đã hoàn thành

### Phase A - Sửa lỗi snapshot/giá khi sửa đơn

Trạng thái: done

Commit liên quan:

- `b50c38a fix: preserve promotion snapshots on order edit`
- `35653a3 fix: audit and clean order inventory ledger`
- `a1b673f fix: compute cogs with fifo timeline`

Task A1 - Kiểm tra đơn bị nghi bug khi sửa đơn:

- Audit đơn `PHD000605`.
- Kiểm tra hiển thị chi tiết đơn và modal sửa đơn.
- Xác định câu hỏi nghiệp vụ: sửa đơn sau khi giá modifier thay đổi có dùng snapshot cũ hay giá mới.
- Kết luận thiết kế: đơn lịch sử cần giữ snapshot tại thời điểm tạo đơn; sửa đơn không được tự lấy giá modifier hiện tại làm sai lịch sử nếu line cũ không đổi.

Task A2 - Sửa đường tính COGS:

- Đồng bộ COGS theo FIFO thay vì trộn MAC/FIFO.
- Bổ sung audit COGS drift để so sánh stored `cost_at_sale` với FIFO kỳ vọng.
- Sửa FIFO timeline để tính theo thứ tự thời gian ledger.

Task A3 - Verify:

- COGS drift về `0`.
- Order ledger mismatch về `0`.
- Test suite pass.

### Phase B - Sửa logic trừ tồn bán thành phẩm

Trạng thái: done

Commit liên quan:

- `e0e9e97 fix: split semi-product stock consumption`
- `71b1263 chore: add negative stock investigation scripts`
- `3c6cb03 chore: add stock balance audits`

Task B1 - Audit tồn âm:

- Xác định 9 item âm ban đầu chủ yếu là bán thành phẩm.
- Kiểm tra khả năng bị trừ tồn 2 lần: vừa trừ bán thành phẩm, vừa bung công thức trừ nguyên liệu.
- Kết luận nghiệp vụ: nếu bán thành phẩm thiếu tồn thì chỉ bung công thức cho phần thiếu, không trừ nguyên liệu cho toàn bộ lượng đã có sẵn.

Task B2 - Sửa consumption module:

- Tạo module `lib/inventory-consumption.ts`.
- Logic mới:
  - Nếu bán thành phẩm còn đủ tồn: trừ bán thành phẩm.
  - Nếu còn một phần: trừ phần còn trong bán thành phẩm, bung công thức cho phần thiếu.
  - Nếu bằng 0: bung công thức sang nguyên liệu gốc.
- Áp dụng cho POS order creation và admin order edit.

Task B3 - Xử lý nước đường:

- Xác nhận từ user: từ đơn hàng ngày 2026-05-13 trở đi, nước đường dùng nguyên liệu gốc `Nước đường Glofood`.
- Xác định purchased item `SPM-027`.
- Thêm audit `scripts/audit-water-sugar-transition.ts`.

Task B4 - Xử lý tồn âm hiện tại:

- Chạy adjustment cho các item âm được xác định.
- Kết quả current stock về `0` item âm.

Task B5 - Verify:

- `scripts/audit-current-stock.ts`: negative stock `0`.
- `scripts/audit-cogs-drift.ts`: mismatch `0`.
- Tests pass.

### Phase C - Sửa nhập hàng và giá vốn Dâu sấy thành bài toán tổng quát

Trạng thái: done

Task C1 - Audit lỗi Dâu sấy:

- Base ingredient: `ING-028`.
- Purchased item: `SPM-033`.
- PO liên quan: `PO-020`, `PO-023`, `PO-033`, `PO-034`.
- Nguyên nhân: nhiều `UOM_Conversions` cùng purchased unit `U-008`, lịch sử thiếu `conversion_id`, script fallback chọn nhầm conversion.

Task C2 - Mở rộng từ Dâu sấy sang toàn bộ PO:

- Không chỉ sửa một item.
- Audit tất cả completed PO lines.
- Backfill `conversion_id` khi an toàn.
- Không tự chọn conversion nếu có nhiều conversion mơ hồ.

Task C3 - Sửa dữ liệu và script:

- Sửa stock ledger cho các dòng sai.
- Gắn/refill conversion cho PO lines lịch sử khi xác định được.
- Sửa đường rebuild/audit purchase ledger để ưu tiên `conversion_id`.
- Nếu thiếu `conversion_id` và không xác định duy nhất, báo lỗi audit thay vì chọn dòng đầu tiên.

Task C4 - Verify:

- Purchase ledger mismatch `0`.
- Ambiguous conversion rows `0`.
- Dâu sấy đúng:
  - `PO-020`: qty `100`, unit cost `570`.
  - `PO-023`: qty `1000`, unit cost `411.6`.
  - `PO-033`: qty `1000`, unit cost `545.28`.
  - `PO-034`: qty `1000`, unit cost `445.5`.

### Phase D - Tối ưu trang Modifiers

Trạng thái: done

Task D1 - Audit UI:

- Trang `/admin/products/modifiers`.
- Lỗi input số lượng giữ `0`, nhập `10` thành `010`.
- Select nguyên liệu quá dài, khó tìm.
- Modal trên màn rộng còn bị trải ngang/chưa tối ưu thao tác.

Task D2 - Sửa input số:

- Khi focus/nhập số khác 0 thì số `0` mặc định biến mất hoặc bị thay thế.
- Lưu định mức không còn hiển thị `010g`.

Task D3 - Sửa lựa chọn nguyên liệu:

- Đổi select sản phẩm chi tiết sang live search.
- Tối ưu hiển thị dòng recipe trong modal.

Task D4 - Verify:

- Thêm/sửa modifier với Dâu sấy `10g`.
- UI hiển thị `Dâu sấy: 10g`, không còn `010g`.
- Modal usable hơn trên desktop.

### Phase E - Làm sạch Google Sheet

Trạng thái: done

Commit liên quan:

- `5d334a1 chore: add google sheets cleanup audit`
- `dcaadca chore: archive unused backup sheets`
- `42df0ef chore: archive empty review sheets`
- `f5efb61 chore: delete remaining review sheets`

Task E1 - Tạo audit sheet usage:

- Thêm `lib/sheet-usage-audit.ts`.
- Thêm `scripts/audit-sheet-usage.ts`.
- Thêm report:
  - `docs/audits/sheet-cleanup-plan.md`
  - `docs/audits/sheet-usage-report.json`

Subtask E1.1 - Phân loại sheet:

- `KEEP`: sheet có code reference hoặc đang được Google Sheets range phục vụ.
- `REVIEW`: không có code reference nhưng có khả năng chứa dữ liệu nghiệp vụ.
- `ARCHIVE_CANDIDATE`: backup/legacy/copy sheet không có code reference.

Subtask E1.2 - Bài học quan trọng:

- Một số sheet vận hành đang có tên lowercase như `orders`, `products`, `purchased_items`, `semi_products`, `brands`.
- Code có thể đọc bằng tên PascalCase nhưng Google Sheets vẫn phục vụ tab lowercase.
- Không được xoá/rename nhóm này nếu chưa đổi toàn bộ code và verify.

Task E2 - Archive sheet dư:

- Archive/hide backup và empty/header-only sheets bằng prefix `ZZ_ARCHIVE_`.
- Khôi phục ngay các lowercase operational sheets đã bị archive nhầm.

Task E3 - Audit nội dung review sheet:

- Thêm `lib/sheet-content-audit.ts`.
- Thêm `scripts/audit-review-sheet-content.ts`.
- Thêm report:
  - `docs/audits/review-sheet-content-report.md`
  - `docs/audits/review-sheet-content-report.json`

Task E4 - Xoá 7 review sheet sau khi user duyệt:

- `QUY TRÌNH TRIỂN KHAI`
- `TONG`
- `Thansg 3`
- `P&L`
- `CHUẨN BỊ TRƯỚC BÁN`
- `CCDC`
- `Trang tính2`

Task E5 - Verify:

- Sheet usage audit: `REVIEW 0`.
- Review content audit: `0`.
- Nghiệp vụ không lỗi:
  - Order ledger mismatch `0`.
  - Purchase ledger mismatch `0`.
  - Current stock âm `0`.
  - COGS drift `0`.
  - Tests `155/155` pass.

## 4. Rủi ro còn lại

### R1 - `ZZ_ARCHIVE_*` vẫn còn trong Google Sheet

Mức độ: thấp, nhưng gây nhiễu nếu nhìn bằng mắt.

Hiện trạng:

- 28 sheet đã archive/hide.
- Không còn `REVIEW`.

Khuyến nghị:

- Chưa xoá ngay nhóm `ZZ_ARCHIVE_*`.
- Giữ làm rollback cho tới khi hoàn tất audit full hệ thống.
- Sau khi tất cả phase nghiệp vụ pass, tạo phase xoá archive vĩnh viễn nếu user muốn sheet gọn tuyệt đối.

### R2 - Script một lần còn nhiều

Mức độ: trung bình.

Hiện trạng:

- `scripts/` còn nhiều script audit/fix lịch sử.
- Một số script vẫn có giá trị làm runbook.
- Một số script có thể xoá sau khi thay bằng audit chính thức.

Khuyến nghị:

- Không xoá hàng loạt ngay.
- Phân nhóm script thành:
  - `KEEP_RUNBOOK`
  - `KEEP_AUDIT`
  - `DELETE_ONE_OFF`
  - `ARCHIVE_AFTER_RELEASE`

### R3 - Admin UI chưa mobile-first toàn diện

Mức độ: trung bình/cao cho vận hành thực tế.

Hiện trạng:

- POS và Orders là luồng quan trọng nhất.
- Modifiers đã được tối ưu một phần.
- Nhiều trang admin vẫn thiên về desktop/table.

Khuyến nghị:

- Phase UI phải đi sau khi nghiệp vụ/ledger ổn.
- Ưu tiên màn nhân viên dùng thường xuyên trước.

### R4 - Thiếu test E2E cho workflow thật

Mức độ: trung bình.

Hiện trạng:

- Unit tests tốt hơn trước.
- Audit scripts bao phủ dữ liệu thật.
- Chưa có Playwright workflow cho POS, sửa đơn, nhập hàng.

Khuyến nghị:

- Thêm smoke E2E tối thiểu cho các workflow không thể bắt bằng unit test.

## 5. Kế hoạch tiếp theo

### Phase 0 - Domain Dictionary & System Vocabulary

Trạng thái: done

Mục tiêu:

- Có một bộ từ điển nghiệp vụ dùng chung cho code, sheet, audit script, báo cáo và UI.
- Tránh một khái niệm bị gọi nhiều tên khác nhau như `Topping`, `Modifier`, `Tùy chọn`.
- Tránh các audit script tính khác định nghĩa với app.

Task 0.1 - Tạo từ điển chuẩn:

- [x] Tạo `docs/domain-dictionary.md`.
- [x] Chuẩn hoá core entities: order, order line, product, variant, modifier, promotion.
- [x] Chuẩn hoá inventory entities: base ingredient, semi-product, purchased item, PO, conversion.
- [x] Chuẩn hoá trạng thái: `DRAFT`, `COMPLETED`, `SUPERSEDED`, `VOIDED`, `ACTIVE`, `INACTIVE`, `DELETED`.
- [x] Chuẩn hoá ledger contract: `PO_RECEIPT`, `SALES_CONSUME`, `EDIT_REVERSAL`, `PRODUCTION_CONSUME`, `PRODUCTION_YIELD`, `STOCK_ADJUST`.
- [x] Chuẩn hoá snapshot policy và purchase conversion policy.
- [x] Ghi rõ open decisions còn cần xử lý ở các phase sau.

Task 0.2 - Áp dụng từ điển vào các phase sau:

- [x] Khi sửa UI label, dùng preferred Vietnamese labels trong dictionary.
- [x] Khi sửa code/module, dùng code terms trong dictionary.
- [x] Khi sửa audit scripts, đảm bảo định nghĩa mismatch/drift/current stock thống nhất.
- [x] Khi phát hiện thuật ngữ mới, cập nhật dictionary cùng commit.

### Phase 1 - Chuẩn hoá tài liệu và checklist audit

Trạng thái: done

Mục tiêu:

- Tạo một nguồn sự thật duy nhất cho toàn bộ giai đoạn tối ưu.
- Mỗi phase sau đều cập nhật lại file này hoặc tạo report con có link.

Task 1.1 - Viết roadmap tổng hệ thống:

- [x] Ghi baseline hiện tại.
- [x] Ghi các phase đã hoàn thành.
- [x] Ghi rủi ro còn lại.
- [x] Ghi backlog phase/task/subtask.

Task 1.2 - Commit roadmap:

- [x] Stage file roadmap.
- [x] Commit riêng (`aed15b8 docs: add domain dictionary`).
- [x] Không push.

Task 1.3 - Sau commit, chọn phase triển khai tiếp:

- [x] Ưu tiên Phase 2 nếu muốn chắc nghiệp vụ trước.
- [x] Ưu tiên Phase 6 nếu muốn dọn code/script trước.
- [ ] Ưu tiên Phase 7 nếu muốn tối ưu UX ngay.

### Phase 2 - Audit Nhập hàng end-to-end

Trạng thái: done

Mục tiêu:

- Đảm bảo mọi PO mới và PO lịch sử tạo stock ledger đúng.
- Không còn lỗi conversion mơ hồ.
- Đảm bảo UI gửi `conversion_id` và `conversion_rate` đúng.

Task 2.1 - Đọc và vẽ luồng nhập hàng:

- [x] `app/admin/inventory/purchase-orders/actions.ts`
- [x] `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`
- [x] `app/admin/inventory/purchase-orders/[id]/page.tsx`
- [x] `app/admin/inventory/items/actions.ts`
- [x] `app/admin/inventory/conversions/actions.ts`
- [x] `scripts/reprocess-all-po-ledger.ts`
- [x] `lib/purchase-ledger-audit.ts`
- [x] `lib/purchase-ledger-rebuild.ts`

Task 2.2 - Audit form submit:

- [x] Khi chọn purchased item, list conversion hiển thị đúng theo item.
- [x] Khi chọn unit/conversion, form lưu `conversion_id`.
- [x] `conversion_rate` không bị stale khi đổi unit/item.
- [x] Không cho lưu nếu conversion bị thiếu hoặc mơ hồ.
- [x] Error message tiếng Việt rõ ràng (Claude code — Phase 2.2: 4 messages trong `lib/purchase-ledger-rebuild.ts` chuyển từ tiếng Anh sang tiếng Việt).

Task 2.3 - Audit save PO:

- [x] PO draft không ghi stock ledger.
- [x] PO completed ghi stock ledger đúng một lần.
- [x] Update PO completed không tạo double ledger.
- [x] Huỷ/xoá PO nếu có workflow thì ledger đảo đúng hoặc bị chặn rõ.

  Claude code — Phase 2.3: `scripts/audit-po-save-ledger.ts` verify 36 completed POs đều có ledger đúng (0 missing, 0 mismatch).

Task 2.4 - Audit rebuild/reprocess:

- [x] Reprocess ưu tiên `conversion_id`.
- [x] Nếu thiếu `conversion_id` nhưng chỉ có 1 conversion hợp lệ thì có thể backfill.
- [x] Nếu nhiều conversion hợp lệ thì report ambiguous, không tự chọn.
- [x] Dry-run mặc định.
- [x] Apply cần flag rõ.

Task 2.5 - Test:

- [x] Unit test conversion resolution.
- [x] Unit test purchase ledger rebuild.
- [x] Data audit tất cả completed PO.
- [x] Regression test Dâu sấy.

Task 2.6 - Verify:

- [x] `scripts/audit-purchase-ledger.ts` mismatch `0`.
- [x] Test suite pass.
- [ ] Tạo thử PO mới trên dev server và kiểm tra ledger. (Cần UI manual test — defer.)

Task 2.7 - Guard đã triển khai trong phase này:

- [x] Khi đổi purchased item trên PO form, reset `unit`, `conversion_id`, `conversion_rate`.
- [x] Khi mở PO cũ thiếu `conversion_id`, chỉ tự restore conversion nếu có đúng một candidate.
- [x] Ẩn conversion `INACTIVE` khỏi dropdown nhập hàng mới.
- [x] `buildPurchaseReceipt` chặn `conversion_id` không thuộc purchased item của line.
- [x] Purchase ledger audit không resolve conversion nếu conversion thuộc item khác.
- [x] Không cho sửa core fields của conversion đã được PO line lịch sử tham chiếu.
- [x] Xoá conversion đã dùng trong lịch sử sẽ chuyển `status = INACTIVE` thay vì xoá record.

### Phase 3 - Audit Bán hàng, sửa đơn, huỷ đơn

Trạng thái: done

Mục tiêu:

- Đảm bảo order lifecycle không làm lệch revenue, promotion, inventory, COGS.
- Đảm bảo sửa đơn cũ dùng snapshot đúng.

Task 3.1 - Audit POS create order:

- [x] `app/pos/actions.ts`
- [x] Product price snapshot.
- [x] Variant snapshot.
- [x] Modifier snapshot.
- [x] Recipe snapshot.
- [x] Promotion snapshot.
- [x] Inventory ledger rows.
- [x] COGS FIFO.

Task 3.2 - Audit admin edit order:

- [x] `app/admin/orders/actions.ts`
- [x] Khi line cũ không đổi: giữ snapshot lịch sử.
- [x] Khi thêm line mới: dùng giá/công thức hiện tại.
- [x] Khi đổi quantity: dùng snapshot line đó, không lấy lại giá/công thức hiện tại nếu không cần.
- [x] Khi đổi modifier: snapshot mới chỉ áp dụng modifier được đổi/thêm.
- [x] Inventory ledger net correction đúng.
- [x] COGS FIFO sau edit không drift.

Task 3.3 - Audit cancel/void:

- [x] Huỷ đơn trả tồn đúng.
- [x] Không double-return stock.
- [x] Revenue report loại đơn huỷ.
- [x] COGS report loại đơn huỷ.
- [x] Event log đủ để truy vết.

  Claude code — Phase 3.3: `scripts/audit-void-orders.ts` verify 5 VOIDED + 4 SUPERSEDED orders đều có reversal entries match SALES_CONSUME, no double-reversal, all events have reasons.

Task 3.4 - Audit discounts:

- [x] System promotion.
- [x] Manual item discount.
- [x] Manual order discount allocation.
- [x] Edit order không mất promotion snapshot.
- [x] Tổng tiền detail modal khớp table/report.

  Claude code — Phase 3.4: `scripts/audit-order-total-consistency.ts` verify 886 COMPLETED orders — modal sum(line fields) = order.stored, table uses same `net_total`, P&L uses same. 0 mismatch.

Task 3.5 - Test:

- [x] Unit test order snapshot preservation (covered by `lib/order-edit-cart.test.ts` — `preserves submitted price snapshots`, `preserves submitted promo discount snapshot`).
- [x] Unit test edit cart math (covered by `lib/order-edit-cart.test.ts` — 9 tests).
- [x] Unit test order ledger net correction (covered by `lib/order-ledger-audit.test.ts` — 4 tests including superseded net-to-zero).
- [ ] E2E smoke: POS create -> admin detail -> edit -> audit (cần Playwright setup — defer).

Task 3.6 - Verify:

- [x] `scripts/audit-order-ledger.ts` mismatch `0`.
- [x] `scripts/audit-cogs-drift.ts` mismatch `0`.
- [x] `scripts/audit-order-discounts.ts` chạy được; 5 migrated orders có manual order discount lớn đã được user xác nhận là đơn cà phê đá cho nhân viên uống miễn phí, dữ liệu hợp lệ.
- [x] `scripts/audit-order-modifier-qty.ts` mismatch `0`.
- [x] `scripts/verify-v2-invariants.ts` pass `885`, fail `0`.
- [x] Tests pass.

Task 3.7 - Guard/tooling đã triển khai trong phase này:

- [x] Sửa `scripts/audit-order-discounts.ts` sang dynamic import để chạy được bằng `vite-node`.
- [x] Sửa `scripts/verify-v2-invariants.ts` sang dynamic import.
- [x] Chuyển import nội bộ trong `lib/order-math.ts` sang relative để script audit không lỗi alias.
- [x] Thêm `scripts/audit-free-discount-orders.ts` để audit chi tiết các đơn miễn phí cho nhân viên.

### Phase 4 - Audit tồn kho và sản xuất

Trạng thái: done

Mục tiêu:

- Tồn kho phản ánh đúng nguồn nhập hàng, bán hàng, sản xuất, điều chỉnh.
- Bán thành phẩm không bị trừ hai lần.

Task 4.1 - Audit stock ledger schema:

- [x] Source type chuẩn: purchase, sale, edit correction, production, adjustment.
- [x] Quantity sign chuẩn.
- [x] `unit_cost` có ý nghĩa rõ theo từng source.
- [x] `reference_id` đủ để truy ngược.

  Claude code — Phase 4.1: `scripts/audit-stock-ledger-schema.ts` verify 4050 ledger rows — 0 invalid types, 0 sign violations, 0 missing reference_id/item_reference/created_at.

Task 4.2 - Audit production:

- [x] `app/admin/production/actions.ts`
- [x] Sản xuất bán thành phẩm trừ nguyên liệu gốc đúng.
- [x] Sản xuất cộng bán thành phẩm đúng yield.
- [x] Không cho sản xuất nếu thiếu nguyên liệu hoặc có policy rõ.
- [x] Audit production stock mismatch.

  Claude code — Phase 4.2: `app/admin/production/actions.ts` writes `PRODUCTION_CONSUME` (negative qty) + `PRODUCTION_YIELD` (positive qty) đúng quy ước. `scripts/audit-production-stock.ts` verify 0 yield mismatch. Policy hiện tại: always allow + record (không có kiểm tra thiếu nguyên liệu — chấp nhận tồn âm).

Task 4.3 - Audit stock adjustments:

- [x] Tách adjustment thật với fix lịch sử.
- [x] Lý do điều chỉnh bắt buộc.
- [x] Report adjustment theo ngày/item.

  Claude code — Phase 4.3: `submitStockAdjustment` ở `app/admin/inventory/actions.ts` thêm validation `reason` không rỗng. `scripts/audit-stock-adjustments.ts` report hiện trạng.

Task 4.4 - Audit negative periods:

- [x] Không chỉ audit current stock.
- [x] Tìm khoảng thời gian âm theo từng item.
- [x] Phân loại âm do non-inventory: audit bỏ qua `is_non_inventory=TRUE` để không báo Trái tắc như tồn âm cần xử lý.
- [x] Phân loại âm do thiếu PO, do double deduct, do recipe sai.
- [x] Ưu tiên các item ảnh hưởng COGS.

  Claude code — Phase 4.4: `scripts/audit-negative-periods-classification.ts` phân loại 9 negative periods — tất cả `MIGRATION_GAP_NO_YIELD` (SP consume trước khi có PRODUCTION_YIELD, do migration V1→V2 không backfill production history). Tất cả 9 items affect COGS. Tất cả đã resolve (end_balance = 0).

Task 4.5 - Verify:

- [x] Current stock negative `0`.
- [x] Negative period report bỏ qua non-inventory và chỉ còn các giai đoạn âm lịch sử đã đóng.
- [x] Production audit clean: yield mismatches `0`, negative semi-products `0`.
- [x] Tests pass.

Task 4.6 - Guard/tooling đã triển khai trong phase này:

- [x] `scripts/audit-negative-stock-periods.ts` lọc non-inventory giống `scripts/audit-current-stock.ts`.
- [x] `scripts/audit-production-stock.ts` tính `STOCK_ADJUST`.
- [x] `scripts/audit-production-stock.ts` tính `EDIT_REVERSAL` để net consumption khớp ledger thật sau sửa/huỷ đơn.

### Phase 5 - Audit báo cáo doanh thu, COGS, P&L

Trạng thái: done

Mục tiêu:

- Báo cáo khớp ledger và order lines.
- Không còn chênh giữa modal đơn, table đơn, báo cáo doanh thu và P&L.

Task 5.1 - Audit report data source:

- [x] `app/admin/reports/actions.ts`
- [x] `lib/report-v2-allocators.ts`
- [x] Orders source.
- [x] Order lines source.
- [x] COGS source.
- [x] Discount allocation source.

Task 5.2 - Audit sales report:

- [x] Gross revenue.
- [x] Net revenue.
- [x] System promotion.
- [x] Manual discounts.
- [x] Payment methods.
- [x] Brand/outlet filters.
- [x] Category filter line-level revenue contract.

Task 5.3 - Audit P&L:

- [x] Revenue khớp active orders/lines.
- [x] COGS khớp FIFO stored line cost.
- [x] Gross profit đúng.
- [x] Date range inclusive/exclusive rõ.
- [x] Timezone Asia/Saigon rõ.
- [x] Category filter dùng line-level revenue, không lấy toàn bộ order revenue.

Task 5.4 - Audit stock report:

- [x] Current stock khớp ledger aggregation.
- [x] Unit hiển thị đúng.
- [x] Non-inventory item không làm nhiễu.

Task 5.5 - Verify:

- [x] `scripts/audit-revenue-anomalies.ts` chạy được và ghi `docs/audits/revenue-anomalies.json`.
- [x] `scripts/audit-report-v2-consistency.ts`: mismatches `0`.
- [x] `scripts/audit-cogs-drift.ts`: mismatches `0`.
- [ ] Manual compare vài ngày doanh thu lớn (cần dev server + UI — defer).
- [x] Tests pass.

Task 5.6 - Fix/guard đã triển khai trong phase này:

- [x] Sửa P&L category filter: `totalRevenue` và `orderCount` dùng line-level category scope.
- [x] Thêm regression test cho mixed-category order.
- [x] Sửa `scripts/audit-revenue-anomalies.ts` load `.env.local` đúng thứ tự bằng dynamic import.
- [x] Chuyển output revenue anomalies vào `docs/audits/revenue-anomalies.json`.
- [x] Thêm `scripts/audit-report-v2-consistency.ts` để kiểm tra raw V2 report contract.
- [x] Claude code — WS-12 fix: filter `SALES_CONSUME` + `EDIT_REVERSAL` trước `FIFOTracker.init()` ở 3 hàm (`breakdownCOGSByIngredient`, `breakdownCOGSBySource`, `splitLineCogsBySaleSource`). Sửa bug "Đào miếng" COGS = 0.
- [x] Claude code — Phase 5.3: thêm `lib/report-time.ts` với `toSaigonUtcRange`, apply ở 4 hàm report.
- [x] Claude code — Phase 5.2: thêm gross/discount/payment breakdown vào `SalesReportResult` và sales UI.
- [x] Claude code — Phase 5.4: `getRealtimeStock` filter `is_non_inventory=TRUE` khỏi UI stock report.

### Phase 5A - Chuyển chuẩn giá vốn từ FIFO sang MAC

Trạng thái: partial implementation

Mục tiêu:

- Tách bạch kiểm soát tồn kho theo số lượng với phương pháp định giá vốn.
- Tồn kho tiếp tục dùng `Stock_Ledger.quantity_change` làm nguồn sự thật.
- P&L chuyển sang dùng MAC/bình quân gia quyền được ghim vào `Order_Lines_V2.cost_at_sale` tại thời điểm tạo/sửa đơn.
- FIFO chỉ còn là audit/debug phụ, không còn là contract chính cho báo cáo.

Design note:

- `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`

Task 5A.1 - Chuẩn hoá quyết định:

- [x] Xác nhận với user: có thể kiểm soát tồn kho bằng quantity ledger và tính giá vốn bằng MAC.
- [x] Cập nhật `docs/domain-dictionary.md`: MAC là chuẩn giá vốn, FIFO là audit phụ.
- [x] Viết design note cho tách bạch inventory quantity và COGS valuation.

Task 5A.2 - Thiết kế MAC engine:

- [x] Tạo module MAC shared: `lib/mac-cogs.ts`.
- [x] Tính MAC từ `PO_RECEIPT`, `STOCK_ADJUST`, `PRODUCTION_YIELD` có giá vốn hợp lệ.
- [x] Khi stock bằng 0 hoặc âm, dùng latest known MAC thay vì trả COGS 0.
- [x] Hỗ trợ bán thành phẩm: direct BTP dùng MAC của BTP; nếu direct BTP chưa có MAC hợp lệ thì fallback theo recipe/yield để tránh COGS 0.

Task 5A.3 - Chuyển write path:

- [x] `app/pos/actions.ts` tính `cost_at_sale` bằng MAC thay vì FIFO.
- [x] `app/admin/orders/actions.ts` tính `cost_at_sale` bằng MAC khi sửa đơn.
- [x] Giữ nguyên `Stock_Ledger.quantity_change` cho tồn kho; không phụ thuộc FIFO để dự báo nhập hàng.

Task 5A.4 - Chuyển audit:

- [x] Thêm `scripts/audit-mac-cogs-drift.ts` dạng read-only dry-run.
- [x] Giữ FIFO audit như script phụ nếu còn cần điều tra.
- [x] P&L verify hiện vẫn đọc stored `Order_Lines_V2.cost_at_sale`; MAC write path ghim giá vốn tại sale/edit time.
- [x] Stock verify không phát sinh dependency vào FIFO; quantity vẫn đi theo ledger.

Task 5A.5 - Dữ liệu lịch sử:

- [x] Dry-run recompute MAC cho toàn bộ active order lines bằng `scripts/audit-mac-cogs-drift.ts`.
- [ ] Phân loại chênh lệch: do FIFO/MAC khác nhau, do BTP shortfall, do order header mồ côi, do ledger thiếu.
- [ ] Chỉ apply update `Order_Lines_V2.cost_at_sale` sau khi output dry-run được review.
- [ ] Script apply phải idempotent và có report trước/sau.

Task 5A.6 - Verify:

- [x] Unit test MAC nhiều PO receipt khác giá.
- [x] Unit test zero/negative stock fallback latest MAC.
- [x] Unit test BTP recipe fallback khi direct BTP MAC chưa có.
- [x] Unit test BTP partial shortfall ở allocation layer và MAC cost layer.
- [ ] MAC COGS drift clean hoặc được review/chấp nhận theo cutover policy.
- [ ] Current stock audit clean riêng về số lượng.
- [ ] P&L không còn COGS 0 do thiếu FIFO batch.

Codex implementation note:

- `lib/mac-cogs.ts` is now the shared MAC engine.
- `app/pos/actions.ts` and `app/admin/orders/actions.ts` now use `computeMacCostForConsumptionRows` for `cost_at_sale`.
- `app/pos/actions.test.ts`, `app/admin/orders/actions.test.ts`, and `lib/mac-cogs.test.ts` guard the new contract.
- `scripts/audit-mac-cogs-drift.ts` reports historical stored COGS drift against the new MAC contract. This is expected before the historical migration apply step and must be reviewed before any data write.

### Phase 6 - Dọn scripts và kiến trúc module

Trạng thái: partial (6.1 done, 6.2-6.5 defer)

Mục tiêu:

- Giảm nhiễu trong repo.
- Giữ lại các script có giá trị audit/runbook.
- Gom logic nghiệp vụ vào module sâu hơn, ít pass-through hơn.

Task 6.1 - Inventory scripts audit:

- [x] Liệt kê toàn bộ `scripts/*.ts`, `scripts/*.js`, output/log liên quan.
- [x] Phân loại từng script:
  - `KEEP_RUNBOOK`
  - `KEEP_AUDIT`
  - `KEEP_MIGRATION_HISTORY`
  - `DELETE_ONE_OFF`
  - `ARCHIVE_DOC_ONLY`
- [x] Tạo report `docs/audits/script-cleanup-plan.md`.

  Claude code — Phase 6.1: `scripts/generate-script-cleanup-plan.ts` phân loại 135 scripts — KEEP_AUDIT 26, KEEP_RUNBOOK 19, KEEP_MIGRATION_HISTORY 14, ARCHIVE_DOC_ONLY 25, DELETE_ONE_OFF 51.

Task 6.2 - Delete one-off scripts:

- [ ] Chỉ xoá script đã có replacement hoặc không còn dữ liệu sử dụng.
- [ ] Không xoá script có thể cần rollback hoặc audit dữ liệu lịch sử.
- [ ] Commit riêng.

  Claude code — Phase 6.2: **defer** — phân loại heuristic, cần user duyệt từng script trước khi xoá. Xoá là destructive operation, không tự quyết.

Task 6.3 - Deepen modules:

- [ ] Order lifecycle module: create/edit/void consistency.
- [ ] Inventory consumption module: stock deduction policy.
- [ ] Purchase ledger module: conversion resolution and ledger generation.
- [ ] Reporting module: shared allocation rules.
- [ ] Sheet adapter module: lower-case/PascalCase alias risk.

Task 6.4 - Test surface:

- [ ] Tests gọi module interface, không phụ thuộc chi tiết implementation.
- [ ] Giảm test chỉ mock từng helper nhỏ nếu không bắt được workflow thật.

Task 6.5 - Verify:

- [ ] Tests pass.
- [ ] Audit scripts pass.
- [ ] Git diff không xoá nhầm runbook.

### Phase 7 - Mobile-first UI/UX audit

Trạng thái: defer (cần dev server + manual test)

Mục tiêu:

- Màn hình chính dùng tốt trên mobile trước, desktop sau.
- Tránh card lồng card, text overflow, modal bị kẹt, bảng quá rộng.

Task 7.1 - Priority pages:

- [ ] POS.
- [ ] Admin Orders.
- [ ] Order detail modal.
- [ ] Order edit modal.
- [ ] Purchase Orders.
- [ ] Inventory stock.
- [ ] Products.
- [ ] Modifiers.
- [ ] Reports.

Task 7.2 - Layout rules:

- [ ] Mobile first: 360px minimum.
- [ ] Table desktop, card/list mobile.
- [ ] Modal full-screen mobile, centered desktop.
- [ ] Touch target tối thiểu 44px.
- [ ] Không text overlap.
- [ ] Không horizontal scroll ngoài khu vực có chủ đích.

Task 7.3 - POS:

- [ ] Product grid dễ bấm.
- [ ] Cart drawer mobile.
- [ ] Discount badges dễ phân biệt.
- [ ] Offline/slow network state rõ.
- [ ] Checkout không bị double submit.

Task 7.4 - Orders:

- [ ] Filter bar responsive.
- [ ] Table/card list rõ trạng thái đơn.
- [ ] Detail modal đọc nhanh tổng tiền, giảm giá, payment, event.
- [ ] Edit modal rõ line cũ/mới, lý do sửa bắt buộc.

Task 7.5 - Purchase Orders:

- [ ] Form nhập hàng mobile usable.
- [ ] Conversion/unit selection chống nhầm.
- [ ] Completed PO có cảnh báo ledger.
- [ ] Search supplier/item tốt.

Task 7.6 - Verify:

- [ ] Dev server smoke desktop.
- [ ] Dev server smoke mobile 360/375px.
- [ ] Screenshot check các màn chính.
- [ ] Tests pass.

### Phase 8 - Offline/sync audit

Trạng thái: defer (cần design approval trước khi implement)

Mục tiêu:

- Đảm bảo bán hàng không mất đơn khi mạng yếu/mất mạng.
- Sync không tạo duplicate order hoặc duplicate stock ledger.

Task 8.1 - Audit current offline capability:

- [ ] POS local state.
- [ ] Draft/order queue nếu có.
- [ ] API retry behavior.
- [ ] Idempotency key/order number generation.
- [ ] Sync scan/execute route.

Task 8.2 - Failure modes:

- [ ] Submit order thành công nhưng UI không nhận response.
- [ ] User bấm lại checkout.
- [ ] Network timeout giữa ghi order và ghi ledger.
- [ ] Sync lại sau khi app reload.
- [ ] Google Sheets rate limit.

Task 8.3 - Durable design:

- [ ] Idempotent order creation.
- [ ] Local pending queue.
- [ ] Sync status rõ: pending, synced, failed, duplicate-safe.
- [ ] Ledger write atomicity strategy hoặc reconciliation audit.

Task 8.4 - Verify:

- [ ] Manual offline test.
- [ ] Duplicate submit test.
- [ ] Audit order ledger sau sync.
- [ ] Audit revenue sau sync.

## 6. Thứ tự khuyến nghị

Thứ tự em đề xuất:

1. Phase 0 - Domain Dictionary & System Vocabulary.
2. Commit roadmap này.
3. Phase 2 - Audit Nhập hàng end-to-end.
4. Phase 3 - Audit Bán hàng, sửa đơn, huỷ đơn.
5. Phase 4 - Audit tồn kho và sản xuất.
6. Phase 5 - Audit báo cáo.
7. Phase 5A - Chuyển chuẩn giá vốn từ FIFO sang MAC.
8. Phase 6 - Dọn scripts/kiến trúc.
9. Phase 7 - Mobile-first UI/UX.
10. Phase 8 - Offline/sync.

Lý do:

- Nhập hàng và bán hàng là nguồn dữ liệu gốc.
- Tồn kho và COGS phụ thuộc ledger từ nhập/bán.
- Báo cáo phụ thuộc order/ledger/COGS.
- UI nên tối ưu sau khi nghiệp vụ ổn để không phải sửa lại nhiều.
- Offline/sync là phase có rủi ro cao, cần baseline audit trước.

## 7. Definition of Done toàn dự án tối ưu

Một phase chỉ được coi là done khi:

- Có file/code/report thể hiện thay đổi.
- Có audit trước/sau nếu đụng dữ liệu.
- Có test hoặc lệnh verify phù hợp.
- Có commit riêng.
- Không còn working tree bẩn ngoài phần user đang làm.
- Có ghi chú rủi ro còn lại nếu chưa xử lý triệt để.

Toàn bộ đợt tối ưu coi là done khi:

- Google Sheet không còn sheet review.
- Ledger nhập hàng, ledger đơn hàng, tồn kho, COGS đều audit sạch.
- Các workflow chính có test hoặc smoke checklist.
- Scripts một lần đã được phân loại/dọn.
- UI chính chạy tốt trên mobile 360px+.
- Dev server chạy được và user kiểm tra được.
