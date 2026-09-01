# Dựng lại nền tài liệu và quy trình cho toàn dự án

**Viết 2026-09-02 bởi Opus 5. Cập nhật cùng ngày sau ba vòng phỏng vấn.**
Bước 1+2 của `CLAUDE.md` §1b — đặc tả và thiết kế. **Chưa phải kế hoạch triển
khai.**

**Status: chờ chủ quán duyệt.** Chưa duyệt thì chưa ai được bắt tay làm.

**Chủ quán yêu cầu 02/09**, và nói rõ đây là việc ưu tiên cao nhất, gác mọi thứ
khác. Ông ấy yêu cầu **phỏng vấn trước khi lập kế hoạch** — đã phỏng vấn ba
vòng, kết quả ở §2.

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

Trong cùng tháng đó, **những luật do máy canh chưa hỏng lần nào**:

| Phép kiểm | Bắt được gì |
|---|---|
| `check-rules-current` | Tài liệu nhắc file/route đã xoá → đỏ ngay lúc lưu |
| Phép kiểm menu | Thêm màn hình mà quên gắn menu → đỏ |
| `verify-revenue` | Doanh thu 5 tháng, chạy sau **mọi** lần xoá dữ liệu tháng này |
| 4 cửa `CLAUDE.md` §9 | `tsc`, toàn bộ phép kiểm, luật, dựng web |

**Đây là căn cứ cho quyết định §2.3.** Không phải sở thích — là thứ đã đo được.

---

## 2. Chủ quán đã chốt gì — phỏng vấn 02/09

**Ghi nguyên văn lựa chọn, vì đây là căn cứ cho mọi việc phía sau.**

### Vòng 1

#### 2.1 Xoá sạch `docs/audits/` — 100 file, 12 MB

**Đã nói trước hậu quả và chủ quán vẫn chọn.** Xem thêm §2.13: vòng 3 đo ra chi
tiết mới, đưa lại cho chủ quán quyết lần nữa, và ông ấy **giữ nguyên quyết định**.

#### 2.2 Xoá thẳng hồ sơ cũ, không gộp nội dung

101 kế hoạch + 34 thiết kế + 3 giao việc + nhật ký 9.252 dòng. **Không đọc lại
để rút nội dung.**

**Hệ quả bắt buộc, và nó định hình cả đợt:** bộ tài liệu mới **phải viết từ mã
nguồn và dữ liệu đang chạy**, không được chép lại từ hồ sơ cũ. Thực ra sạch hơn
— hồ sơ cũ chính là thứ đã sai bảy lần ở §1.2.

**`docs/BUSINESS-RULES.md` (478 dòng) KHÔNG nằm trong danh sách xoá** — nó là
tài liệu hiện hành, và mục 8 của chủ quán yêu cầu cập nhật nó chứ không bỏ.

#### 2.3 Máy canh tối đa, văn bản là phụ

> Mỗi quy tắc quan trọng phải có một phép kiểm tự động đi kèm, **không thì không
> được coi là luật**.

#### 2.4 Tài liệu trước, chuyển chỗ mã nguồn sau

Đợt này **không di chuyển file mã nguồn nào** trong `app/`, `lib/`,
`components/`. Việc đó tách riêng, làm sau khi đã có sơ đồ để biết cái gì đụng
cái gì.

#### 2.5 Đặc tả theo luồng việc, không theo màn hình

Mỗi tài liệu một luồng kinh doanh. Không phải 35 tài liệu theo màn hình.

#### 2.6 Hai bản đồ, và bản vẽ tay phải có phép kiểm canh

> *"Cả 2, nhưng phải đảm bảo cập nhật theo kịp với thông tin mới nhất."*

Máy sinh bản đầy đủ để tra cứu; người vẽ bản gọn để hiểu toàn cảnh; **và một
phép kiểm báo đỏ khi mã nguồn lệch khỏi bản vẽ tay.**

#### 2.7 Xoá hết script rồi dựng lại

> *"Xóa hết rồi xây dựng lại xong liên tục cập nhật theo mã nguồn."*

**Một chỗ tôi phải làm ngược lại thứ tự chữ:** trong 226 file đó có
`scripts/verify-revenue.ts` và `scripts/check-rules-current.ts` — **hai cửa
kiểm bắt buộc của `CLAUDE.md` §9**. Xoá trước là có một quãng **không còn gì
canh doanh thu**.

**Nên: dựng bộ mới trước, chứng minh nó chạy và bắt được lỗi, RỒI mới xoá bộ
cũ.** Kết quả giống ý chủ quán, chỉ khác thứ tự, và không có khoảng hở.

### Vòng 2

#### 2.8 Trong 13 file tài liệu lẻ, chỉ `README.md` sống

> *"Chỉ giữ riêng README.md nhưng cần cập nhật lại nội dung mới nhất hiện tại,
> còn lại xóa hết và em tìm giải pháp để xây lại sao cho đúng với những gì đã
> code theo logic mới."*

Áp cho: `CONTEXT.md`, `docs/ACCESS-MODEL.md`, `docs/COMPLETED.md`,
`docs/domain-dictionary.md`, `docs/FEATURE-CATALOG.md`,
`docs/FILE-ORGANIZATION.md`, `docs/OPEN-ITEMS.md`, `docs/TESTING.md`,
`docs/operations/` (4 file), `docs/reports/` (2 file), `docs/runbooks/` (1 file).

**Một chỗ phải cẩn thận, đã báo chủ quán:** `docs/runbooks/restore-from-backup.md`
là cách khôi phục dữ liệu khi hỏng. Nội dung đó **dựng lại từ công cụ sao lưu
thật đang chạy** rồi mới xoá bản cũ — cùng nguyên tắc §2.7, không để trống một
quãng. Nơi ở mới của nó là `docs/KHI-HONG.md` (§3.2).

#### 2.9 Mười luồng việc, phủ hết 35 màn hình

Sáu luồng đề xuất ở vòng 1 chỉ phủ **13 trên 35** màn hình. Đo lại `app/` ra
**19 màn hình không thuộc luồng nào**: danh mục món (4), danh mục kho (4),
khuyến mãi (1), người dùng và phân quyền (4), vận hành máy (6). Cộng 3 trang
nữa: bảng tổng quan `app/admin/page.tsx` và hai trang chỉ chuyển hướng.

Chủ quán chọn **10 luồng — phủ hết, không chỗ nào trống**, đúng với mục 6 của
ông ấy (*"đặc tả tất cả mọi thứ"*).

#### 2.10 Sửa code mà không cập nhật tài liệu luồng → **chặn cứng**

> *"Chặn cứng — không qua cửa kiểm."*

Đỏ ngay ở cửa `npx vitest run`, coi như test hỏng, **không được báo xong việc**.

**Cái giá đã nói trước và chủ quán vẫn chọn:** một sửa đổi nhỏ không đổi hành vi
cũng bị bắt chạm tài liệu — lúc đó phải ghi một dòng đã xem lại, kèm ngày.

#### 2.11 Mỗi việc treo là một phép kiểm đang đỏ

> *"Mỗi việc treo là một phép kiểm đang đỏ."*

Việc thuộc về code: viết trước một phép kiểm mô tả điều phải đúng khi xong; làm
xong thì nó tự xanh và mục tự rụng — **không ai phải nhớ xoá**.

#### 2.12 Năm đợt, chủ quán duyệt sau mỗi đợt

> *"5 đợt, anh duyệt sau mỗi đợt."*

Đợt 5 (xoá) duyệt riêng một lần nữa vì không quay đầu được.

### Vòng 3

#### 2.13 Xoá cả 5 file dữ liệu sao lưu — hỏi lại lần hai, chủ quán giữ nguyên

Vòng 3 đo ra `docs/audits/` **không đồng nhất**:

| | Số lượng | Dung lượng |
|---|---:|---:|
| Kết quả điều tra đã kết luận | 94 file | ~6,5 MB |
| **Dữ liệu sao lưu thật** | **5 file** | **5,4 MB** |

Năm file đó: sổ kho đã xoá (`2026-07-23`, 5,09 MB), công thức và bán thành phẩm
(`2026-08-27` và `2026-08-31`), sổ kho và bảng số dư trước lúc xoá
(`2026-08-31`), và một ảnh chụp trước khi ghi (`2026-06-27`).

**Đã đề xuất chuyển 5 file đó lên chỗ sao lưu rồi mới xoá. Chủ quán chọn: xoá
hết, kể cả 5 file dữ liệu.**

**Hậu quả đã nói trước và ông ấy chấp nhận:** sau đợt này không còn cách trả lời
*"công thức món X hồi tháng 6 là gì"* hay *"sổ kho cũ ghi gì"* — kể cả từ lịch sử
git cũng phải đi đào. **Đây là chủ ý, không phải sơ suất.**

#### 2.14 Tiêu chí "đáng lưu"

> *"Quan trọng nhất là đúng hiện trạng và luôn được cập nhật theo thông tin mới
> nhất thì mới là thứ đáng lưu, còn lại là đáng xóa nếu đã không còn tác dụng gì
> nữa hoặc đã chết."*

Tiêu chí này **thay thế** danh sách bốn thứ đáng lưu ở bản trước. Hệ quả viết
lại ở §7 — và nó loại bỏ chính một mục tôi từng đề xuất.

---

## 3. Thiết kế bộ tài liệu mới

### 3.1 Nguyên tắc: mỗi tài liệu trả lời một câu hỏi có thật

Không viết tài liệu vì "nên có". Mỗi file dưới đây tồn tại vì có một câu hỏi cụ
thể mà hôm nay **không ai trả lời nhanh được**.

### 3.2 Chín chỗ, không hơn

| File | Trả lời câu hỏi | Ai đọc |
|---|---|---|
| `CLAUDE.md` | *"Tôi phải làm việc thế nào, và đi đâu tiếp?"* | AI, mỗi phiên |
| `README.md` | *"Máy này chạy bằng gì, tôi khởi động nó ra sao?"* | DEV mới |
| `docs/HE-THONG.md` | *"Quán này là gì?"* | Người mới — DEV, BA, BM |
| `docs/BAN-DO.md` | *"Sửa chỗ này thì đụng những đâu?"* | AI và DEV, trước mỗi lần sửa |
| `docs/TU-DIEN.md` | *"Từ này nghĩa là gì trong quán này?"* | Tất cả |
| `docs/BUSINESS-RULES.md` | *"Tiền tính thế nào, vì sao?"* | Chủ quán, BA |
| `docs/luong/*.md` (10 file) | *"Việc này chạy từ đầu tới cuối ra sao?"* | Tất cả |
| `docs/VIEC-DANG-LAM.md` | *"Cái gì chưa xong?"* | Chủ quán, AI |
| `docs/KHI-HONG.md` | *"Hỏng rồi thì làm gì?"* | Người đang cuống |

Cộng một file máy sinh, `docs/BAN-DO-SINH.md` (§3.5) — **không ai viết tay,
chạy lại là đúng**, nên nó không tính là một chỗ phải bảo trì.

**`docs/KHI-HONG.md` là chỗ thứ chín, thêm ở vòng 3.** Khôi phục dữ liệu, máy POS
không đồng bộ được, migration chạy sai, web không dựng được. Đây là thứ đọc lúc
đang cuống — chôn nó trong một tài liệu mô tả màn hình thì lúc cần không ai tìm
ra.

### 3.2b Ba ranh giới cứng — nếu không đặt thì ba chỗ sẽ thành bản sao của nhau

**Đây là cách `CLAUDE.md` đã hỏng: một tài liệu tóm tắt một tài liệu khác, rồi
bản tóm tắt cũ đi trước.**

1. **`docs/HE-THONG.md` chỉ được nói về quán** — hai điểm bán, hai thương hiệu,
   bán mang đi, kho dùng chung, tiền vào tiền ra ở mức khái niệm. **Cấm liệt kê
   tính năng.** Liệt kê tính năng là biến nó thành bản tóm tắt của 10 luồng.
2. **`docs/BUSINESS-RULES.md` giữ công thức và lý do; tài liệu luồng chỉ được
   trỏ tới mã luật** (`BR-COGS-005`), **cấm chép lại công thức.** Máy kiểm được:
   mã luật nhắc trong luồng phải có thật trong `docs/BUSINESS-RULES.md`.
3. **Cấu trúc dữ liệu không có tài liệu tay.** Bảng nào, cột nào, ràng buộc gì —
   lấy thẳng từ máy chủ vào `docs/BAN-DO-SINH.md`.

### 3.3 `CLAUDE.md` — vai trò đổi hẳn

**Hôm nay:** 524 dòng, vừa là luật vừa là mô tả hệ thống vừa là lịch sử sự cố.
Chính nó đã sai suốt 19 ngày về giá vốn.

**Sau đợt này: nó chỉ còn hai việc** — nói luật làm việc, và **chỉ đường**. Mọi
mô tả hệ thống chuyển sang `docs/HE-THONG.md` và `docs/BAN-DO.md`.

**Vì sao tách:** luật thì hiếm khi đổi; mô tả hệ thống thì đổi mỗi tuần. Trộn
chung là bảo đảm phần luật bị nghi ngờ theo phần mô tả đã cũ.

**Luật số 0 giữ nguyên và nâng lên đầu:** không câu nào trong `CLAUDE.md` được
mô tả số liệu hiện tại.

### 3.4 Mười luồng việc — `docs/luong/`

| File | Phủ màn hình nào |
|---|---|
| `ban-hang.md` | Máy POS, Đơn hàng, Khuyến mãi → doanh thu |
| `mua-hang.md` | Đơn nhập, Nhà cung cấp → tồn tăng |
| `xuat-kho.md` | Phiếu xuất, Điều chỉnh tồn → giá vốn |
| `kiem-ke.md` | Kỳ kiểm kê → hao hụt |
| `tai-san.md` | Dụng cụ, Bảng khấu hao, Thanh lý |
| `bao-cao.md` | Bảng tổng quan, Báo cáo ngày, Báo cáo bán hàng, Báo cáo xuất kho |
| `danh-muc-mon.md` | Món, Nhóm món, Tuỳ chọn món, Topping, giá bán |
| `danh-muc-kho.md` | Nguyên liệu, Nhóm nguyên liệu, Đơn vị tính, Quy cách quy đổi |
| `nguoi-dung.md` | Đăng nhập, Người dùng, Sửa người dùng, Đổi mật khẩu, phân quyền |
| `van-hanh-may.md` | Đồng bộ máy POS, Nhật ký hoạt động, Xoá bộ nhớ đệm, Điểm bán, Thương hiệu, hai trang chuyển hướng |

Mỗi file trả lời **năm câu giống nhau** — chính năm câu `CLAUDE.md` §1b đang bắt
mọi kế hoạch phải trả lời: trạng thái, nút bấm, danh sách, giá trị hợp lệ, và
cố ý không phục vụ gì.

**Dùng lại đúng khung đó có lý do:** nó đã bắt được lỗi thật nhiều lần tháng này
— màn hình POS mời bấm vào món không bán được, phiếu xuất cắt giữa phiếu, nút xoá
từ chối trong im lặng.

### 3.4b Hình dạng bắt buộc: bảng khai báo trước, văn xuôi sau

**Đây là lời giải cho chỗ hở lớn nhất của bản trước** (§5.1 cũ: phép kiểm chỉ
chứng minh tài liệu được chạm, không chứng minh nội dung đúng).

Chỗ phải đổi **không phải phép kiểm — mà là hình dạng tài liệu.** Mỗi file luồng
mở đầu bằng một khối khai báo máy đọc được; văn xuôi chỉ còn phần *"vì sao"*.

| Khai báo | Máy đối chiếu với |
|---|---|
| Màn hình thuộc luồng này | `app/` — route có tồn tại |
| File mã nguồn | Có tồn tại |
| **Bảng dữ liệu luồng này ghi vào** | **Bảng mà những file đó ghi thật**, lấy từ `docs/BAN-DO-SINH.md` |
| Các trạng thái | Ràng buộc thật trên máy chủ — hệ thống dùng `check (status in (...))`, đo 02/09 |
| Mã luật `BR-*` nhắc tới | `docs/BUSINESS-RULES.md` |

**Dòng thứ ba là dòng có răng nhất:** nó bắt được **tài liệu mô tả sai đường đi
của dữ liệu**, chứ không chỉ bắt tài liệu nhắc tới thứ đã xoá. Đây đúng là loại
lỗi đã xảy ra bảy lần ở §1.2.

Ước lượng: **4 trên 5 câu** của khung năm câu thành kiểm được bằng máy. Chỗ hở
còn lại ở §5.1.

### 3.5 Bản đồ — hai lớp, một phép kiểm

**Lớp máy sinh** (`docs/BAN-DO-SINH.md`): công cụ đọc mã nguồn và máy chủ, vẽ ra
màn hình nào gọi hàm nào, hàm nào đụng bảng nào, bảng nào có ai đọc, và bảng nào
có cột gì kèm ràng buộc gì. **Chạy lại là đúng.**

**Lớp người vẽ** (`docs/BAN-DO.md`): sơ đồ gọn cho người hiểu toàn cảnh.

**Phép kiểm nối hai lớp** — đây là phần chủ quán nhấn mạnh: nếu bản máy sinh có
một quan hệ mà bản vẽ tay không nhắc tới, **phép kiểm báo đỏ**.

**Việc này giải quyết đúng thứ đã làm tôi sai nhiều nhất tháng này:** không thấy
chỗ liên đới. Hàm huỷ đơn ẩn khỏi phép quét 6 ngày; khoá ngoại tôi báo "không
có" mà có thật; ba nơi đọc bảng số dư mà kế hoạch chỉ liệt kê một.

### 3.6 Quy trình giữ cho tài liệu không cũ — chặn cứng (§2.10)

**Đây là mục 4 của chủ quán, và là chỗ mọi lần trước đã hỏng.**

| Đổi cái gì | Bắt buộc kèm | Máy canh bằng |
|---|---|---|
| Sửa file thuộc một luồng | Sửa `docs/luong/<luồng>.md` | Đối chiếu khối khai báo §3.4b với file bị đụng |
| Thêm/xoá màn hình | Sửa luồng tương ứng | Đối chiếu danh sách route |
| Đổi cách tính tiền | Sửa `docs/BUSINESS-RULES.md` | Quy tắc ↔ phép kiểm mã |
| Thêm/xoá bảng dữ liệu | Sửa `docs/BAN-DO.md` | Phép kiểm lệch bản đồ (§3.5) |
| Đổi thuật ngữ | Sửa `docs/TU-DIEN.md` | Từ dùng trong màn hình |
| Xong một việc | — | Phép kiểm của việc đó tự xanh (§3.7) |

**Tất cả đều đỏ ở cửa `npx vitest run`.** Không có mức cảnh báo vàng — chủ quán
đã chọn dứt khoát, vì tháng này đã chứng minh thứ gì không chặn thì bị bỏ qua.

**Đường thoát duy nhất, và nó để lại dấu vết:** sửa đổi thật sự không đổi hành vi
thì ghi một dòng *"đã xem lại, không đổi hành vi — ngày"* vào tài liệu luồng. Máy
chấp nhận dòng đó, và **chủ quán đọc được ai đã dùng đường thoát bao nhiêu lần**.

### 3.7 Việc treo là phép kiểm, không phải gạch đầu dòng (§2.11)

`docs/VIEC-DANG-LAM.md` không còn là danh sách người tự cập nhật. Ba loại việc,
ba cách canh:

| Loại việc | Cách canh | Ví dụ |
|---|---|---|
| **Thuộc về code** | Viết trước một phép kiểm mô tả điều phải đúng khi xong, đánh dấu đang nợ. Danh sách việc treo **sinh ra từ chính những phép kiểm đó**. Xong thì nó xanh và mục tự rụng | Thêm nút ngừng bán |
| **Không phải code nhưng ĐO ĐƯỢC** | Phép kiểm truy vấn thật trạng thái | Migration đã chạy chưa; web có đang chạy ở Singapore không; dữ liệu đã thoả điều kiện chưa |
| **Chờ người thật** | Ghi tay kèm ngày hẹn. Quá hạn thì đỏ, buộc đóng hoặc gia hạn | Chờ chủ quán quyết; phải mở trang xem tận mắt |

**Loại thứ hai là chỗ tôi nghĩ thiếu ở bản trước, và nó là loại đã cắn tôi.** Ba
lần trong ngày 02/09 tôi báo migration *"chưa chạy"* trong khi đã chạy — một câu
truy vấn là bắt được. Trạng thái phải đo được, không được nhớ.

Phần thật sự không tự động được co lại còn loại thứ ba, và loại đó **theo thiết
kế là phải chờ người** — không phải lỗi.

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

**Git vẫn giữ tất cả.** Trừ một chuyện: `docs/audits/*.json` là **dữ liệu**, và
sau khi xoá thì chỉ còn trong lịch sử git — không còn trên đĩa.

---

## 5. Chỗ tôi CHƯA giải được — nói ra để chủ quán biết

Vòng 3 giải được phần lớn hai chỗ đầu (§3.4b và §3.7). **Đây là phần còn lại,
không giấu.**

### 5.1 Hai câu trong khung năm câu vẫn là văn xuôi

**Câu 4 — "ô nhập nhận giá trị nào là hợp lệ":** hệ thống **không dùng zod** (đo
02/09: 0 file). Nên máy chỉ kiểm được tới mức ràng buộc trong cơ sở dữ liệu
(`NOT NULL`, `check`), **không kiểm được luật kiểm tra viết tay trong màn hình**.

**Câu 2 — nhãn nút — và câu 5 — "cố ý không phục vụ loại nào":** không có cách
máy nào đọc hiểu.

**Giảm nhẹ:** mỗi tài liệu luồng có dòng *"đo lần cuối: ngày — bằng lệnh nào"*,
để người đọc biết câu trong đó cũ tới đâu. Đây là giảm nhẹ, không phải lời giải.

### 5.2 Việc chờ người thật vẫn phụ thuộc người

§3.7 loại ba. Máy canh được hạn, không canh được nội dung. Theo thiết kế là vậy.

### 5.3 Xoá `docs/audits/` là mất khả năng dựng lại

Đã hỏi lại lần hai ở vòng 3 với số đo cụ thể, chủ quán giữ nguyên (§2.13). Sau
đợt này không trả lời được *"công thức món X hồi tháng 6 là gì"* nữa.

Chủ quán đã biết và vẫn chọn. Ghi lại để sau này không ai ngạc nhiên.

---

## 6. Năm đợt (§2.12)

**Xoá nằm cuối cùng là cố ý.** Dừng giữa chừng ở bất kỳ đợt nào thì hệ thống vẫn
nguyên vẹn, không có quãng nào trống.

| Đợt | Làm gì | Xong nghĩa là | Nặng |
|---|---|---|---|
| **1** | Công cụ sinh bản đồ + các phép kiểm chặn cứng (§3.5, §3.6, §3.7) | Phép kiểm chạy được, và **đã chứng minh bắt được một lỗi thật** | Nặng |
| **2** | 10 luồng việc + `docs/TU-DIEN.md` + `docs/HE-THONG.md` + `docs/BAN-DO.md` + `docs/KHI-HONG.md` | Viết từ mã nguồn, phép kiểm đợt 1 xanh | Nặng |
| **3** | Viết lại `CLAUDE.md` + `README.md`, cập nhật `docs/BUSINESS-RULES.md` | Bốn cửa `CLAUDE.md` §9 xanh | Vừa |
| **4** | Dựng lại bộ script | `verify-revenue` và `check-rules-current` bản mới chạy được và bắt được lỗi | Vừa |
| **5** | Xoá (§4) | **Duyệt riêng một lần nữa** | Nhẹ, không quay đầu |

**Chủ quán duyệt sau mỗi đợt.** Đợt sau chưa bắt đầu trước khi đợt trước được
duyệt.

**Mỗi đợt có kế hoạch triển khai riêng** (bước 3 của `CLAUDE.md` §1b), viết ngay
trước khi làm đợt đó — không viết trước cả năm, vì đợt 1 có thể đổi hiểu biết cho
đợt 2.

---

## 7. Cái gì đáng lưu — viết lại theo tiêu chí §2.14

**Bản trước tôi đề xuất bốn thứ. Tiêu chí của chủ quán loại bớt một, và sửa
cách hiểu một cái khác.** Còn ba:

### 7.1 Lưu CÁCH ĐO, đừng lưu CON SỐ

**Đây là chỗ tôi sửa chính mình.** Bản trước tôi đề xuất lưu *"số đo tại thời
điểm quyết định, kèm ngày"*. Theo tiêu chí §2.14 thì một con số đã đo là thứ
**chắc chắn sẽ lệch khỏi hiện trạng** — đúng loại đáng xoá.

**Cái không cũ đi là câu lệnh đo.** Nên mỗi chỗ cần số thì ghi lệnh tái đo, cộng
một dòng *"đo lần cuối: ngày"*. Ai cần số thì chạy lại.

Chính `CLAUDE.md` §4 đã nói điều này (*"đi đếm, đừng đi đọc"*) — nhưng chưa có
chỗ nào bắt buộc kèm lệnh đo, nên vẫn có người đọc số cũ.

### 7.2 Luật, và nguyên văn lý do sinh ra nó — gắn vào chính luật

Không có sổ sự cố riêng. Luật về tiền thì lý do nằm ngay dưới luật trong
`docs/BUSINESS-RULES.md`; luật về cách làm việc thì nằm dưới luật trong
`CLAUDE.md`. **Cả hai file đã làm đúng vậy hôm nay** — giữ, không tạo chỗ mới.

Lý do phải có **nguyên văn lời chủ quán**. Lần tôi *không* ghi nguyên văn (29/08,
chuyện xoá nhóm nguyên liệu) là lần hồ sơ của tôi mâu thuẫn với chính nó ba ngày.

Luật không có lý do thì sớm muộn bị bỏ qua — và một luật vẫn đang có hiệu lực
thì **luôn đúng hiện trạng**, nên nó qua được tiêu chí §2.14.

### 7.3 Việc chưa xong, kèm cái gì đang chặn

`docs/VIEC-DANG-LAM.md`, canh theo §3.7. Danh sách không nói rõ chỗ chặn thì
không dùng được.

### Cố ý KHÔNG lưu

Nhật ký ai làm gì ngày nào; kế hoạch đã thực hiện xong; báo cáo điều tra đã kết
luận; **và mọi con số đo rời khỏi lệnh đã sinh ra nó**. Ba thứ đầu chiếm phần lớn
12 MB sắp xoá, và không thứ nào trả lời được câu hỏi nào của hôm nay.

---

## 8. Cần chủ quán duyệt gì

Mọi câu hỏi của hai bản trước đã được trả lời ở §2.8–§2.14. **Còn một việc: chủ
quán duyệt toàn bộ bản này.**

Duyệt xong tôi mới viết kế hoạch triển khai cho **đợt 1** (bước 3 của
`CLAUDE.md` §1b).
