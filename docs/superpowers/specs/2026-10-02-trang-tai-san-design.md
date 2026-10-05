# Trang Tài sản dựng lại theo món đồ: thiết kế

Nguồn:
- Chủ quán, 2026-10-02, qua công cụ Góp ý trên trang Tài sản:
  - "Anh từng bị vỡ 1 bình bơm thuỷ tinh, thì cái này nên để cho hiện như thế nào thì mới phù hợp?"
  - "Anh cần góp ý lại và cải thiện trang tài sản."
  - Rồi trong chat: "trang đó sẽ xem như chưa tồn tại và đề xuất lại cách bố trí trang mới dựa theo các nguyên tắc khung trang chung".
- Khuôn chung: `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`, mục 2, 3 và 8.
- Luật giữ nguyên: `BR-COGS-008` trong `docs/02-rules/business-rules/cogs.md` (khấu hao theo giá một cái, thời hạn chốt lúc mua, thanh lý chỉ thêm dòng, tài sản sinh ra từ phiếu nhập), `BR-DATA-007` (không bật khung ô nhập), `BR-DATA-008` (sắp xếp theo cột).
- Luồng: `docs/03-workflows/assets.md`.

## 0. Chủ quán đã chốt (2026-10-02)

| Câu | Chốt |
|---|---|
| 1. Danh sách bày theo gì | **Mỗi dòng một món đồ** (gom theo mã hàng hoá), không phải mỗi lần mua. Ghi vào `cogs.md` cùng ngày |
| 2. Chia nhóm | **Một danh sách duy nhất**, bỏ ba nút "Còn dùng / Đã hết khấu hao / Đã thanh lý". Ô tick "Hiện cả món đã thanh lý hết", mặc định tắt |
| 3. Thanh lý một món có nhiều lần mua | **Chủ quán tự chọn lần mua**, máy chọn sẵn lần mua cũ nhất còn hàng. Món chỉ có một lần mua còn hàng thì không phải chọn |
| Bố cục trang chi tiết (mục 4) | Duyệt |

Chủ quán hỏi thêm: đồ vỡ thì phần giá trị chưa khấu hao đã vào báo cáo tài chính tháng vỡ chưa. Đã kiểm 2026-10-02, chạy chính `buildAssetSchedule` trên số thật:
- Bình bơm thuỷ tinh, TS-004: mua 2 cái ngày 04/04, tổng 411.840đ, 24 tháng, vỡ 1 cái ngày 02/07.
  - Tháng 7 tính 188.760đ, gồm 17.160đ khấu hao thường và 171.600đ giá trị còn lại của cái vỡ.
  - Từ tháng 8 tính 8.580đ/tháng. Cộng hết các tháng ra đúng 411.840đ.
- Cốc đong 100ml, TS-025: mua 2 cái ngày 27/03, tổng 25.000đ, 12 tháng, vỡ cả 2 ngày 02/07.
  - Tháng 7 tính 16.666,67đ. Cộng hết ra đúng 25.000đ.
- Báo cáo lãi lỗ đọc `asset_disposals` (`app/admin/reports/pnl/actions.ts`) rồi gọi cùng hàm này (`lib/reports/profit-and-loss.ts`, mục 5).
- Chưa xem: màn báo cáo lãi lỗ tháng 7 bằng mắt, vì dev server tắt lúc kiểm.

## 1. Hiện trạng: năm câu

1. **Trạng thái.**
   - Hiện nay: mỗi dòng tài sản là một lần mua (một dòng phiếu nhập thiết bị). Có ba nhóm suy ra từ số liệu: còn khấu hao, hết khấu hao, thanh lý hết. Cờ `INACTIVE` chỉ để giấu dòng nhập nhầm.
   - Sau khi sửa: món đồ là nhóm các dòng `assets` cùng `purchased_item_id`. Trạng thái của món suy ra như sau:
     - "Còn N cái": còn ít nhất 1 cái.
     - "Đã thanh lý hết": mọi lần mua đều đã thanh lý hết.
     - Món hết khấu hao vẫn là "Còn N cái" và có giá trị còn lại 0đ.
   - Không lưu trạng thái nào mới. Dòng `INACTIVE` vẫn loại khỏi mọi chỗ.
2. **Nút.**
   - **Danh sách:** "Thời hạn khấu hao" (nút phụ, đầu trang), "Lọc", "Xoá lọc", ô tick "Hiện cả món đã thanh lý hết", tên cột để sắp xếp.
     - Không có nút tạo, vì tài sản sinh từ phiếu nhập.
     - Không có thùng rác hay chọn nhiều, vì tài sản không xoá.
   - **Chi tiết:** "← Tài sản", "Thanh lý" (ẩn khi món đã thanh lý hết), "Xem hàng hoá" (mở `/admin/inventory/items/[mã]`). Không có "Chỉnh sửa", vì không có trường nào sửa tay.
   - **Trang thanh lý:** "Lưu" và "Huỷ". Cả hai về trang chi tiết món.
3. **Danh sách.**
   - Mỗi mã hàng hoá có ít nhất một dòng `assets` ACTIVE thì thành một dòng danh sách.
   - Mặc định loại món đã thanh lý hết. Tick ô thì hiện cả món đó.
   - Đo 2026-10-02: 84 dòng `assets` ACTIVE, 375 cái, gom thành 65 món. 33 dòng thuộc món mua nhiều lần. Không dòng nào thiếu mã hàng hoá hay thiếu dòng phiếu nhập.
   - Cũng đo 2026-10-02: không món nào thanh lý hết, vì TS-025 chỉ là một trong ba lần mua Cốc đong 100ml. Vậy mặc định hiện cả 65 món.
4. **Ô nhập.**
   - Ô tìm theo tên: không phân biệt hoa thường, nằm trên địa chỉ trang `?q=`.
   - Ô tick ghi trên địa chỉ trang là `?all=1`.
   - Số trang ngoài khoảng thì đưa về trang cuối, theo khuôn chung.
   - Trang thanh lý giữ đúng luật của `disposeAsset` hiện có: số lượng từ 1 đến số còn lại của **lần mua đã chọn**, ngày từ ngày mua của lần đó đến hôm nay. Ngoài khoảng thì máy từ chối và nói rõ, không tự sửa số.
5. **Phục vụ dữ liệu nào.**
   - Phục vụ: sổ thiết bị theo món, khấu hao, thanh lý.
   - Cố ý không đụng:
     - cách tính khấu hao (`lib/assets/asset-depreciation.ts`);
     - báo cáo lãi lỗ;
     - trang Thời hạn khấu hao;
     - cách sinh tài sản từ phiếu nhập.
   - Không tạo bảng, không migration, không đổi số nào trên báo cáo.

Thêm, riêng cho việc này:
6. **Tên món lấy ở đâu.** Lấy tên hiện tại trong Hàng hoá. Mỗi lần mua trong bảng "Các lần mua" vẫn hiện `name_snapshot` lúc mua nếu khác tên hiện tại. Đo 2026-10-02: 0 dòng khác tên.
7. **Giá lệch trong một món.** Ví dụ Dụng cụ lọc trà mua 5 lần, giá từ 27.983đ tới 273.484đ, có thể thực ra là các dụng cụ khác nhau đang chung một mã. Trang không tự tách. Chủ quán tách mã ở Hàng hoá nếu muốn. Trang chi tiết bày từng lần mua kèm giá để nhìn ra chỗ này.
8. **Đường dẫn cũ.** `/admin/inventory/assets/TS-xxx` chuyển sang trang của món chứa lần mua đó. Đường dẫn `.../TS-xxx/dispose` cũng chuyển sang trang thanh lý của món, chọn sẵn đúng lần mua đó.

Đã xem:
- Mã nguồn trang danh sách, chi tiết, thanh lý hiện có; `actions.ts` (`getAssetsData`, `getAssetDetail`, `previewDisposalCharge`, `disposeAsset`).
- Luồng `assets.md`; `BR-COGS-008`.
- Số thật qua truy vấn chỉ đọc.

Chưa xem:
- Trang ở cỡ 1024px và 390px. Dev server tắt.
- Thời gian tải khi gom 84 dòng. Nhỏ nên không đo.

## 2. Danh sách `/admin/inventory/assets`

- **Đầu trang:** "Kho / Tài sản"; nút phụ "Thời hạn khấu hao" bên phải. Trên điện thoại nút chiếm hết bề ngang.
- **Khung lọc:** ô tìm tên, ô tick "Hiện cả món đã thanh lý hết", "Lọc" (Enter cũng lọc), "Xoá lọc".
- **Máy tính, từ 768px:** bảng gồm các cột sau.

| Cột | Giá trị | Sắp xếp theo | Cột phụ (ẩn dưới 1280px) |
|---|---|---|---|
| Mã hàng | `purchased_item_id` | phần số của mã | |
| Tên | tên hàng hoá | chữ tiếng Việt | |
| Còn / Đã mua | "6 / 8 cái" | số còn | |
| Đã thanh lý | "2 cái", 0 thì "—" | số đã thanh lý | có |
| Giá trị còn lại | tổng các lần mua, làm tròn khi hiện | số | |
| Mua gần nhất | ngày mua mới nhất, dd/mm/yyyy | ngày | có |

  Món đã thanh lý hết, khi đang hiện, có nhãn xám "Đã thanh lý hết" cạnh tên.
- **Điện thoại: thẻ.**
  - Dòng 1: tên.
  - Dòng 2: "Còn 1 / mua 2 · Đã thanh lý 1".
  - Dòng 3: giá trị còn lại.
  - Có ô "Sắp xếp" như các danh sách khác. Cả thẻ là vùng chạm.
- **Mặc định:** xếp theo mã hàng tăng dần, 20 dòng một trang. Sắp xếp, trang và lọc đều nằm trên địa chỉ trang. Từ chi tiết quay về vẫn giữ nguyên.
- **Không có kết quả:** "Không có tài sản nào khớp bộ lọc" kèm "Xoá lọc".

## 3. Chi tiết `/admin/inventory/assets/[mã hàng]`

- **Đầu trang:** "← Tài sản", tên món, mã hàng, nhãn "Đã thanh lý hết" nếu đúng. Nút: "Thanh lý", "Xem hàng hoá".
- **Khối thông tin** (nhãn trái, giá trị phải; điện thoại nhãn trên, giá trị dưới):
  - Mã hàng, Tên.
  - Còn / Đã mua.
  - Đã thanh lý.
  - Tổng tiền đã mua: cộng `total_cost`.
  - Đã khấu hao đến nay: tính đến hết tháng hiện tại, cùng cách `getAssetDetail` đang tính.
  - Giá trị còn lại.
- **Bảng "Các lần mua"**, xếp theo ngày mua tăng dần:
  - Mã tài sản (TS-xxx).
  - Ngày mua.
  - Phiếu nhập: mã phiếu, bấm mở trang phiếu.
  - Còn / Mua.
  - Giá một cái.
  - Thời hạn.
  - Giá trị còn lại.
- **Bảng "Thanh lý"**, xếp theo ngày:
  - Ngày.
  - Lần mua: ngày mua và mã TS.
  - Số lượng.
  - Lý do, trống thì "—".
  - **Tiền dồn vào chi phí tháng đó.**
    - Số này lấy từ `buildAssetSchedule`: khấu hao tháng thanh lý **có** lần thanh lý đó trừ khấu hao tháng đó **không có** nó, của đúng lần mua đó.
    - Một lần mua có nhiều lần thanh lý cùng tháng thì tách theo từng lần, cộng lại vẫn ra đúng.
    - Không lưu số này, tính lại mỗi lần mở.
- **Bảng "Khấu hao theo tháng":**
  - Cột: Tháng, Số cái giữ, Khấu hao, đều cộng gộp các lần mua.
  - Tháng có thanh lý ghi thêm dòng nhỏ "gồm 171.600đ thanh lý".
  - Chỉ hiện tháng có khấu hao lớn hơn 0.
- **Điện thoại:** mọi bảng thành thẻ, nút cao 44px.
- **Mã không có hoặc không có tài sản ACTIVE:** trang 404.

## 4. Thanh lý `/admin/inventory/assets/[mã hàng]/dispose`

- Đầu trang: "← tên món", tiêu đề "Thanh lý: tên món".
- **Chọn lần mua:**
  - Danh sách các lần mua còn hàng, mỗi lần ghi ngày mua, giá một cái và số còn.
  - Chọn sẵn lần cũ nhất, hoặc lần mua mà đường dẫn cũ `TS-xxx` chỉ tới.
  - Chỉ còn một lần mua còn hàng thì hiện thành dòng chữ, không cần chọn.
- Ô nhập: số lượng, ngày, lý do. Giữ nguyên form `DisposeAssetForm` hiện có, chỉ thêm phần chọn lần mua.
- Xem trước "Tiền sẽ dồn vào chi phí tháng mm/yyyy". Gọi `previewDisposalCharge` với đúng mã TS đã chọn. Đổi lần mua thì tính lại.
- "Lưu" gọi `disposeAsset` với mã TS đã chọn. Không thêm server action ghi mới.
- Món đã thanh lý hết thì trả 404.

## 5. Phần máy chủ

Chỉ thêm hàm đọc, không ghi gì mới:
- `getAssetItemsData()`: danh sách món, gom từ cùng dữ liệu `getAssetsData` đang đọc.
- `getAssetItemDetail(itemId)`: khối thông tin, các lần mua, các lần thanh lý kèm tiền dồn vào chi phí, khấu hao gộp theo tháng. Trả `null` nếu không có lần mua ACTIVE.
- `findItemIdForAsset(assetId)`: dùng cho chuyển hướng đường dẫn cũ.
- Phép kiểm gộp: tổng các lần mua phải bằng con số của món.

Phần giao diện giao Gemini, phần máy chủ giao Sonnet; tách hai phiếu (`CLAUDE.md` "Ai viết code").

## 6. Kiểm thế nào

- **Máy chủ:**
  - Gom ra đúng 65 món từ 84 dòng: chạy thử chỉ đọc trên số thật, báo kèm mẫu số.
  - Cốc đong 100ml ra "còn 6 / mua 8 / thanh lý 2".
  - Bình bơm có tiền dồn vào chi phí là 171.600đ. Cốc đong lô TS-025 là 14.583,33đ.
  - Với mọi món: tổng khấu hao các tháng bằng tổng tiền mua.
- **Giao diện:**
  - Danh sách không có nhóm, mặc định xếp theo mã, ô tick ẩn hoặc hiện món thanh lý hết.
  - Bấm dòng sang `/[mã hàng]?returnTo=`.
  - Trang thanh lý chọn sẵn lần cũ nhất. Đổi lần mua thì gọi xem trước với đúng mã TS.
  - Đường dẫn TS cũ chuyển hướng đúng.
  - `page.test.tsx` kiểm không truyền hàm qua props.
- **Phép kiểm canh:** `app/admin/list-template.test.ts` vẫn xanh.
- **Mở bằng mắt** ở 1568px, 1024px và 390px: danh sách, chi tiết Bình bơm, chi tiết Dụng cụ lọc trà, trang thanh lý. **Không bấm Lưu thanh lý trên dữ liệu thật.**
- Cập nhật `docs/03-workflows/assets.md` cùng lần lưu code.
