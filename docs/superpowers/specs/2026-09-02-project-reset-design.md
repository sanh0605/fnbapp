# Dựng lại nền tài liệu và quy trình cho toàn dự án

**Viết 2026-09-02 bởi Opus 5. Cập nhật cùng ngày sau vòng phỏng vấn thứ hai.**
Bước 1+2 của `CLAUDE.md` §1b — đặc tả và thiết kế. **Chưa phải kế hoạch triển
khai.**

**Status: chờ chủ quán duyệt.** Chưa duyệt thì chưa ai được bắt tay làm.

**Chủ quán yêu cầu 02/09**, và nói rõ đây là việc ưu tiên cao nhất, gác mọi thứ
khác. Ông ấy yêu cầu **phỏng vấn trước khi lập kế hoạch** — đã phỏng vấn hai
vòng, tổng 10 câu, kết quả ở §2.

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

**Đã nói trước hậu quả và chủ quán vẫn chọn:** trong đó có **bản sao lưu duy
nhất** của sổ kho cũ (5,2 MB, 10.734 dòng), công thức, và bảng số dư.

**Sau việc này chúng không còn ở đâu nữa. Đây là chủ ý, không phải sơ suất.**

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
quãng.

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
xong thì nó tự xanh và mục tự rụng — **không ai phải nhớ xoá**. Việc không phải
code (chờ chủ quán quyết, chờ đẩy lên máy chủ) thì ghi kèm ngày, quá hạn máy
nhắc.

**Cái giá:** mỗi việc treo tốn thêm công viết phép kiểm trước khi làm.

#### 2.12 Năm đợt, chủ quán duyệt sau mỗi đợt

> *"5 đợt, anh duyệt sau mỗi đợt."*

Đợt 5 (xoá) duyệt riêng một lần nữa vì không quay đầu được.

---

## 3. Thiết kế bộ tài liệu mới

### 3.1 Nguyên tắc: mỗi tài liệu trả lời một câu hỏi có thật

Không viết tài liệu vì "nên có". Mỗi file dưới đây tồn tại vì có một câu hỏi cụ
thể mà hôm nay **không ai trả lời nhanh được**.

### 3.2 Tám chỗ, không hơn

| File | Trả lời câu hỏi | Ai đọc |
|---|---|---|
| `CLAUDE.md` | *"Tôi phải làm việc thế nào, và đi đâu tiếp?"* | AI, mỗi phiên |
| `README.md` | *"Máy này chạy bằng gì, tôi khởi động nó ra sao?"* | DEV mới |
| `docs/HE-THONG.md` | *"Quán này là gì, hệ thống làm gì cho nó?"* | Người mới — DEV, BA, BM |
| `docs/BAN-DO.md` | *"Sửa chỗ này thì đụng những đâu?"* | AI và DEV, trước mỗi lần sửa |
| `docs/TU-DIEN.md` | *"Từ này nghĩa là gì trong quán này?"* | Tất cả |
| `docs/BUSINESS-RULES.md` | *"Tiền tính thế nào, vì sao?"* | Chủ quán, BA |
| `docs/luong/*.md` (10 file) | *"Việc này chạy từ đầu tới cuối ra sao?"* | Tất cả |
| `docs/VIEC-DANG-LAM.md` | *"Cái gì chưa xong?"* | Chủ quán, AI |

Cộng một file máy sinh, `docs/BAN-DO-SINH.md` (§3.5) — **không ai viết tay,
chạy lại là đúng**, nên nó không tính là một chỗ phải bảo trì.

**Mỗi chỗ thêm là một chỗ nữa có thể cũ đi.**

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

**Mỗi file mở đầu bằng một khối khai báo máy đọc được:** danh sách route và danh
sách file mã nguồn nó mô tả. Khối đó là thứ §3.6 dùng để chặn.

### 3.5 Bản đồ — hai lớp, một phép kiểm

**Lớp máy sinh** (`docs/BAN-DO-SINH.md`): công cụ đọc mã nguồn và vẽ ra màn hình
nào gọi hàm nào, hàm nào đụng bảng nào, bảng nào có ai đọc. **Chạy lại là đúng.**

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
| Sửa file thuộc một luồng | Sửa `docs/luong/<luồng>.md` | Đối chiếu khối khai báo §3.4 với file bị đụng |
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

`docs/VIEC-DANG-LAM.md` không còn là danh sách người tự cập nhật.

**Việc thuộc về code:** trước khi bắt đầu, viết một phép kiểm mô tả điều phải
đúng khi xong, đánh dấu là đang nợ. Máy sinh danh sách việc treo **từ chính
những phép kiểm đó**. Làm xong, phép kiểm xanh, mục tự rụng.

**Việc không phải code** (chờ chủ quán quyết, chờ đẩy lên máy chủ, chờ mở trang
xem tận mắt): ghi tay kèm ngày hẹn. Quá hạn thì đỏ, buộc phải đóng hoặc gia hạn.

**Việc này cũng chữa luôn một lỗi của riêng tôi:** ba lần trong ngày 02/09 tôi
báo migration *"chưa chạy"* trong khi đã chạy. Trạng thái phải đo được, không
được nhớ.

---

## 4. Cái gì bị xoá

| Xoá | Số lượng | Ghi chú |
|---|---:|---|
| `docs/audits/` | 100 file, 12 MB | **Gồm bản sao lưu duy nhất** (§2.1) |
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

Hai chỗ ở bản trước (tài liệu luồng cũ đi, danh sách việc treo nói dối) đã có
lời giải ở §3.6 và §3.7. **Ba chỗ dưới đây thì chưa.**

### 5.1 Chặn cứng chứng minh tài liệu ĐƯỢC CHẠM, không chứng minh nội dung ĐÚNG

Máy biết file `docs/luong/xuat-kho.md` có được sửa cùng lần lưu hay không. Máy
**không biết** câu vừa sửa có đúng với code hay không — sửa một dấu chấm vẫn qua.

**Không có cách máy nào chứng minh văn xuôi đúng.** Cách giảm nhẹ: mỗi tài liệu
luồng có một dòng *"đo lần cuối: ngày — bằng truy vấn/lệnh nào"*, để người đọc
biết câu trong đó cũ tới đâu. Đây là giảm nhẹ, không phải lời giải.

### 5.2 Việc treo không phải code vẫn phụ thuộc người ghi

§3.7 chỉ tự động được với việc thuộc về code. Việc dạng *"chờ chủ quán quyết"*
thì máy chỉ canh được hạn, không canh được nội dung.

### 5.3 Xoá `docs/audits/` là mất khả năng dựng lại

Sau §2.1, nếu sau này chủ quán hỏi *"công thức món X hồi tháng 6 là gì"* thì
**không trả lời được nữa** — kể cả từ git, vì file đó sẽ không còn trên đĩa và
phải đi đào lịch sử.

Chủ quán đã biết và vẫn chọn. Ghi lại để sau này không ai ngạc nhiên.

---

## 6. Năm đợt (§2.12)

**Xoá nằm cuối cùng là cố ý.** Dừng giữa chừng ở bất kỳ đợt nào thì hệ thống vẫn
nguyên vẹn, không có quãng nào trống.

| Đợt | Làm gì | Xong nghĩa là | Nặng |
|---|---|---|---|
| **1** | Công cụ sinh bản đồ + các phép kiểm chặn cứng (§3.5, §3.6, §3.7) | Phép kiểm chạy được, và **đã chứng minh bắt được một lỗi thật** | Nặng |
| **2** | 10 luồng việc + `docs/TU-DIEN.md` + `docs/HE-THONG.md` + `docs/BAN-DO.md` | Viết từ mã nguồn, phép kiểm đợt 1 xanh | Nặng |
| **3** | Viết lại `CLAUDE.md` + `README.md`, cập nhật `docs/BUSINESS-RULES.md` | Bốn cửa `CLAUDE.md` §9 xanh | Vừa |
| **4** | Dựng lại bộ script | `verify-revenue` và `check-rules-current` bản mới chạy được và bắt được lỗi | Vừa |
| **5** | Xoá (§4) | **Duyệt riêng một lần nữa** | Nhẹ, không quay đầu |

**Chủ quán duyệt sau mỗi đợt.** Đợt sau chưa bắt đầu trước khi đợt trước được
duyệt.

**Mỗi đợt có kế hoạch triển khai riêng** (bước 3 của `CLAUDE.md` §1b), viết ngay
trước khi làm đợt đó — không viết trước cả năm, vì đợt 1 có thể đổi hiểu biết cho
đợt 2.

---

## 7. Đề nghị của tôi cho mục 9 — cái gì đáng lưu để chủ quán duyệt

Chủ quán hỏi tôi nên đề xuất lưu lại những gì. **Bốn thứ, và chỉ bốn:**

1. **Quyết định kinh doanh kèm nguyên văn lời chủ quán.** Đây là thứ đã cứu
   nhiều lần tháng này — và lần tôi *không* ghi nguyên văn (29/08, chuyện xoá
   nhóm nguyên liệu) là lần hồ sơ của tôi mâu thuẫn với chính nó suốt ba ngày.
2. **Số đo tại thời điểm quyết định**, kèm ngày. Không phải để tra sau, mà để
   biết con số đã cũ tới đâu.
3. **Việc chưa xong, kèm cái gì đang chặn.** Danh sách không có chỗ chặn thì
   không dùng được.
4. **Sự cố và luật sinh ra từ nó.** Mỗi luật trong `CLAUDE.md` phải nói được nó
   sinh ra vì chuyện gì — luật không có lý do thì sớm muộn bị bỏ qua.

**Cố ý KHÔNG lưu:** nhật ký ai làm gì ngày nào, kế hoạch đã thực hiện xong, báo
cáo điều tra đã kết luận. Ba thứ này chiếm phần lớn 12 MB sắp xoá, và **không
thứ nào trả lời được câu hỏi nào của hôm nay**.

---

## 8. Cần chủ quán duyệt gì

Bốn câu hỏi của bản trước đã được trả lời ở §2.8–§2.12. **Còn ba chỗ:**

1. **Tám chỗ tài liệu ở §3.2 và mười luồng ở §3.4** — đủ chưa, thừa chỗ nào không?
2. **Ba chỗ chưa giải được ở §5** — chấp nhận, hay muốn tôi nghĩ tiếp trước khi
   bắt đầu?
3. **Bốn thứ đáng lưu ở §7** — đúng ý chủ quán chưa?

**Duyệt xong tôi mới viết kế hoạch triển khai cho đợt 1** (bước 3 của
`CLAUDE.md` §1b).
