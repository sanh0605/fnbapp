# Bỏ trạng thái "Đã xoá" (DELETED) khỏi mọi bảng gốc

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mỗi thứ chỉ còn hai trạng thái, đang dùng (`ACTIVE`) và ngừng (`INACTIVE`); thứ chưa từng dùng thì xoá hẳn. Không còn hàng "đã xoá" nằm ẩn trong bảng.

**Spec:** `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md` (ghi dữ liệu 3: "Then drop DELETED from the status vocabulary"; Square giữ một cờ xoá duy nhất), `docs/superpowers/specs/2026-10-15-kho-de-xuat.md` (ghi dữ liệu 1: đơn vị "DELETED_gram"; đợt cấu trúc: "Drop DELETED from the six master status checks"). Luật dữ liệu trong `CLAUDE.md`: thứ có lịch sử thì ngừng dùng, thứ chưa dùng thì xoá hẳn, chỉ `ADMIN` xoá hẳn (`requireOwner()`).

**Thiết kế rút gọn:** sửa thứ đã có. Hai chỗ code còn ghi `DELETED` đổi sang xoá hẳn hoặc ngừng dùng; một lần ghi dữ liệu đổi hàng `DELETED` cuối cùng; một migration bỏ `DELETED` khỏi 13 luật kiểm; bỏ các bộ lọc `!== "DELETED"` và `DELETED_` thành thừa.

## Global Constraints

- Thứ tự bắt buộc (mỗi bước chủ quán duyệt riêng, gộp hỏi một lần):
  1. ghi dữ liệu: `MOD-007` và `U-001`;
  2. đẩy code (code không còn ghi `DELETED`);
  3. chạy migration `0125`.
  Chạy migration trước bước 2 thì nút xoá tuỳ chọn và xoá nhóm món sẽ báo lỗi.
- Ghi dữ liệu dùng skill `fnbapp-bulk-data-change`: chạy thử mặc định, `--apply` mới ghi, in số dòng trước khi ghi.
- Máy bán hàng không bị ảnh hưởng: nó chỉ đọc tuỳ chọn `ACTIVE` (`app/pos/page.tsx:71`).
- Ponytail: không viết thừa code. Năm cửa kiểm xanh.

## Hiện trạng

Đo 2026-10-15 trên máy chủ và mã nguồn.

1. **Trạng thái.** 13 bảng có luật kiểm cho phép `DELETED`: `brands`, `item_categories`, `modifiers`, `product_categories`, `product_variants`, `products`, `promotions`, `purchase_sources`, `purchased_items`, `suppliers`, `units`, `uom_conversions`, `users`. Chỉ **1 hàng** đang `DELETED`: tuỳ chọn Dâu sấy `MOD-007` (nhóm `MG-001`, gắn món `PROD-035`; bản đang dùng là `MOD-008`). Ngoài ra đơn vị `U-001` tên "DELETED_gram", trạng thái `ACTIVE`, không ai dùng (đề xuất Kho đo 2026-10-15), bị giấu bằng tên chứ không bằng trạng thái.
2. **Nút.**
   - "Xoá" tuỳ chọn (`deleteModifierAction`, `app/admin/products/modifiers/actions.ts:105`) hôm nay đặt `DELETED`, ai có quyền sửa cũng bấm được. Sau: tuỳ chọn **chưa bán lần nào** thì xoá hẳn, chỉ chủ quán; tuỳ chọn **đã bán** thì không xoá, chỉ "Ngừng dùng" (đặt `INACTIVE`). Luật chặn món đang bán riêng giữ nguyên.
   - "Xoá" nhóm món (`deleteProductCategory`, `app/admin/products/categories/actions.ts:112`, qua `softDeleteEntity`) hôm nay đặt `DELETED` khi nhóm không còn món. Sau: xoá hẳn (nhóm rỗng không có lịch sử; khoá ngoại từ món giữ an toàn), chỉ chủ quán.
   - Bộ lọc "Đã xoá" trên danh sách Món (`ProductsClient.tsx:425`) và nhánh `DELETED` ở trang chi tiết món bỏ đi.
3. **Danh sách.** Các danh sách lọc `status !== "DELETED"` (đếm 50 chỗ đọc chữ `"DELETED"` trong `app`, `lib`, `components`, không tính test) giữ đúng nội dung vì không còn hàng nào như vậy; bỏ bộ lọc cho gọn. Sáu chỗ lọc tên `DELETED_` của đơn vị bỏ sau khi `U-001` đã ngừng; đơn vị `INACTIVE` hiện là "Ngừng dùng" ở danh sách Đơn vị tính và không được mời chọn ở các form mới (kiểm như hàng hoá ở Kho bước 4).
4. **Ô nhập.** Không có ô mới. Migration từ chối mọi trạng thái ngoài `ACTIVE`, `INACTIVE` (và giá trị riêng đã có của `users` nếu có — Sonnet đọc định nghĩa từng luật kiểm trước khi viết).
5. **Phục vụ dữ liệu nào.** 13 bảng gốc trên, cột `status`; đơn vị `U-001`. Cố ý không đụng: trạng thái của đơn, phiếu, kiểm kê (`VOIDED`, `CANCELLED`…), vì đó là trạng thái của việc đã xảy ra, không phải của danh mục.

Thêm cho việc này:

6. **Ai đọc kết quả của thứ bị gỡ?** Người ghi `DELETED`: 2 chỗ trên (`softDeleteEntity` chỉ một người gọi; gỡ hàm luôn nếu không còn ai). Người đọc: 50 chỗ, toàn là bộ lọc hoặc nhánh hiện chữ "Đã xoá"; `lib/products/standalone-topping-links.ts:32` bỏ qua tuỳ chọn `DELETED` — sau đổi thành bỏ qua tuỳ chọn không `ACTIVE`? **Không**: nó dùng để nối tuỳ chọn với món bán riêng; tuỳ chọn `INACTIVE` vẫn phải nối được để món không mồ côi. Sonnet đọc kỹ và giữ đúng nghĩa cũ (chỉ bỏ qua thứ đã bị xoá hẳn, tức không còn trong bảng).
7. **"Đã bán" của tuỳ chọn đo thế nào?** Dùng đúng cách trang món và trang nhóm tuỳ chọn đang hỏi máy chủ tuỳ chọn nào đã bán (đợt 3 Bán hàng, `app/admin/products/modifier-groups/actions.ts:97` và hàm máy chủ đi kèm). Không viết cách đếm mới.
8. **Hàm Postgres nào đọc `DELETED`?** Sonnet grep `supabase/migrations/` bản mới nhất của từng hàm; nếu hàm nào lọc `<> 'DELETED'` thì để nguyên (vô hại) và ghi lại.

Ví dụ: tuỳ chọn Dâu sấy `MOD-007` đổi từ `DELETED` sang `INACTIVE`; danh sách Tuỳ chọn hiện thêm một dòng "Dâu sấy — Ngừng dùng" bên cạnh `MOD-008` đang dùng. Máy bán hàng vẫn chỉ thấy `MOD-008`. Đơn vị "DELETED_gram" `U-001` đổi sang `INACTIVE` và tên "gram (cũ)"; danh sách Đơn vị tính hiện nó là "Ngừng dùng".

Đã xem: 13 luật kiểm trên máy chủ, số hàng `DELETED` từng bảng, 50 chỗ đọc, 2 chỗ ghi, `app/pos/page.tsx:71`, `catalog.md` ghi chú về hai dòng Dâu sấy. Chưa xem: định nghĩa đủ của luật kiểm `users` (có thể có giá trị khác), hàm Postgres có đọc `DELETED` không, test hiện có của hai nút xoá.

## Phiếu S5 (Sonnet)

- [ ] Test trước: `deleteModifierAction` với tuỳ chọn chưa bán → xoá hẳn, chỉ chủ quán (vai khác bị từ chối); đã bán → từ chối "Tuỳ chọn {tên} đã có trong đơn; chọn Ngừng dùng thay vì xoá."; không bao giờ ghi `DELETED`. `deleteProductCategory` → xoá hẳn, chỉ chủ quán. Nêu rõ đỏ vì giá trị sai hay thiếu hàm.
- [ ] Sửa hai hàm; gỡ `softDeleteEntity` nếu không còn ai gọi.
- [ ] Nếu tuỳ chọn chưa có hàm đổi `ACTIVE`/`INACTIVE` thì thêm `setModifierStatus(formData)` cùng kiểu `setSupplierStatus` (Kho bước 4); có rồi thì dùng lại.
- [ ] Script `scripts/retire-deleted-leftovers.ts` theo skill `fnbapp-bulk-data-change`: xoá hẳn hai dòng `MOD-007` và `U-001` (chủ quán 2026-10-15 "Xoá hẳn"), chỉ khi chưa bán và không nơi nào tham chiếu. Chạy thử in 2 dòng; chưa `--apply`.
- [ ] Migration `supabase/migrations/0125_drop_deleted_status.sql`: với từng luật trong 13, đọc định nghĩa hiện tại, viết lại không có `DELETED`. Chưa chạy. Test chữ migration trong `tests/migrations/` canh 13 luật.
- [ ] Bỏ các bộ lọc `!== "DELETED"`, `=== "DELETED"`, `DELETED_` trong code máy chủ và trang (`page.tsx`, `actions.ts`, `lib/`); giữ đúng nghĩa ở `standalone-topping-links.ts` (câu 6).
- [ ] `npx tsc --noEmit`, `npx vitest run`. Không commit.

### Quyết định sau S5 (Opus, 2026-10-15)

- **Cỡ món giữ `DELETED`.** Hàm lưu món đang chạy (`save_product_atomic`, 0119) vẫn đặt cỡ bị bỏ thành `DELETED`; migration `0125` để nguyên luật kiểm `product_variants` (12/13 bảng). Việc sau: hàm lưu món mới, cỡ chưa bán thì xoá hẳn, cỡ đã bán thì `INACTIVE`. Sai thì giá: một bảng còn chữ cũ, không hỏng gì.
- **Ngừng tuỳ chọn có bán riêng: ngừng cả hai.** Chủ quán chốt 2026-10-15 (*"Ngừng cả hai"*, thay quyết định ban đầu của Opus là chỉ ngừng phần thêm): một lần lưu đặt tuỳ chọn và món bán riêng của nó cùng `INACTIVE`, trong một hàm Postgres (phiếu S5b). Muốn chỉ bán riêng thì bật lại "Bán độc lập". "Dùng lại" chỉ bật phần thêm.
- **Xoá tuỳ chọn chưa bán gắn với món bán riêng đã ngừng: cho phép.** Món ở lại như một món ngừng bán thường, không còn công tắc bán độc lập; sửa hay bán lại theo trang Món. Sai thì giá: chủ quán phải tạo lại tuỳ chọn nếu muốn nối lại.
- **Báo cáo nhận tên tuỳ chọn** (`report-helpers.ts`): trước ưu tiên bản không `DELETED`, nay ưu tiên bản `ACTIVE` — giữ đúng nghĩa khi Dâu sấy `MOD-007` thành `INACTIVE`.

## Phiếu G5 (Gemini)

- [ ] `ProductsClient.tsx`: bỏ lựa chọn "Đã xoá" khỏi bộ lọc trạng thái và khỏi `VALID_STATUSES`.
- [ ] `ProductDetailView.tsx`: bỏ nhánh `DELETED`.
- [ ] Trang chi tiết tuỳ chọn: "Xoá" chỉ hiện khi chưa bán và người xem là chủ quán; thêm "Ngừng dùng"/"Dùng lại" nếu chưa có (gọi hàm của S5). Trang nhóm món: "Xoá" chỉ chủ quán.
- [ ] `ModifierGroupForm.tsx`, `SalesFilter.tsx`, `report-helpers.ts`: bỏ so sánh `DELETED`.
- [ ] Test giao diện đi kèm; máy tính và điện thoại.

## O5 (Opus)

- [ ] Soát; năm cửa kiểm; `BR-CATALOG` ghi chú Dâu sấy cập nhật; luật xoá tuỳ chọn ghi vào `catalog.md`.
- [ ] Gộp hỏi chủ quán: ghi dữ liệu → đẩy → migration, theo đúng thứ tự trên.
