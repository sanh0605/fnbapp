# Bước 2 và 3 — Menu 7 nhóm và khuôn trang chung: thiết kế

Trạng thái: **chờ chủ quán duyệt** (viết 2026-09-29). Chưa code gì.

Nguồn: biên bản phỏng vấn `docs/superpowers/specs/2026-09-28-cai-to-he-thong.md`,
mục 5.3–5.6, 5.12–5.15, và mục 6 (bước 2, 3). Luật ngày giờ: `BR-DATA-006`. Bản mẫu
anh đã bấm thử: https://claude.ai/artifact/FNbaFdDRe1hN7i49LWXf88.

Đã xem: `app/admin/layout.tsx`, `app/admin/nav-allowlist.ts`,
`app/admin/nav-guard.test.ts`, `app/globals.css`, `tailwind.config.ts`,
`lib/shared/datetime.ts`, `components/ui/CustomDatePicker.tsx`,
`app/pos/components/ProductGrid.tsx`, `app/admin/clear-cache/page.tsx`, tiêu đề từng trang
quản trị, và kiểu lưu ngày của 34 bảng (đo 29/09). Chưa xem: từng trang báo cáo bên
trong, cách `public/pos-sw.js` giữ font và file kiểu dáng sau khi đổi. Việc thứ hai phải
kiểm lúc làm, xem mục 7.

## 1. Hiện trạng — năm câu

1. **Trạng thái.**
   - Menu có ba trạng thái hiện nay: một nhóm đang mở (tự mở theo trang đang xem),
     menu trượt ra trên điện thoại (bấm nút ba gạch), và menu luôn hiện trên màn từ
     768px.
   - Sau bước này có thêm hai trạng thái:
     - **Thu gọn / mở rộng** trên máy tính và iPad. Máy nhớ lựa chọn trên từng máy.
     - **Tấm "Thêm"** trên điện thoại, đang mở hoặc đang đóng.
2. **Nút.**
   - "Mở máy bán hàng": luôn nằm đầu menu trên máy tính, kể cả khi thu gọn (còn biểu
     tượng). Trên điện thoại nó nằm ngoài cùng bên phải thanh dưới đáy. Bấm là hỏi mở
     ở điểm bán nào, như hiện nay (`app/admin/components/PosOutletPicker.tsx`).
   - Nút thu gọn menu: chỉ có trên máy tính và iPad.
   - Nút "Thêm": chỉ có trên điện thoại.
   - Nút ba gạch hiện nay bị bỏ.
   - Nút "Tạo" trên trang danh sách phiếu: chỉ hiện khi người đang xem được phép tạo
     loại phiếu đó, theo quyền hiện có. Bước này không đổi quyền.
3. **Danh sách.**
   - Menu chứa đúng các trang đang có.
   - Tồn kho và Lưu chuyển tiền tệ chưa có trang, nên chưa vào menu. Bước 6 dựng
     xong thì thêm.
   - Loại khỏi menu, nhưng trang vẫn còn và vẫn mở được:
     - "Xoá cache": máy đã tự làm mới khi lưu.
     - "Bảng quy đổi": vào từ trang Hàng hoá.
     - "Đơn cần chú ý": vào từ cảnh báo ở Tổng quan, như hiện nay.
   - Danh sách phiếu nhập chứa mọi phiếu, cả nháp lẫn hoàn thành, mỗi trang 20
     phiếu. Mới nhất ở trên theo ngày ghi trên phiếu.
4. **Ô nhập.**
   - Ô "Từ ngày" và "Đến ngày" nhận đúng một ngày dạng `dd/mm/yyyy`. Chọn trên lịch
     hoặc gõ.
   - Gõ sai (31/02/2026, chữ, thiếu số): ô báo đỏ "Ngày không hợp lệ", danh sách giữ
     nguyên.
   - "Từ" sau "Đến": báo "Ngày bắt đầu phải trước ngày kết thúc", không lọc.
   - Ô tìm nhận chữ bất kỳ, tối đa 100 ký tự, không phân biệt hoa thường (như hiện
     nay). "cà phê" không tìm ra "ca phe": hiện nay cũng vậy, bước này không thêm.
   - Số trang ngoài khoảng (ví dụ trang 99 khi chỉ có 10 trang): đưa về trang cuối.
5. **Dữ liệu phục vụ.**
   - Bước này chỉ đổi cách hiện: menu, màu, chữ, khung trang, cách hiện ngày giờ, và
     danh sách phiếu nhập làm trang mẫu.
   - Cố ý không đụng: cách tính giá vốn, tồn kho, tiền; dữ liệu trong 34 bảng; logic
     máy bán hàng.
   - Không tạo bảng mới, không chạy migration.

## 2. Menu 7 nhóm (bước 2)

Tên mục là tên trang. Tiêu đề trên đầu mỗi trang đổi theo, để bấm "Phiếu nhập" thì
thấy trang tên "Phiếu nhập", không phải "Quản lý Nhập Hàng".

| Nhóm | Mục (tên mới ← tên cũ) | Đường dẫn giữ nguyên |
|---|---|---|
| Tổng quan | (một trang, không có mục con) | `/admin` |
| Bán hàng | Đơn hàng | `/admin/orders` |
| | Món ← Danh sách Món | `/admin/products` |
| | Nhóm món ← Danh mục Nhóm | `/admin/products/categories` |
| | Topping & tuỳ chọn ← Topping & Tùy chọn | `/admin/products/modifiers` |
| | Khuyến mãi | `/admin/promotions` |
| | Thương hiệu | `/admin/brands` |
| | Điểm bán | `/admin/outlets` |
| Nhập hàng | Phiếu nhập ← Đơn Nhập Hàng | `/admin/inventory/purchase-orders` |
| | Nhà cung cấp | `/admin/suppliers` |
| Kho | Phiếu xuất ← Phiếu Xuất Kho | `/admin/inventory/issue-slips` |
| | Kiểm kê ← Kiểm Kê Định Kỳ | `/admin/inventory/stocktake` |
| | Hàng hoá ← Hàng Mua Vào | `/admin/inventory/items` |
| | Tài sản ← Sổ Tài Sản | `/admin/inventory/assets` |
| | Thời hạn khấu hao ← Bảng Thời Hạn Khấu Hao | `/admin/inventory/asset-bands` |
| | Đơn vị tính ← Quản lý Đơn vị | `/admin/inventory/units` |
| | Phân loại hàng ← Phân loại Hàng | `/admin/inventory/categories` |
| Thu chi | Sổ thu chi | `/admin/finance` |
| | Nhóm thu chi | `/admin/finance/categories` |
| | Tài khoản ngân hàng | `/admin/finance/bank-accounts` |
| Báo cáo | Tổng kết ngày | `/admin/reports/daily` |
| | Doanh số ← Báo cáo Bán hàng | `/admin/reports/sales` |
| | Hàng đã xuất ← Giá trị hàng đã xuất | `/admin/reports/issued` |
| | Lãi lỗ ← Báo cáo tài chính | `/admin/reports/pnl` |
| Cài đặt | Nhân viên & quyền ← Nhân sự & Phân quyền | `/admin/users` |
| | Nhật ký hoạt động | `/admin/activity-log` |

- **Không đổi đường dẫn nào.** Trang đã lưu dấu trang, liên kết trong cảnh báo, và
  phép kiểm menu vẫn đúng.
- **"Bảng quy đổi" vào từ trang Hàng hoá:** thêm một nút "Bảng quy đổi" cạnh tiêu
  đề trang Hàng hoá. Gộp hẳn hai trang làm một để sau, khi bước 4 hoặc 7 đụng tới.
- **"Xoá cache" ra khỏi menu, trang vẫn giữ.** Lý do: máy đã tự làm mới khi lưu
  món, lưu phiếu. Trang này chỉ còn là đường lui khi số hiện chưa kịp đổi. Ghi vào
  danh sách trang không có trên menu (`app/admin/nav-allowlist.ts`), kèm lý do.
- Menu khai báo **một chỗ** (một file danh sách mục, ví dụ `app/admin/nav-items.ts`).
  Menu máy tính, thanh dưới đáy điện thoại và tấm "Thêm" cùng đọc từ đó. Phép kiểm
  menu (`app/admin/nav-guard.test.ts`) đổi sang đọc file này thay cho `layout.tsx`.

## 3. Khuôn trang chung (bước 3)

### 3.1 Màu — 4 vai trò, cố định (Q8, Q8b)

| Vai trò | Màu | Dùng cho |
|---|---|---|
| Nền | `#F7F5F0` | nền trang; thẻ và bảng nền trắng `#FFFFFF` |
| Chữ | `#1F1B16` | chữ; nút "Mở máy bán hàng" (nền nâu đen, chữ trắng) |
| Màu chính | `#8A5A1F` | nút chính, mục đang chọn, nhãn trạng thái; nền nhạt `#F2E8D8` |
| Đỏ | `#B3261E` | lỗi, cảnh báo, số âm, nút xoá |

Ngoài 4 màu còn hai sắc trung tính, không tính là màu: chữ phụ `#5E574E` và đường
kẻ `#E4DFD5`.

**Cách làm:** giữ nguyên tên màu trong code, chỉ đổi giá trị ở một chỗ
(`app/globals.css`). Tên màu hiện dùng 1.851 lần trong 137 file giao diện (đo 29/09), nên
viết lại từng chỗ là việc lớn mà không đổi gì thấy được.

| Tên màu hiện có | Thành |
|---|---|
| primary, primary-soft, focus-ring | màu chính và nền nhạt của nó |
| page, background | nền |
| text-primary, foreground | chữ |
| text-secondary, text-muted | chữ phụ |
| surface-card | trắng |
| surface-secondary, border | đường kẻ |
| sidebar (xanh rêu đậm) | trắng: menu sáng như bản mẫu |
| success (xanh lá), processing (xanh ngọc) | màu chính |
| warning (cam), danger | đỏ |
| accent-cyan (không còn chỗ dùng), chart-profit | bỏ; biểu đồ dùng màu chính |

**Ảnh hưởng chéo anh cần biết:**
- Báo cáo **Lãi lỗ**: tháng lời đang tô xanh lá, sẽ thành nâu; tháng lỗ vẫn đỏ. Hai
  màu vẫn phân biệt rõ.
- Các nhãn "Hoàn thành" đang xanh lá, sẽ thành nâu trên nền nâu nhạt.
- Cảnh báo cam thành đỏ.
- Biểu đồ tròn ở **Doanh số** đang có 10 màu viết thẳng trong code. Sẽ đổi thành các
  sắc đậm nhạt của màu chính. Biểu đồ tròn nhiều nhóm sẽ khó phân biệt hơn, nên
  phần chú thích cạnh hình phải ghi tên nhóm và phần trăm, xếp theo đúng thứ tự
  các phần trên hình. Chú thích hiện đã có đủ tên và phần trăm, nên giữ nguyên.
  Phần trăm đang ghi một số lẻ, dùng dấu chấm, lệch `BR-DATA-005`; sửa khi tới
  trang Doanh số, không làm ở bước này.

### 3.2 Chữ — Be Vietnam Pro cho mọi thứ (Q8)

- Một kiểu chữ cho cả tiêu đề, chữ thường, con số, và máy bán hàng.
- Bỏ Outfit (thiếu dấu tiếng Việt) và Plus Jakarta Sans.
- Tải font kèm theo trang, không gọi sang Google mỗi lần mở. Như vậy máy bán hàng mất
  mạng vẫn hiện đúng chữ.
- Con số trong bảng dùng dạng chữ số đều bề ngang, để cột tiền thẳng hàng.
- Việc mở trong danh sách việc chưa xong (đổi font từ Outfit, `app/globals.test.ts`)
  đóng lại ở bước này.

### 3.3 Menu trên máy tính và iPad (màn từ 768px)

- **Mở rộng (272px):** logo, nút thu gọn, nút "Mở máy bán hàng", Tổng quan, 6 nhóm
  xổ ra được, tên người dùng và "Đăng xuất" ở đáy. Nhóm của trang đang xem tự mở.
  Mỗi lúc chỉ mở một nhóm.
- **Thu gọn (76px):** còn nút mở rộng, biểu tượng "Mở máy bán hàng", và biểu tượng
  từng nhóm. Rê chuột vào thì hiện tên. Nhóm của trang đang xem được tô nền nhạt.
  Bấm biểu tượng một nhóm thì menu mở rộng ra và mở sẵn nhóm đó, giống bản mẫu.
- Máy nhớ thu gọn hay mở rộng trên từng máy. Xoá dữ liệu trình duyệt thì về mặc định
  mở rộng.

### 3.4 Menu trên điện thoại (màn dưới 768px)

- **Thanh cố định dưới đáy, 5 ô, theo thứ tự:** Tổng quan, Phiếu nhập, Phiếu xuất,
  Thêm, Máy bán hàng. Ô Máy bán hàng là nút tròn nâu đen nhô lên (mục 5.14).
- Ô của trang đang xem tô màu chính.
- **Tấm "Thêm":** trượt lên từ đáy, liệt kê đủ 6 nhóm với mọi mục, rồi tên người dùng
  và "Đăng xuất". Đóng bằng nút ×, bấm ra ngoài, hoặc nút quay lại của điện thoại.
- **Đầu trang:** tên trang và nút chính của trang (ví dụ "Tạo"). Không còn nút ba
  gạch.
- Thanh dưới chừa chỗ cho vạch vuốt của iPhone. Nội dung trang không bị thanh che
  mất dòng cuối.
- Trong màn máy bán hàng không có thanh dưới (mục 5.13). Máy bán hàng nằm ngoài khung
  quản trị nên việc này tự đúng.

### 3.5 Khuôn trang danh sách phiếu — làm mẫu trên Phiếu nhập

Anh chọn trang phiếu nhập làm chuẩn. Nó lại là trang chưa chia trang, nên bước 3
dựng khuôn và áp ngay lên trang này. Bước 4 áp khuôn cho Phiếu xuất, Kiểm kê, Sổ thu
chi.

- **Đầu trang:** nhóm (chữ nhỏ), tên trang, nút "Tạo phiếu nhập" bên phải.
- **Thanh lọc:**
  - Ô tìm theo mã phiếu, nhà cung cấp, tên mặt hàng, hoặc mã của nhà cung cấp.
  - Trạng thái (Tất cả, Nháp, Hoàn thành).
  - Nhà cung cấp.
  - Từ ngày và Đến ngày.
  - Lọc chạy khi bấm "Lọc" hoặc Enter. Có nút "Xoá lọc".
- **Bảng trên máy tính:**
  - Cột: Mã phiếu, Ngày nhập, Nhà cung cấp, Nguồn mua, Trạng thái, Tổng tiền (canh
    phải).
  - Bấm bất kỳ đâu trên dòng là mở phiếu. Dùng bàn phím (Tab rồi Enter) cũng được.
    Không có cột "Xem".
- **Thẻ trên điện thoại:**
  - Dòng 1: mã phiếu và tổng tiền.
  - Dòng 2: nhà cung cấp.
  - Dòng 3: ngày giờ · nguồn mua, và nhãn trạng thái.
  - Bấm cả thẻ là mở phiếu.
- **Thứ tự:** ngày ghi trên phiếu, mới nhất ở trên. Hai phiếu cùng ngày giờ thì phiếu
  tạo sau đứng trên. Tự quyết, vì 164 phiếu cùng giờ 00:00:00 nên hay trùng.
- **Chia trang:**
  - 20 phiếu một trang, lấy từ máy chủ từng trang, không tải hết một lần.
  - Chân bảng ghi "1–20 trên 191 phiếu", có nút trước, sau và số trang.
  - Số trang nằm trên đường dẫn, nên mở phiếu rồi bấm quay lại thì về đúng trang
    đang xem.
- **Không có phiếu nào khớp bộ lọc:** "Không có phiếu nào khớp bộ lọc", kèm nút "Xoá
  lọc".

Trang chi tiết phiếu **không** làm khuôn chung ở bước 3. Chi tiết mỗi loại phiếu khác
nhau: phiếu nhập mở ra là màn sửa, kiểm kê là bảng đếm. Bước 4 làm từng loại, có bản
mẫu riêng cho anh xem trước. Đây là chỗ khác so với mục 6 của biên bản, nơi bước 3 có
ghi "trang chi tiết phiếu".

### 3.6 Ngày giờ (`BR-DATA-006`)

- **Một hàm hiện ngày giờ dùng chung:** `dd/mm/yyyy HH:mm:ss`, giờ Sài Gòn. Ví dụ
  "28/09/2026 16:13:06".
- **Chỗ lưu không có giờ hiện 00:00:00.** Bốn loại ngày chỉ lưu ngày: ngày bắt đầu
  của thương hiệu, ngày mua tài sản, ngày thanh lý, ngày trong sổ thu chi. Hàm hiện
  chúng là "28/09/2026 00:00:00".
  - Phải làm đúng chỗ này, vì cách làm hiện nay sẽ ra 07:00:00: máy hiểu "ngày 28"
    là nửa đêm giờ quốc tế, cộng 7 tiếng.
  - Phải có phép kiểm riêng.
- **Bộ lọc chỉ chọn ngày.** Lịch và ô gõ đều hiện `dd/mm/yyyy`. Không dùng ô ngày có
  sẵn của trình duyệt, vì nó hiện theo ngôn ngữ của máy (có máy hiện tháng trước
  ngày).
- "Từ 01/09/2026 đến 29/09/2026" nghĩa là từ 00:00:00 ngày 01/09 tới hết 23:59:59
  ngày 29/09, giờ Sài Gòn.
- **Lỗi đang có, bước này sửa luôn:** bộ lọc "Từ ngày" của phiếu nhập hiện đọc ngày
  anh chọn là 07:00 sáng giờ Sài Gòn
  (`app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`). Phiếu
  ghi lúc 00:00:00 đúng ngày bắt đầu (164 trên 191 phiếu có giờ này) bị lọc mất. Ví
  dụ: lọc từ 23/09 thì không thấy PO-188.
- Bước 3 làm hàm và ô chọn ngày, áp cho Phiếu nhập và menu. Các trang khác đổi khi
  bước của chúng đụng tới (bước 4–7). Hiện 17 file giao diện tự định dạng ngày theo
  cách riêng. Danh sách này nằm trong kế hoạch, mỗi bước gạch dần, bước 7 dọn phần
  còn lại.

### 3.7 Máy bán hàng

- Máy bán hàng nhận màu và chữ mới, vì dùng chung bộ màu. Không đổi bố cục, không
  đổi logic.
- Tab "Bán chạy" vẫn đứng đầu và được chọn sẵn (mục 5.14).
- Nút chọn nhóm món đang có bóng tím nhạt (`shadow-indigo-100`), màu lạc bộ. Bỏ.

## 4. Ai làm gì

| Phần | Ai | Gồm |
|---|---|---|
| Giao diện | Gemini qua `agy` | Menu, thanh dưới đáy, tấm Thêm, thu gọn menu, màu, font, khuôn danh sách, ô chọn ngày, đổi tiêu đề trang, nút "Bảng quy đổi" |
| Máy chủ | Sonnet | Hàm hiện ngày giờ (gồm trường hợp chỉ có ngày); lấy phiếu nhập theo trang, lọc, đếm tổng; chuyển khoảng ngày lọc sang giờ Sài Gòn; phép kiểm cho các việc này |
| Thiết kế, kế hoạch, soát lại | Opus | |

Mỗi phần một phiếu giao việc. Phần máy chủ làm trước, vì trang danh sách cần nó.

## 5. Phép kiểm phải có

Đỏ trên bản chưa sửa trước khi làm (luật `CLAUDE.md`):

- Menu có đúng 7 nhóm, đúng tên, đúng thứ tự trong mục 2. Mọi mục trỏ tới trang có
  thật. Mọi trang có mục hoặc có lý do trong danh sách ngoại lệ.
- Hàm ngày giờ:
  - "2026-09-28" ra "28/09/2026 00:00:00".
  - "2026-09-22T17:00:00Z" ra "23/09/2026 00:00:00".
  - Giờ có giây giữ đúng giây.
- Khoảng lọc 01/09–29/09 bắt được phiếu lúc 00:00:00 ngày 01/09 và lúc 23:59:59 ngày
  29/09, không bắt phiếu lúc 00:00:00 ngày 30/09.
- Trang 2 của phiếu nhập trả đúng phiếu thứ 21–40 theo thứ tự mục 3.5. Tổng đếm bằng
  số phiếu thật. Đo 29/09: 191 phiếu. Đo lại lúc làm.
- Trong code giao diện không còn mã màu nào ngoài bộ màu ở mục 3.1.
- Font: không còn Outfit, Plus Jakarta Sans.

## 6. Ví dụ tính sẵn bằng số thật (đo 29/09)

Trang 1 danh sách phiếu nhập, 191 phiếu. Năm dòng đầu:

| Mã phiếu | Ngày nhập | Nhà cung cấp | Nguồn mua | Tổng tiền |
|---|---|---|---|---|
| PO-191 | 28/09/2026 16:13:06 | Không rõ | Mua ngoài | 165.000đ |
| PO-190 | 24/09/2026 14:03:37 | Vinamilk | Mua ngoài | 54.864đ |
| PO-189 | 24/09/2026 10:48:18 | Không rõ | Mua ngoài | 165.000đ |
| PO-188 | 23/09/2026 00:00:00 | Không rõ | Mua ngoài | 300.000đ |
| PO-187 | 21/09/2026 00:00:00 | Không rõ | Mua ngoài | 100.000đ |

- Dòng thứ 20 là PO-163 (04/09/2026 00:00:00).
- PO-188 là phiếu chỉ nhập ngày. Bản mẫu trước ghi nó là 22/09, sai một ngày, đúng
  kiểu lỗi mục 3.6 phải chặn.

## 7. Rủi ro và việc phải kiểm lúc làm

- **Máy bán hàng:**
  - Chỉ đổi màu và chữ, không đổi cách nhận đơn.
  - Máy bán hàng giữ sẵn file kiểu dáng để chạy khi mất mạng (`public/pos-sw.js`),
    nên có thể cần tải lại một lần mới thấy màu mới. Phải thử: mở máy bán hàng, tắt
    mạng, tải lại, chữ và màu vẫn đúng.
  - Nếu cần đổi `public/pos-sw.js` thì báo anh trước khi đưa lên, vì đó là phần giữ
    máy bán hàng chạy khi mất mạng.
- **Chữ dài trên menu thu gọn:** tên nhà cung cấp dài (ví dụ "CÔNG TY TNHH SẢN XUẤT
  THƯƠNG MẠI DỊCH VỤ THẾ KỶ XANH") trong bảng phải cắt bằng dấu "…", không đẩy vỡ cột.
- **Xong khi:** anh mở được mọi trang từ menu trên cả máy tính và điện thoại, thu gọn
  rồi mở lại menu được, và danh sách phiếu nhập hiện đúng 5 dòng ở mục 6.
