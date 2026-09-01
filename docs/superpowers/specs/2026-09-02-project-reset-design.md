# Dựng lại nền tài liệu và quy trình cho toàn dự án

**Written 2026-09-02 by Opus 5.** Bước 1+2 của `CLAUDE.md` §1b — đặc tả và thiết
kế. **Chưa phải kế hoạch triển khai.**

**Status: chờ chủ quán duyệt.** Chưa duyệt thì chưa ai được bắt tay làm.

**Chủ quán yêu cầu 02/09**, và nói rõ đây là việc ưu tiên cao nhất, gác mọi thứ
khác. Ông ấy cũng yêu cầu **phỏng vấn trước khi lập kế hoạch** — đã phỏng vấn 6
câu, kết quả ở §2.

---

## 1. Vì sao làm việc này — đo, không phải cảm tính

### 1.1 Quy mô hiện tại

| | |
|---|---:|
| Kế hoạch triển khai | **101 file** |
| Tài liệu thiết kế | **33 file** |
| File kiểm toán | **100 file, 11,7 MB** |
| Bản giao việc | 3 file |
| Nhật ký phát triển | **9.252 dòng** |
| Script chạy tay | **207 file** |
| Mã nguồn | 291 file + 224 file kiểm |
| Migration | 96 file |

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
| 4 cửa `CLAUDE.md` §9 | `tsc`, 1.605 phép kiểm, luật, dựng web |

**Đây là căn cứ cho quyết định §2.3.** Không phải sở thích — là thứ đã đo được.

## 2. Chủ quán đã chốt gì — phỏng vấn 02/09

**Ghi nguyên văn lựa chọn, vì đây là căn cứ cho mọi việc phía sau.**

### 2.1 Xoá sạch `docs/audits` — 100 file, 11,7 MB

**Đã nói trước hậu quả và chủ quán vẫn chọn:** trong đó có **bản sao lưu duy
nhất** của sổ kho cũ (5,2 MB, 10.734 dòng), công thức, và bảng số dư.

**Sau việc này chúng không còn ở đâu nữa. Đây là chủ ý, không phải sơ suất.**

### 2.2 Xoá thẳng hồ sơ cũ, không gộp nội dung

101 kế hoạch + 33 thiết kế + 3 giao việc + nhật ký 9.252 dòng. **Không đọc lại
để rút nội dung.**

**Hệ quả bắt buộc, và nó định hình cả đợt:** bộ tài liệu mới **phải viết từ mã
nguồn và dữ liệu đang chạy**, không được chép lại từ hồ sơ cũ. Thực ra sạch hơn
— hồ sơ cũ chính là thứ đã sai bảy lần ở §1.2.

**`docs/BUSINESS-RULES.md` (478 dòng) KHÔNG nằm trong danh sách xoá** — nó là
tài liệu hiện hành, và mục 8 của chủ quán yêu cầu cập nhật nó chứ không bỏ.

### 2.3 Máy canh tối đa, văn bản là phụ

> Mỗi quy tắc quan trọng phải có một phép kiểm tự động đi kèm, **không thì không
> được coi là luật**.

### 2.4 Tài liệu trước, chuyển chỗ mã nguồn sau

Đợt này **không di chuyển file mã nguồn nào** trong `app/`, `lib/`,
`components/`. Việc đó tách riêng, làm sau khi đã có sơ đồ để biết cái gì đụng
cái gì.

### 2.5 Đặc tả theo luồng việc, không theo màn hình

6-8 tài liệu, mỗi cái một luồng kinh doanh. Không phải 30 tài liệu theo màn hình.

### 2.6 Hai bản đồ, và bản vẽ tay phải có phép kiểm canh

> *"Cả 2, nhưng phải đảm bảo cập nhật theo kịp với thông tin mới nhất."*

Máy sinh bản đầy đủ để tra cứu; người vẽ bản gọn để hiểu toàn cảnh; **và một
phép kiểm báo đỏ khi mã nguồn lệch khỏi bản vẽ tay.**

### 2.7 Xoá hết 207 script rồi dựng lại

> *"Xóa hết rồi xây dựng lại xong liên tục cập nhật theo mã nguồn."*

**Một chỗ tôi phải làm ngược lại thứ tự chữ:** trong 207 file đó có
`verify-revenue.ts` và `check-rules-current.ts` — **hai cửa kiểm bắt buộc của
`CLAUDE.md` §9**. Xoá trước là có một quãng **không còn gì canh doanh thu**.

**Nên: dựng bộ mới trước, chứng minh nó chạy và bắt được lỗi, RỒI mới xoá bộ
cũ.** Kết quả giống ý chủ quán, chỉ khác thứ tự, và không có khoảng hở.

---

## 3. Thiết kế bộ tài liệu mới

### 3.1 Nguyên tắc: mỗi tài liệu trả lời một câu hỏi có thật

Không viết tài liệu vì "nên có". Mỗi file dưới đây tồn tại vì có một câu hỏi cụ
thể mà hôm nay **không ai trả lời nhanh được**.

### 3.2 Bảy tài liệu gốc

| File | Trả lời câu hỏi | Ai đọc |
|---|---|---|
| `CLAUDE.md` | *"Tôi phải làm việc thế nào, và đi đâu tiếp?"* | AI, mỗi phiên |
| `docs/HE-THONG.md` | *"Quán này là gì, hệ thống làm gì cho nó?"* | Người mới — DEV, BA, BM |
| `docs/BAN-DO.md` | *"Sửa chỗ này thì đụng những đâu?"* | AI và DEV, trước mỗi lần sửa |
| `docs/TU-DIEN.md` | *"Từ này nghĩa là gì trong quán này?"* | Tất cả |
| `docs/BUSINESS-RULES.md` | *"Tiền tính thế nào, vì sao?"* | Chủ quán, BA |
| `docs/luong/*.md` (6-8 file) | *"Việc này chạy từ đầu tới cuối ra sao?"* | Tất cả |
| `docs/VIEC-DANG-LAM.md` | *"Cái gì chưa xong?"* | Chủ quán, AI |

**Bảy chỗ, không hơn.** Mỗi chỗ thêm là một chỗ nữa có thể cũ đi.

### 3.3 `CLAUDE.md` — vai trò đổi hẳn

**Hôm nay:** 524 dòng, vừa là luật vừa là mô tả hệ thống vừa là lịch sử sự cố.
Chính nó đã sai suốt 19 ngày về giá vốn.

**Sau đợt này: nó chỉ còn hai việc** — nói luật làm việc, và **chỉ đường**. Mọi
mô tả hệ thống chuyển sang `docs/HE-THONG.md` và `docs/BAN-DO.md`.

**Vì sao tách:** luật thì hiếm khi đổi; mô tả hệ thống thì đổi mỗi tuần. Trộn
chung là bảo đảm phần luật bị nghi ngờ theo phần mô tả đã cũ.

**Luật số 0 giữ nguyên và nâng lên đầu:** không câu nào trong `CLAUDE.md` được
mô tả số liệu hiện tại.

### 3.4 Sáu luồng việc — `docs/luong/`

| File | Nội dung |
|---|---|
| `ban-hang.md` | Máy POS → đơn → sửa đơn, huỷ đơn → doanh thu |
| `mua-hang.md` | Đơn nhập → nhận hàng → tồn tăng |
| `xuat-kho.md` | Phiếu xuất → giá vốn |
| `kiem-ke.md` | Mở kỳ → đếm → chốt → hao hụt |
| `tai-san.md` | Mua dụng cụ → khấu hao → thanh lý |
| `bao-cao.md` | Ba báo cáo hiện có, số lấy từ đâu |

Mỗi file trả lời **năm câu giống nhau** — chính năm câu `CLAUDE.md` §1b đang bắt
mọi kế hoạch phải trả lời: trạng thái, nút bấm, danh sách, giá trị hợp lệ, và
cố ý không phục vụ gì.

**Dùng lại đúng khung đó có lý do:** nó đã bắt được lỗi thật nhiều lần tháng này
— màn hình POS mời bấm vào món không bán được, phiếu xuất cắt giữa phiếu, nút xoá
từ chối trong im lặng.

### 3.5 Bản đồ — hai lớp, một phép kiểm

**Lớp máy sinh** (`docs/BAN-DO-SINH.md`): công cụ đọc mã nguồn và vẽ ra màn hình
nào gọi hàm nào, hàm nào đụng bảng nào, bảng nào có ai đọc. **Chạy lại là đúng.**

**Lớp người vẽ** (`docs/BAN-DO.md`): sơ đồ gọn cho người hiểu toàn cảnh.

**Phép kiểm nối hai lớp** — đây là phần chủ quán nhấn mạnh: nếu bản máy sinh có
một quan hệ mà bản vẽ tay không nhắc tới, **phép kiểm báo đỏ**.

**Việc này giải quyết đúng thứ đã làm tôi sai nhiều nhất tháng này:** không thấy
chỗ liên đới. Hàm huỷ đơn ẩn khỏi phép quét 6 ngày; khoá ngoại tôi báo "không
có" mà có thật; ba nơi đọc bảng số dư mà kế hoạch chỉ liệt kê một.

### 3.6 Quy trình giữ cho tài liệu không cũ

**Đây là mục 4 của chủ quán, và là chỗ mọi lần trước đã hỏng.**

| Đổi cái gì | Bắt buộc kèm | Máy canh bằng |
|---|---|---|
| Thêm/xoá màn hình | Sửa `docs/luong/` tương ứng | Phép kiểm đối chiếu danh sách route |
| Đổi cách tính tiền | Sửa `BUSINESS-RULES.md` | Phép kiểm quy tắc ↔ phép kiểm mã |
| Thêm/xoá bảng dữ liệu | Sửa `BAN-DO.md` | Phép kiểm lệch bản đồ (§3.5) |
| Đổi thuật ngữ | Sửa `TU-DIEN.md` | Phép kiểm từ dùng trong màn hình |
| Xong một việc | Sửa `VIEC-DANG-LAM.md` | — *(xem §5.2, chưa giải được)* |

## 4. Cái gì bị xoá

| Xoá | Số lượng | Ghi chú |
|---|---:|---|
| `docs/audits/` | 100 file, 11,7 MB | **Gồm bản sao lưu duy nhất** (§2.1) |
| `docs/superpowers/plans/` | 101 file | |
| `docs/superpowers/specs/` | 33 file | **Trừ chính file này** cho tới khi duyệt xong |
| `docs/handoffs/` | 3 file | |
| `DEVELOPMENT-TRACKING.md` | 9.252 dòng | |
| `scripts/` | 207 file | **Dựng bộ mới trước** (§2.7) |

**Git vẫn giữ tất cả.** Trừ một chuyện: `docs/audits/*.json` là **dữ liệu**, và
sau khi xoá thì chỉ còn trong lịch sử git — không còn trên đĩa.

## 5. Chỗ tôi CHƯA giải được — nói ra để chủ quán biết

### 5.1 Đặc tả luồng việc sẽ cũ đi, và tôi chưa có cách canh

Sáu tài liệu luồng việc là **văn xuôi mô tả hành vi**. Máy kiểm được tên file và
tên route, **không kiểm được câu "bấm nút này thì tiền đi đường kia"**.

Đây là mâu thuẫn thật với §2.3. **Tôi chưa có lời giải, và không giả vờ là có.**
Cách giảm nhẹ: mỗi tài liệu luồng việc phải kèm **danh sách file** nó mô tả, và
phép kiểm báo đỏ nếu file đó biến mất — không chứng minh nội dung đúng, nhưng
bắt được lúc nội dung nói về thứ không còn tồn tại.

### 5.2 `VIEC-DANG-LAM.md` không có cách canh nào

Danh sách việc chưa xong **chỉ đúng nếu người ta chịu cập nhật**. Tháng này nó
sai hai lần (mục đã xong 3 ngày vẫn mở) và tôi báo sai trạng thái migration ba
lần.

Máy không biết một việc đã xong hay chưa. **Chưa có lời giải.**

### 5.3 Xoá `docs/audits` là mất khả năng dựng lại

Sau §2.1, nếu sau này chủ quán hỏi *"công thức món X hồi tháng 6 là gì"* thì
**không trả lời được nữa** — kể cả từ git, vì file đó sẽ không còn trên đĩa và
phải đi đào lịch sử.

Chủ quán đã biết và vẫn chọn. Ghi lại để sau này không ai ngạc nhiên.

## 6. Việc này to tới đâu

**Ước lượng, và tôi nói rõ đây là ước lượng:**

| Phần | Nặng nhất ở chỗ nào |
|---|---|
| Công cụ sinh bản đồ | Nặng — phải đọc được cả `app/`, `lib/`, và migration |
| Sáu tài liệu luồng việc | Nặng — phải đọc mã nguồn để viết, không chép hồ sơ cũ |
| Dựng lại bộ script | Vừa — nhưng hai cửa kiểm phải xong trước khi xoá |
| Viết lại `CLAUDE.md` | Vừa |
| Từ điển, mô tả hệ thống | Nhẹ |
| Xoá | Nhẹ, nhưng **không quay đầu** |

**Đây không phải việc một buổi.** Tôi sẽ chia thành từng đợt có thể dừng giữa
chừng, mỗi đợt tự đứng được — chứ không phải một lần đập hết rồi dựng lại.

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
cáo điều tra đã kết luận. Ba thứ này chiếm phần lớn 11,7 MB sắp xoá, và **không
thứ nào trả lời được câu hỏi nào của hôm nay**.

---

## 8. Cần chủ quán duyệt gì

1. **Bộ bảy tài liệu ở §3.2** — đúng chỗ, đủ chỗ chưa?
2. **Sáu luồng việc ở §3.4** — có luồng nào thiếu, hay có cái không cần?
3. **Hai chỗ chưa giải được ở §5.1 và §5.2** — chấp nhận, hay muốn tôi nghĩ tiếp
   trước khi bắt đầu?
4. **Cách chia đợt ở §6** — làm dần từng đợt, hay muốn xong trong một lần?

**Duyệt xong tôi mới viết kế hoạch triển khai** (bước 3 của `CLAUDE.md` §1b).
