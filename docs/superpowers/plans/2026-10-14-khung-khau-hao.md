# Khung khấu hao: sửa cả bảng một lần (audit A4)

Rút gọn: sửa thứ đã có (`BR-COGS-008` đã hứa thêm, sửa, xoá khung). Không tạo bảng mới, không thêm thư mục ngoài `app/admin/inventory/asset-bands/edit/`.

## Vì sao

Mỗi lệnh hiện nay (`createAssetBand`, `updateAssetBand`, `deleteAssetBand`) kiểm cả dải giá sau một bước lẻ. Thêm một khung luôn chồng lên khung cũ; xoá một khung luôn để hở; dời một mốc luôn hở hoặc chồng với khung bên cạnh. Vậy chỉ đổi được số tháng; mọi việc khác bị từ chối.

Đo 2026-10-14 trên máy chủ: 3 khung, `KH-001` từ 0đ đến dưới 200.000đ là 12 tháng, `KH-002` từ 200.000đ đến dưới 500.000đ là 24 tháng, `KH-003` từ 500.000đ trở lên là 36 tháng. Cột `status` có nhưng không chỗ nào đọc.

## Ví dụ

Chủ quán muốn thêm khung "dưới 50.000đ: 6 tháng". Ở trang Sửa khung, bấm "Thêm khung", gõ mốc 50.000 và 12 tháng, rồi đổi dòng đầu từ 12 thành 6. Bấm Lưu một lần. Kết quả:

| Từ | Đến dưới | Số tháng |
|---|---|---|
| 0đ | 50.000đ | 6 |
| 50.000đ | 200.000đ | 12 |
| 200.000đ | 500.000đ | 24 |
| 500.000đ | (không giới hạn) | 36 |

Một món thiết bị giá 45.000đ mua sau lần lưu này được khấu hao 6 tháng. Tài sản đã có giữ nguyên số tháng (đã đóng băng lúc tạo, `BR-COGS-008`).

## Hiện trạng: năm câu

1. **Trạng thái.** Không áp dụng, vì một khung chỉ có hoặc không. Cột `status` không ai đọc, giữ nguyên.
2. **Nút.**
   - Trang danh sách có "Sửa khung", dẫn tới `/admin/inventory/asset-bands/edit`. Nút "Thêm khung" cũ (dẫn tới `new`) bị bỏ, vì nó luôn bị từ chối. Nút Xoá theo dòng và theo ô chọn cũng bị bỏ, vì cùng lý do.
   - Trang chi tiết: nút "Sửa" dẫn tới trang Sửa khung; nút "Xoá" bị bỏ.
   - Trang Sửa khung có:
     - "Thêm khung": thêm một dòng ở cuối, mốc để trống.
     - Nút thùng rác trên mỗi dòng: chỉ `ADMIN` thấy, và ẩn khi chỉ còn một dòng.
     - "Lưu" và "Bỏ".
   - Không có hộp bật lên.
3. **Danh sách.** Mọi khung, xếp theo mốc "Từ" tăng dần. "Đến dưới" không nhập; nó là mốc "Từ" của dòng kế tiếp. Dòng cuối không giới hạn. Nhờ vậy dải giá không bao giờ hở hay chồng.
4. **Ô nhập.**
   - "Từ giá": số nguyên đồng. Dòng đầu cố định 0, không sửa được. Các dòng sau phải lớn hơn dòng trước; trống, âm, có phần lẻ hoặc trùng thì bị từ chối kèm lời tiếng Việt.
   - "Số tháng": số nguyên từ 1 trở lên.
   - Máy chủ sắp xếp lại theo "Từ giá" trước khi kiểm, nên thứ tự gõ không quan trọng.
5. **Dữ liệu phục vụ.** Phục vụ bảng `asset_depreciation_bands` và lần tra khung lúc tạo hoặc sửa tài sản từ phiếu nhập. Cố ý không đụng tài sản đã có.

## Ai làm gì

**Sonnet, backend.**

- Migration `0118_replace_asset_depreciation_bands.sql` tạo hàm `replace_asset_depreciation_bands(p_bands jsonb)`.
  - `p_bands` là mảng `{id: text|null, min_unit_price: bigint, term_months: int}`.
  - Trong một giao dịch, hàm:
    1. khoá bảng;
    2. kiểm dòng đầu bằng 0 và các mốc tăng dần, nếu sai thì báo lỗi;
    3. tính `max_unit_price` bằng mốc của dòng kế (dòng cuối là null);
    4. sửa các dòng có id;
    5. xoá các dòng không còn trong mảng;
    6. thêm dòng mới, đặt mã `KH-NNN` dưới khoá cố vấn.
  - Hàm trả về danh sách id. Quyền: thu hồi từ `public`, `anon`, `authenticated`; cấp cho `service_role`.
- Server action `saveAssetBands(formData)` trong `app/admin/inventory/asset-bands/actions.ts`.
  - Đọc trường `bands` (JSON) và kiểm từng ô như câu 4.
  - Dựng `Band[]` rồi chạy `validateBands` (đã có) làm lưới thứ hai.
  - Lần lưu bỏ đi một id đang có thì cần `requireOwner` (`BR-ACCESS-003`), còn lại `requireAdmin`.
  - Gọi rpc qua một module trong `lib/assets/`, rồi `revalidatePath`.
- Gỡ `createAssetBand`, `updateAssetBand`, `deleteAssetBand` cùng test của chúng, sau khi Gemini gỡ chỗ gọi.
- Test viết trước. Ví dụ ở trên phải có mặt trong test.

**Gemini, giao diện.**

- Trang `app/admin/inventory/asset-bands/edit/page.tsx` cùng component của nó.
  - Máy tính: một bảng. Điện thoại: mỗi khung một thẻ.
  - "Đến dưới" hiện chữ chỉ đọc, cập nhật khi gõ.
- Bỏ các trang `new/` và `[id]/edit/`, `AddBandForm`, `BandEditForm`. Nút "Sửa" ở danh sách và ở chi tiết dẫn tới trang mới. Bỏ nút Xoá cũ.

**Opus.** Soát lại, chạy năm lệnh kiểm, hỏi chủ quán trước khi chạy migration `0118`.

Đã xem: `actions.ts`, `BR-COGS-008`, bảng trên máy chủ, danh sách file trong `asset-bands/`. Chưa xem: nội dung `BandsClient.tsx` ngoài các dòng nút, và chỗ tra khung trong `purchase-orders/actions.ts`; plan này không đổi chỗ tra khung.
