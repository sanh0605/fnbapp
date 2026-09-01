# Dựng lại nền tài liệu và quy trình cho toàn dự án

**Viết 2026-09-02 bởi Opus 5. Cập nhật cùng ngày sau bốn vòng phỏng vấn.**
Bước 1+2 của `CLAUDE.md` §1b — đặc tả và thiết kế. **Chưa phải kế hoạch triển
khai.**

**Status: chờ chủ quán duyệt.** Chưa duyệt thì chưa ai được bắt tay làm.

**Chủ quán yêu cầu 02/09**, ưu tiên cao nhất, gác mọi việc khác. Ông ấy yêu cầu
**phỏng vấn trước khi lập kế hoạch** — bốn vòng, kết quả ở §2.

---

## 1. Vì sao làm việc này — đo, không phải cảm tính

### 1.1 Quy mô hiện tại (đo 02/09)

| | |
|---|---:|
| Kế hoạch triển khai | **101 file** |
| Tài liệu thiết kế | **34 file** |
| File kiểm toán | **100 file, 12 MB** |
| Bản giao việc | 3 file |
| Tài liệu lẻ trong `docs/` và gốc kho | **13 file** |
| Nhật ký phát triển | **9.252 dòng** |
| Script chạy tay | **226 file** (216 file `.ts`) |
| Mã nguồn | 291 file + 233 file kiểm |
| Migration | 96 file |
| Màn hình | 35 file `page.tsx` |

### 1.2 Bằng chứng nền tài liệu đang hỏng — lấy từ chính tháng này

**Không phải suy đoán. Đây là những lần thật, có ngày:**

| Ngày | Chuyện gì |
|---|---|
| 24/08 | Một bản thiết kế chủ quán duyệt 28/07 **bị viết lại từ đầu** vì không ai tra |
| 27/08 | Suýt lặp lại, lần này với bản duyệt 27/07 |
| 26/08 | `CLAUDE.md` ghi *"giá vốn 0đ"* — **sai từ 09/08**, chủ quán là người phát hiện |
| 31/08 | Tôi bỏ qua quy trình 4 bước **hai lần trong một ngày** |
| 01/09 | Phép quét của tôi loại nhầm hàm huỷ đơn — báo *"0 hàm còn dùng"* hai lần |
| 01/09 | Danh sách việc treo còn 2 mục đã xong từ 2-3 ngày |
| 02/09 | Ba đợt migration tôi báo *"chưa chạy"* thật ra **đã chạy** |

**Mẫu chung của cả bảy:** tài liệu mô tả một trạng thái, hệ thống ở trạng thái
khác, **và không có gì báo cho ai biết**.

### 1.3 Cái gì đã hoạt động, và vì sao

Trong cùng tháng đó, **những luật do máy canh chưa hỏng lần nào**: phép kiểm
`check-rules-current`, phép kiểm menu, `verify-revenue`, và bốn cửa `CLAUDE.md`
§9.

**Đây là căn cứ cho quyết định §2.3.** Không phải sở thích — là thứ đã đo được.

---

## 2. Chủ quán đã chốt gì — phỏng vấn 02/09

**Ghi nguyên văn lựa chọn, vì đây là căn cứ cho mọi việc phía sau.**

### Vòng 1

**2.1 Xoá sạch `docs/audits/`** — 100 file, 12 MB. Đã nói trước hậu quả và chủ
quán vẫn chọn. Vòng 3 hỏi lại lần hai với số đo cụ thể: **giữ nguyên** (§2.13).

**2.2 Xoá thẳng hồ sơ cũ, không gộp nội dung.** 101 kế hoạch + 34 thiết kế + 3
giao việc + nhật ký 9.252 dòng. Không đọc lại để rút nội dung.

*Hệ quả bắt buộc, và nó định hình cả đợt:* bộ tài liệu mới **phải viết từ mã
nguồn và dữ liệu đang chạy**, không được chép lại từ hồ sơ cũ. Thực ra sạch hơn
— hồ sơ cũ chính là thứ đã sai bảy lần ở §1.2.

`docs/BUSINESS-RULES.md` (478 dòng) **không** nằm trong danh sách xoá.

**2.3 Máy canh tối đa, văn bản là phụ.**

> Mỗi quy tắc quan trọng phải có một phép kiểm tự động đi kèm, **không thì không
> được coi là luật**.

**2.4 Tài liệu trước, chuyển chỗ mã nguồn sau.** Đợt này không di chuyển file mã
nguồn nào trong `app/`, `lib/`, `components/`.

**2.5 Đặc tả theo luồng việc, không theo màn hình.**

**2.6 Hai bản đồ, và bản vẽ tay phải có phép kiểm canh.**

> *"Cả 2, nhưng phải đảm bảo cập nhật theo kịp với thông tin mới nhất."*

**2.7 Xoá hết script rồi dựng lại.**

> *"Xóa hết rồi xây dựng lại xong liên tục cập nhật theo mã nguồn."*

*Một chỗ tôi làm ngược thứ tự chữ:* trong 226 file đó có `scripts/verify-revenue.ts`
và `scripts/check-rules-current.ts` — **hai cửa kiểm bắt buộc của `CLAUDE.md`
§9**. Xoá trước là có một quãng không còn gì canh doanh thu. **Dựng bộ mới
trước, chứng minh chạy được, RỒI mới xoá bộ cũ.**

### Vòng 2

**2.8 Trong 13 file tài liệu lẻ, chỉ `README.md` sống.**

> *"Chỉ giữ riêng README.md nhưng cần cập nhật lại nội dung mới nhất hiện tại,
> còn lại xóa hết và em tìm giải pháp để xây lại sao cho đúng với những gì đã
> code theo logic mới."*

Áp cho: `CONTEXT.md`, `docs/ACCESS-MODEL.md`, `docs/COMPLETED.md`,
`docs/domain-dictionary.md`, `docs/FEATURE-CATALOG.md`,
`docs/FILE-ORGANIZATION.md`, `docs/OPEN-ITEMS.md`, `docs/TESTING.md`,
`docs/operations/` (4 file), `docs/reports/` (2 file), `docs/runbooks/` (1 file).

*Chỗ phải cẩn thận:* `docs/runbooks/restore-from-backup.md` là cách khôi phục dữ
liệu khi hỏng — dựng lại nội dung đó từ công cụ sao lưu thật rồi mới xoá bản cũ.
Nơi ở mới: `docs/04-operations/INCIDENT-RESPONSE.md`.

**2.9 Mười luồng việc, phủ hết 35 màn hình.** Sáu luồng đề xuất ở vòng 1 chỉ phủ
**13 trên 35**. Đo lại `app/` ra 19 màn hình không thuộc luồng nào, cộng bảng
tổng quan và hai trang chuyển hướng.

**2.10 Sửa code mà không cập nhật tài liệu luồng → chặn cứng.**

> *"Chặn cứng — không qua cửa kiểm."*

Cái giá đã nói trước và chủ quán vẫn chọn: sửa đổi nhỏ không đổi hành vi cũng bị
bắt chạm tài liệu.

**2.11 Mỗi việc treo là một phép kiểm đang đỏ.**

**2.12 Năm đợt, chủ quán duyệt sau mỗi đợt.** Đợt 5 (xoá) duyệt riêng lần nữa.

### Vòng 3

**2.13 Xoá cả 5 file dữ liệu sao lưu — hỏi lại lần hai, chủ quán giữ nguyên.**

`docs/audits/` không đồng nhất: **94 file điều tra (~6,5 MB)** và **5 file dữ
liệu sao lưu thật (5,4 MB)** — sổ kho đã xoá (5,09 MB), công thức và bán thành
phẩm (27/08 và 31/08), sổ kho và bảng số dư trước lúc xoá (31/08), một ảnh chụp
trước khi ghi (27/06).

Đã đề xuất chuyển 5 file đó lên chỗ sao lưu rồi mới xoá. **Chủ quán chọn: xoá
hết, kể cả 5 file dữ liệu.**

*Hậu quả đã nói trước và ông ấy chấp nhận:* sau đợt này không còn cách trả lời
*"công thức món X hồi tháng 6 là gì"* — kể cả từ git cũng phải đi đào. **Chủ ý,
không phải sơ suất.**

**2.14 Tiêu chí "đáng lưu".**

> *"Quan trọng nhất là đúng hiện trạng và luôn được cập nhật theo thông tin mới
> nhất thì mới là thứ đáng lưu, còn lại là đáng xóa nếu đã không còn tác dụng gì
> nữa hoặc đã chết."*

Tiêu chí này **thay thế** danh sách bốn thứ đáng lưu ở bản trước, và loại bỏ
chính một mục tôi từng đề xuất. Viết lại ở §7.

### Vòng 4

**2.15 Đối chiếu với bộ khung ERP của một bên tư vấn.** Chủ quán đưa một cây thư
mục ERP chuẩn để hỏi bộ này đã chuẩn chưa. Kết quả đo ở §3.1b: lấy về ba thứ, bỏ
hai thứ.

**2.16 Tên file bằng tiếng Anh, thư mục đánh số.**

> *"Anh cũng muốn các file md sẽ đặt theo tiếng anh để hiểu đúng nghĩa hơn."*

**2.17 Nội dung chia theo người đọc.** File chủ quán đọc thường xuyên viết tiếng
Việt; file chỉ máy và DEV đọc viết tiếng Anh. Đúng luật đang có trong `CLAUDE.md`
§1, và phần tiếng Anh tốn ít token hơn.

**2.18 Tối ưu cách viết.**

> *"Các file này cũng nên tối ưu cách viết thì vận hành mới có thể mượt mà."*

Năm luật viết ở §3.3, bốn trong năm cái máy canh được.

**2.19 Chú thích trong code trỏ tới hồ sơ sắp xoá.** Đo: **242 file** trỏ tới
`docs/superpowers/plans/`, 36 tới `docs/audits/`, 16 tới `docs/superpowers/specs/`.

*Tôi đã nói quá ở lần đầu và tự sửa:* đọc mẫu thật cho thấy phần lớn chú thích
**đã tự mang lý do**, dòng trỏ tới kế hoạch chỉ là dòng ghi nguồn. Cái mất nhỏ
hơn tôi trình bày.

Chủ quán nói không hiểu câu hỏi. Giải thích lại bằng ví dụ thật, và **tôi tự
quyết vì đây là việc kỹ thuật**: đợt 5 gỡ dòng địa chỉ chết, giữ nguyên lý do,
không đụng một dòng code chạy nào. Chủ quán duyệt cùng lúc với duyệt xoá.

---

## 3. Thiết kế bộ tài liệu mới

### 3.1 Nguyên tắc: mỗi tài liệu trả lời một câu hỏi có thật

Không viết tài liệu vì "nên có". Mỗi file dưới đây tồn tại vì có một câu hỏi cụ
thể mà hôm nay **không ai trả lời nhanh được**.

### 3.1b Đối chiếu với bộ khung ERP (§2.15)

**Dự án này là ERP một phần** — đo 02/09:

| Phân hệ bên tư vấn đề xuất | Ở đây |
|---|---|
| Kho: đa kho, Lot/Serial, định giá vốn | **Một nửa.** Có định giá vốn bình quân. Một kho dùng chung, không lô/serial |
| Mua: PR → PO → kiểm nhận | **Một nửa.** Có đơn nhập và nhận hàng, không có đề xuất mua và duyệt nhiều cấp |
| Bán: báo giá, công nợ, hạn mức | **Một phần.** Bán mang đi thu tiền ngay |
| Kế toán: định khoản Nợ/Có, sổ cái, khoá sổ | **Không có gì.** 0 bảng định khoản. Chữ "ledger" ở đây là sổ kho, đã xoá 28/08 |
| Nhân sự: chấm công, lương | **Không có gì.** 0 kết quả |
| `api-contracts.md` | **Không áp dụng.** 4 đường API và cả 4 là hạ tầng; giao diện thật là 32 file server action |
| — | **Tài sản và khấu hao: có, bên tư vấn không nhắc** |

**Lấy về ba thứ:** đánh số thư mục để có thứ tự đọc; danh sách trường hợp biên
(`EDGE-CASES`) — nhưng **máy sinh từ phép kiểm nghiệp vụ**, không viết tay; và
ghi rõ một cái bẫy tên gọi (§3.2c).

**Bỏ hai thứ:** phân hệ không tồn tại (kế toán, nhân sự) — viết tài liệu cho thứ
không có là tạo ra thứ chắc chắn sai; và cặp `workflows.md` + `03_modules/*.md`,
**hai chỗ tả cùng một thứ** — đúng cơ chế đã hỏng bảy lần ở §1.2.

**Chỗ bên tư vấn thiếu, và là chỗ quyết định:** không một dòng nào về phép kiểm
tự động. Đó là sơ đồ tủ hồ sơ. Vấn đề ở đây chưa bao giờ là xếp hồ sơ ở đâu — mà
là hồ sơ **nói sai**. `CLAUDE.md` nằm đúng chỗ suốt 19 ngày và sai suốt 19 ngày.

### 3.2 Chín chỗ người viết, hai file máy sinh

```
CLAUDE.md                          luật làm việc + chỉ đường          [EN]
README.md                          chạy máy thế nào                   [EN]
docs/
├── 01-system/
│   ├── SYSTEM-OVERVIEW.md         quán là gì                         [VI]
│   ├── SYSTEM-MAP.md              sửa đâu đụng đâu                   [EN]
│   └── SYSTEM-MAP.generated.md    bảng, cột, ràng buộc, server action [EN]
├── 02-rules/
│   ├── GLOSSARY.md                từ này nghĩa là gì                 [VI]
│   ├── BUSINESS-RULES.md          tiền tính thế nào, vì sao          [VI]
│   └── EDGE-CASES.generated.md    trường hợp biên                    [VI]
├── 03-workflows/                                                     [EN]
│   ├── sales.md               purchasing.md        stock-issue.md
│   ├── stocktake.md           assets.md            reports.md
│   ├── product-catalog.md     inventory-catalog.md
│   └── users.md               operations.md
└── 04-operations/
    ├── INCIDENT-RESPONSE.md       hỏng rồi làm gì                    [EN]
    └── OPEN-ITEMS.md              cái gì chưa xong                   [VI]
```

Đuôi `.generated.md` là cố ý: **nhìn tên là biết không được sửa tay.** Hai file
đó không tính là chỗ phải bảo trì.

`docs/04-operations/INCIDENT-RESPONSE.md` là chỗ thứ chín, thêm ở vòng 3: khôi
phục dữ liệu, máy POS không đồng bộ, migration chạy sai, web không dựng được.
Đây là thứ đọc lúc đang cuống — chôn trong tài liệu mô tả màn hình thì lúc cần
không ai tìm ra.

### 3.2b Ba ranh giới cứng

**Nếu không đặt thì ba chỗ sẽ thành bản sao của nhau — đúng cách `CLAUDE.md` đã
hỏng.**

1. **`SYSTEM-OVERVIEW.md` chỉ được nói về quán** — hai điểm bán, hai thương hiệu,
   bán mang đi, kho dùng chung, tiền vào tiền ra ở mức khái niệm. **Cấm liệt kê
   tính năng**, vì liệt kê tính năng là biến nó thành bản tóm tắt của 10 luồng.
2. **`BUSINESS-RULES.md` giữ công thức và lý do; tài liệu luồng chỉ được trỏ tới
   mã luật** (`BR-COGS-005`), **cấm chép lại công thức.** Máy kiểm được.
3. **Cấu trúc dữ liệu không có tài liệu tay** — lấy thẳng từ máy chủ vào
   `SYSTEM-MAP.generated.md`.

### 3.2c Một cái bẫy tên gọi phải ghi rõ

`lib/sheets_db.ts` — **tên nói Google Sheets, ruột là Supabase**, và **86 file
đang gọi nó**. Người mới đọc tên file sẽ hiểu sai ngay ngày đầu. Hiện không tài
liệu nào nói điều này. `SYSTEM-OVERVIEW.md` và `SYSTEM-MAP.md` phải nói.

### 3.3 Năm luật viết (§2.18)

| Luật | Máy canh |
|---|---|
| Khối khai báo máy đọc được đặt đầu file, văn xuôi xuống dưới | **Có** — thiếu khối là đỏ |
| **Trần 200 dòng mỗi file.** Dài hơn nghĩa là đang trộn hai việc | **Có** — đếm dòng |
| Bảng thay văn xuôi ở mọi chỗ liệt kê được | Không — người đọc phải bắt |
| Không nhắc lại thứ file khác đã nói, chỉ trỏ sang | **Có** — ba ranh giới §3.2b |
| Mọi khẳng định về số liệu phải kèm **lệnh đo lại** | **Có** — số không kèm lệnh là đỏ |

Trần 200 dòng có căn cứ: `CLAUDE.md` hôm nay **524 dòng** và sai suốt 19 ngày mà
không ai thấy. **File càng dài thì chỗ sai càng dễ nấp.**

### 3.4 `CLAUDE.md` — vai trò đổi hẳn

**Sau đợt này nó chỉ còn hai việc:** nói luật làm việc, và **chỉ đường**. Mọi mô
tả hệ thống chuyển sang `SYSTEM-OVERVIEW.md` và `SYSTEM-MAP.md`.

**Vì sao tách:** luật hiếm khi đổi; mô tả hệ thống đổi mỗi tuần. Trộn chung là
bảo đảm phần luật bị nghi ngờ theo phần mô tả đã cũ.

**Luật số 0 giữ nguyên và nâng lên đầu:** không câu nào trong `CLAUDE.md` được
mô tả số liệu hiện tại.

### 3.5 Mười luồng việc — `docs/03-workflows/`

| File | Phủ màn hình nào |
|---|---|
| `sales.md` | Máy POS, Đơn hàng, Khuyến mãi → doanh thu |
| `purchasing.md` | Đơn nhập, Nhà cung cấp → tồn tăng |
| `stock-issue.md` | Phiếu xuất, Điều chỉnh tồn → giá vốn |
| `stocktake.md` | Kỳ kiểm kê → hao hụt |
| `assets.md` | Dụng cụ, Bảng khấu hao, Thanh lý |
| `reports.md` | Bảng tổng quan, Báo cáo ngày, Báo cáo bán hàng, Báo cáo xuất kho |
| `product-catalog.md` | Món, Nhóm món, Tuỳ chọn món, Topping, giá bán |
| `inventory-catalog.md` | Nguyên liệu, Nhóm nguyên liệu, Đơn vị tính, Quy cách quy đổi |
| `users.md` | Đăng nhập, Người dùng, Sửa người dùng, Đổi mật khẩu, phân quyền |
| `operations.md` | Đồng bộ máy POS, Nhật ký hoạt động, Xoá bộ nhớ đệm, Điểm bán, Thương hiệu, hai trang chuyển hướng |

Mỗi file trả lời **năm câu giống nhau** — chính năm câu `CLAUDE.md` §1b: trạng
thái, nút bấm, danh sách, giá trị hợp lệ, và cố ý không phục vụ gì. Khung đó đã
bắt được lỗi thật nhiều lần tháng này.

### 3.5b Hình dạng bắt buộc: khai báo trước, văn xuôi sau

**Lời giải cho chỗ hở lớn nhất của bản trước.** Chỗ phải đổi **không phải phép
kiểm — mà là hình dạng tài liệu.**

| Khai báo | Máy đối chiếu với |
|---|---|
| Màn hình thuộc luồng này | `app/` — route có tồn tại |
| File mã nguồn | Có tồn tại |
| **Bảng dữ liệu luồng này ghi vào** | **Bảng mà những file đó ghi thật**, lấy từ `SYSTEM-MAP.generated.md` |
| Các trạng thái | Ràng buộc thật trên máy chủ — hệ thống dùng `check (status in (...))`, đo 02/09 |
| Mã luật `BR-*` nhắc tới | `BUSINESS-RULES.md` |

**Dòng thứ ba là dòng có răng nhất:** nó bắt được **tài liệu mô tả sai đường đi
của dữ liệu**, chứ không chỉ bắt tài liệu nhắc tới thứ đã xoá.

Ước lượng: **4 trên 5 câu** thành kiểm được bằng máy. Chỗ hở còn lại ở §5.1.

### 3.6 Bản đồ — hai lớp, một phép kiểm

**Lớp máy sinh** đọc mã nguồn và máy chủ: màn hình nào gọi hàm nào, hàm nào đụng
bảng nào, bảng nào có ai đọc, bảng nào có cột gì kèm ràng buộc gì. **Chạy lại là
đúng.**

**Lớp người vẽ** là sơ đồ gọn để hiểu toàn cảnh.

**Phép kiểm nối hai lớp:** bản máy sinh có một quan hệ mà bản vẽ tay không nhắc
tới → **đỏ**.

Việc này giải quyết đúng thứ đã làm tôi sai nhiều nhất tháng này: không thấy chỗ
liên đới. Hàm huỷ đơn ẩn khỏi phép quét 6 ngày; khoá ngoại tôi báo "không có" mà
có thật; ba nơi đọc bảng số dư mà kế hoạch chỉ liệt kê một.

### 3.7 Quy trình giữ cho tài liệu không cũ — chặn cứng (§2.10)

| Đổi cái gì | Bắt buộc kèm | Máy canh bằng |
|---|---|---|
| Sửa file thuộc một luồng | Sửa `docs/03-workflows/<luồng>.md` | Đối chiếu khối khai báo §3.5b |
| Thêm/xoá màn hình | Sửa luồng tương ứng | Đối chiếu danh sách route |
| Đổi cách tính tiền | Sửa `BUSINESS-RULES.md` | Quy tắc ↔ phép kiểm mã |
| Thêm/xoá bảng dữ liệu | Sửa `SYSTEM-MAP.md` | Phép kiểm lệch bản đồ (§3.6) |
| Đổi thuật ngữ | Sửa `GLOSSARY.md` | Từ dùng trong màn hình |
| Xong một việc | — | Phép kiểm của việc đó tự xanh (§3.8) |

**Tất cả đều đỏ ở cửa `npx vitest run`.** Không có mức cảnh báo vàng.

**Đường thoát duy nhất, và nó để lại dấu vết:** sửa đổi thật sự không đổi hành vi
thì ghi một dòng *"đã xem lại, không đổi hành vi — ngày"*. Chủ quán đọc được ai
đã dùng đường thoát bao nhiêu lần.

### 3.8 Việc treo là phép kiểm, không phải gạch đầu dòng (§2.11)

| Loại việc | Cách canh |
|---|---|
| **Thuộc về code** | Viết trước một phép kiểm mô tả điều phải đúng khi xong. Danh sách sinh ra từ chính những phép kiểm đó; xong thì nó xanh và mục tự rụng |
| **Không phải code nhưng ĐO ĐƯỢC** | Phép kiểm truy vấn thật: migration đã chạy chưa, web có chạy ở Singapore không, dữ liệu đã thoả điều kiện chưa |
| **Chờ người thật** | Ghi tay kèm ngày hẹn. Quá hạn thì đỏ, buộc đóng hoặc gia hạn |

**Loại thứ hai là loại đã cắn tôi:** ba lần trong ngày 02/09 tôi báo migration
*"chưa chạy"* trong khi đã chạy — một câu truy vấn là bắt được. **Trạng thái
phải đo được, không được nhớ.**

---

## 4. Cái gì bị xoá

| Xoá | Số lượng | Ghi chú |
|---|---:|---|
| `docs/audits/` | 100 file, 12 MB | **Gồm 5 file dữ liệu sao lưu, 5,4 MB** (§2.13) |
| `docs/superpowers/plans/` | 101 file | |
| `docs/superpowers/specs/` | 34 file | **Trừ chính file này** cho tới khi xong đợt 5 |
| `docs/handoffs/` | 3 file | |
| `DEVELOPMENT-TRACKING.md` | 9.252 dòng | |
| 13 file tài liệu lẻ | 13 file | §2.8 — `README.md` sống, viết lại |
| `scripts/` | 226 file | **Dựng bộ mới trước** (§2.7) |
| Dòng địa chỉ chết trong chú thích code | ~294 file | §2.19 — chỉ xoá dòng trỏ, giữ lý do |

**Git vẫn giữ tất cả.** Trừ một chuyện: `docs/audits/*.json` là **dữ liệu**, và
sau khi xoá thì chỉ còn trong lịch sử git — không còn trên đĩa.

---

## 5. Chỗ tôi CHƯA giải được

### 5.1 Hai câu trong khung năm câu vẫn là văn xuôi

**Câu 4 — "ô nhập nhận giá trị nào là hợp lệ":** hệ thống **không dùng zod** (đo
02/09: 0 file). Máy chỉ kiểm được tới ràng buộc trong cơ sở dữ liệu (`NOT NULL`,
`check`), **không kiểm được luật kiểm tra viết tay trong màn hình**.

**Câu 2 (nhãn nút) và câu 5 (cố ý không phục vụ loại nào):** không có cách máy
nào đọc hiểu.

**Giảm nhẹ:** mỗi tài liệu luồng có dòng *"đo lần cuối: ngày — bằng lệnh nào"*.
Đây là giảm nhẹ, không phải lời giải.

### 5.2 Việc chờ người thật vẫn phụ thuộc người

§3.8 loại ba. Máy canh được hạn, không canh được nội dung. Theo thiết kế là vậy.

### 5.3 Xoá `docs/audits/` là mất khả năng dựng lại

Đã hỏi lại lần hai với số đo cụ thể, chủ quán giữ nguyên (§2.13).

---

## 6. Năm đợt (§2.12)

**Xoá nằm cuối cùng là cố ý.** Dừng giữa chừng ở bất kỳ đợt nào thì hệ thống vẫn
nguyên vẹn, không có quãng nào trống.

| Đợt | Làm gì | Xong nghĩa là |
|---|---|---|
| **1** | Công cụ sinh bản đồ + các phép kiểm chặn cứng (§3.6, §3.7, §3.8) | Phép kiểm chạy được, và **đã chứng minh bắt được một lỗi thật** |
| **2** | 10 luồng + `GLOSSARY` + `SYSTEM-OVERVIEW` + `SYSTEM-MAP` + `INCIDENT-RESPONSE` | Viết từ mã nguồn, phép kiểm đợt 1 xanh |
| **3** | Viết lại `CLAUDE.md` + `README.md`, cập nhật `BUSINESS-RULES.md` | Bốn cửa `CLAUDE.md` §9 xanh |
| **4** | Dựng lại bộ script | `verify-revenue` và `check-rules-current` bản mới chạy được và bắt được lỗi |
| **5** | Xoá (§4) | **Duyệt riêng một lần nữa** |

**Chủ quán duyệt sau mỗi đợt.** Đợt sau chưa bắt đầu trước khi đợt trước được
duyệt.

**Mỗi đợt có kế hoạch triển khai riêng** (bước 3 của `CLAUDE.md` §1b), viết ngay
trước khi làm đợt đó — không viết trước cả năm, vì đợt 1 có thể đổi hiểu biết cho
đợt 2.

---

## 7. Cái gì đáng lưu — theo tiêu chí §2.14

**Bản trước tôi đề xuất bốn thứ. Tiêu chí của chủ quán loại một, sửa cách hiểu
một cái khác.** Còn ba:

### 7.1 Lưu CÁCH ĐO, đừng lưu CON SỐ

**Đây là chỗ tôi sửa chính mình.** Bản trước tôi đề xuất lưu *"số đo tại thời
điểm quyết định, kèm ngày"*. Theo §2.14 thì một con số đã đo là thứ **chắc chắn
sẽ lệch khỏi hiện trạng** — đúng loại đáng xoá.

**Cái không cũ đi là câu lệnh đo.** Mỗi chỗ cần số thì ghi lệnh tái đo, cộng một
dòng *"đo lần cuối: ngày"*. Ai cần số thì chạy lại.

`CLAUDE.md` §4 đã nói điều này (*"đi đếm, đừng đi đọc"*) nhưng chưa bắt buộc kèm
lệnh đo, nên vẫn có người đọc số cũ.

### 7.2 Luật, và nguyên văn lý do sinh ra nó — gắn vào chính luật

Không có sổ sự cố riêng. Luật về tiền thì lý do nằm ngay dưới luật trong
`BUSINESS-RULES.md`; luật về cách làm việc thì nằm dưới luật trong `CLAUDE.md`.
**Cả hai file đã làm đúng vậy hôm nay** — giữ, không tạo chỗ mới.

Lý do phải có **nguyên văn lời chủ quán**. Lần tôi *không* ghi nguyên văn (29/08,
chuyện xoá nhóm nguyên liệu) là lần hồ sơ của tôi mâu thuẫn với chính nó ba ngày.

### 7.3 Việc chưa xong, kèm cái gì đang chặn

`OPEN-ITEMS.md`, canh theo §3.8.

### Cố ý KHÔNG lưu

Nhật ký ai làm gì ngày nào; kế hoạch đã thực hiện xong; báo cáo điều tra đã kết
luận; **và mọi con số đo rời khỏi lệnh đã sinh ra nó**.

---

## 8. Cần chủ quán duyệt gì

Mọi câu hỏi của ba bản trước đã được trả lời ở §2.8–§2.19. **Còn một việc: chủ
quán duyệt toàn bộ bản này.**

Duyệt xong tôi mới viết kế hoạch triển khai cho **đợt 1** (bước 3 của
`CLAUDE.md` §1b).
