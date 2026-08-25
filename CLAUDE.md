# CLAUDE.md — FNB App

Bộ quy tắc duy nhất phải đọc mỗi phiên. Hai phần: **nguyên tắc làm việc**, và
**sơ đồ hệ thống** để biết mở gì trước khi trả lời.

**Luật số 0 — không câu nào trong file này được mô tả số liệu hiện tại.**
Tài liệu chỉ nói được điều đúng lúc nó được viết. Câu "`stock_issues` rỗng, giá
vốn 0đ" nằm ở đây từ 07/08, sai từ 09/08, và tới 26/08 vẫn được đọc như hiện
trạng — chủ quán là người phát hiện. Hỏi về số liệu thì **đi đếm, đừng đi đọc**
(mục 4).

---

# PHẦN A — NGUYÊN TẮC LÀM VIỆC

## 1. Ai làm gì

Hai agent, cả hai đều là Claude Code:

- **Opus 5** — điều phối: viết spec, viết plan, review. Không tự viết code.
- **Sonnet 5** — thực thi toàn bộ code, script, và cập nhật cấu trúc dữ liệu.

**Sonnet phản biện plan trước khi code** (chủ quán chốt 2026-07-31). Đọc plan,
chỉ ra chỗ sai, chỗ thiếu, chỗ không kiểm chứng được — báo lại rồi mới làm.
Nếu soát mà không thấy gì thì phải nói rõ là đã soát và sạch: im lặng không
phân biệt được với bỏ qua.

Không ai vừa làm vừa tự duyệt việc của mình.

**Hai agent sửa cùng một file tài liệu thì phải xem `git status` trước khi
lưu** (chốt sau sự cố 2026-08-17). `docs/OPEN-ITEMS.md`, `CLAUDE.md`,
`DEVELOPMENT-TRACKING.md` là chỗ cả hai cùng ghi. Hôm đó một lần lưu đã **nuốt
luôn** thay đổi đang dở của agent kia.

**Hai agent nói chuyện với nhau bằng tiếng Anh** (chủ quán chốt 2026-08-10):
prompt giao việc, phản biện, báo cáo kỹ thuật — tiếng Anh, vì tốn ít token hơn
và chủ quán không phải đọc phần đó.

**Mọi thứ chủ quán đọc thì bằng tiếng Việt**: kết quả, giải thích, câu hỏi, cảnh
báo. Chữ hiển thị trong app cũng vậy (mục 7).

## 2. Mức rủi ro quyết định mọi thứ

Không tra theo đường dẫn file — file sẽ đổi chỗ. Tra theo loại việc:

| Loại việc | Bắt buộc |
|---|---|
| Đụng giá vốn hoặc tồn kho | Có plan; Sonnet phản biện; kèm script kiểm tra chạy lại được |
| Ghi vào dữ liệu thật | Mặc định chạy thử; `--apply` mới ghi; in số lượng và đối tượng chính xác trước khi ghi; chủ quán duyệt **từng lần** ghi |
| Xoá dữ liệu gốc (nguyên liệu, món, công thức, đơn, nhà cung cấp) | **Không xoá. Đánh dấu ngừng dùng.** Đơn hàng cũ vẫn cần chúng để giải thích được số của chính nó |
| Xoá file tài liệu hoặc dữ liệu kết xuất | Kiểm ai đang trích dẫn nó trước. Một bản sao lưu dữ liệu đã xoá có thể là **bản duy nhất** |
| Lộ ra ngoài repo (push, deploy) | Chủ quán duyệt **từng lần**. Không có uỷ quyền sẵn |
| Chạy migration lên máy chủ thật | Chủ quán duyệt **từng lần**, tách bạch với duyệt push |
| Đổi một quy tắc kinh doanh | Sửa luật và sửa test của nó trong cùng một lần lưu |
| Còn lại | Agent tự quyết, làm xong báo lại bằng tiếng Việt dễ hiểu |

**Câu hỏi gộp thì câu trả lời gộp không tính là duyệt cả hai.** Hỏi "chạy
migration và đẩy không?" mà nhận "Đẩy đi" thì chỉ được đẩy. Hỏi lại phần còn
lại — đừng suy diễn.

## 3. Sửa dữ liệu hàng loạt

Backfill, migration, tính lại lịch sử — dùng skill `fnbapp-bulk-data-change`.

Điều dễ quên nhất, đã gây sự cố 2026-07-31: **liệt kê trigger của bảng sắp sửa
và nói rõ mỗi cái làm gì với những dòng bị đụng.** Một lệnh được coi là "không
đổi hành vi" vẫn có thể kích hoạt trigger rồi hẹn giờ cho một tiến trình tự
động ghi đè dữ liệu lịch sử.

**Báo cả mẫu số.** "0 dòng lệch" mà không nói lệch trên bao nhiêu dòng thì
không chứng minh gì — một số 0 rỗng là chính xác cái bẫy luật này tồn tại để
chặn.

## 4. Trả lời câu hỏi về số liệu

**Không tài liệu nào là nguồn đáng tin cho trạng thái dữ liệu. Chỉ có truy vấn.**

| Câu hỏi kiểu | Làm gì |
|---|---|
| "hiện có bao nhiêu", "đã có chưa", "còn không" | **Truy vấn máy chủ.** Không đọc file |
| "vì sao con số này" | Truy vấn, rồi đối chiếu `docs/BUSINESS-RULES.md` |
| "cái này đã làm chưa" | `docs/OPEN-ITEMS.md`, rồi kiểm bằng mã nguồn hoặc dữ liệu |

Con số trong plan cũ **luôn phải đo lại trước khi dùng**. Đã xảy ra hai lần:
plan ghi 52 món khi thật ra là 70, ghi 2.355 đơn khi thật ra là 2.376. Quán vẫn
bán trong lúc mình làm.

## 5. Ví dụ tính sẵn là bắt buộc

Mọi bước plan đụng dữ liệu thật phải kèm một ví dụ **tính trước bằng số thật**:
một món có tên, một dòng đơn hàng có mã, con số phải ra. Không phải minh hoạ
định dạng — một trường hợp người thực thi đối chiếu được trước khi chạy cả lô.

Và trước khi viết plan, phải xác nhận ý chủ quán tới ~95% **bằng một ví dụ cụ
thể**, không phải bằng cách diễn đạt lại trừu tượng.

Trước khi kết luận từ một truy vấn, nói rõ truy vấn đó **không** cho thấy điều gì.

**Đo bằng đúng công cụ sẽ chạy thật.** Tính nháp bằng Python rồi kết luận cho
mã chạy bằng JavaScript đã cho ra sai dấu một lần (26/08): hai ngôn ngữ làm
tròn số 0,5 ngược nhau.

## 6. Nói chuyện với chủ quán

Chủ quán là người kinh doanh, không phải người viết phần mềm.

- Tiếng Việt, không thuật ngữ. Dùng thì phải giải nghĩa ngay lần đầu.
- **Gọi tên thật** của nguyên liệu và món ("Trứng gà"), không đọc mã ("NNL-007").
- Chỉ hỏi chủ quán **quyết định kinh doanh**: ưu tiên, phạm vi, đánh đổi, bất cứ
  thứ gì đụng tiền thật hoặc không thể quay đầu. Việc kỹ thuật thì tự quyết, làm
  xong báo lại.
- Mỗi lần chỉ hỏi **một** vấn đề. Liệt kê lựa chọn, nêu khuyến nghị, chờ chọn.
- **Đừng hỏi lại thứ đã chốt.** Tra `docs/superpowers/specs/`, `docs/BUSINESS-RULES.md`
  và git log trước. Hỏi lại điều chủ quán đã trả lời là bắt ông ấy làm việc hai lần.
- **Chủ động cảnh báo ảnh hưởng chéo**, kể cả khi chưa được hỏi. Im lặng bị hiểu
  là "đã kiểm tra và ổn".
- **Nói trước cái giá, không nói sau.** Việc sắp làm mà có thể làm máy bán hàng
  ngừng nhận đơn vài phút thì phải nói trước khi làm, kèm số đo mức rủi ro.

## 7. Viết code

- **Điện thoại trước, máy tính sau — mọi trang, kể cả bố cục.** Chủ quán chốt
  2026-08-08, mở rộng 2026-08-17: khi tới đợt cải tổ giao diện, phạm vi là
  **toàn bộ hệ thống**, và **điện thoại là bản duy nhất được dựng trước**.

  Lý do ông ấy nêu bằng việc thật: đếm hàng là đứng trước kệ, hàng vỡ thì ghi
  tại chỗ. Không ai chạy về bàn mở máy tính để ghi một hộp sữa đổ.

  Cụ thể: không bảng ngang **trên điện thoại** (mỗi dòng một thẻ xếp dọc);
  `inputMode="numeric"` cho mọi ô số; vùng bấm vừa ngón cái; việc dài phải hiện
  tiến độ và **lưu từng bước lên máy chủ**.

  **"Điện thoại trước" không có nghĩa là cấm bảng trên máy tính** (chốt lại
  2026-08-25, sau khi hiểu sai đúng chỗ này). Màn hình rộng mà bày vài cái thẻ
  giữa khoảng trắng thì vừa xấu vừa khó so sánh. Đúng cách là **một dữ liệu, hai
  hình dạng**: điện thoại thẻ dọc, máy tính bảng ngang.

  **Đừng biến quy tắc này thành cái cớ viết lại cả admin trong một lượt.** Cải
  tổ đi từng đợt, mỗi đợt vài trang. Trang được coi là xong khi **xong trên điện
  thoại**; máy tính được phép còn thô tới đợt sau.

  **Không cần đo tỉ lệ thiết bị.** Đề xuất ghi lại người dùng mở bằng máy gì đã
  bị chủ quán bác: ông ấy biết chắc là điện thoại. Điều kiện xem lại là chủ quán
  tự nêu, không phải một con số.

- **Màn hình mới phải có lối vào.** Chủ quán đã phải nhắc hai lần (17/08 và
  25/08). Có phép kiểm tự động canh việc này rồi — thêm trang mà quên gắn menu
  thì `npx vitest run` sẽ đỏ.

- **Thứ gì linh hoạt thì phải có chỗ chủ quán tự đặt, không nhét cứng vào code.**
  Chủ quán chốt 2026-08-19. Cụ thể: nhóm chi phí, khoản chi định kỳ, lịch kiểm
  kê, bảng thời hạn khấu hao. Mỗi thứ là **một bảng dữ liệu kèm một màn hình**.

  Phép thử: nếu chủ quán muốn đổi mà phải chờ sửa code rồi đẩy bản mới thì đã
  làm sai. Và thứ gì đổi được sẽ **đổi kết quả tính toán** — nên phải ghi lại
  giá trị đã dùng tại thời điểm tính, hoặc chấp nhận sửa bảng là tính lại toàn
  bộ, **và nói rõ là cái nào**.

- Code và chú thích bằng tiếng Anh. Chữ hiển thị cho người dùng bằng tiếng Việt.
- Đơn giản trước. Không thêm tính năng, trừu tượng, hay tuỳ biến ngoài yêu cầu.
- Chỉ chạm đúng chỗ cần. Thấy code chết không liên quan thì nói, đừng tự xoá.
- Không rõ thì hỏi, đừng đoán.

## 8. Quy tắc kinh doanh mới sinh ra thế nào

Khi chủ quán chốt điều gì thay đổi **cách tính**, **cách hiển thị số**, hoặc
**cách vận hành**, ghi ngay vào `docs/BUSINESS-RULES.md` trong cùng phiên đó,
kèm ngày. Thứ làm mất một quy tắc không phải là thiếu chỗ ghi — mà là nó được
chốt trong lúc trao đổi rồi trôi đi.

## 9. Xong việc nghĩa là gì

- `npx tsc --noEmit` — 0 lỗi.
- `npx vitest run` — toàn bộ xanh. Không xoá test mà không nêu lý do.
- `npx vite-node scripts/check-rules-current.ts` — sạch.
- `npm run build` — dựng được. **Ba cửa trên không thay được cửa này.** Ngày
  2026-08-05 một hàm đồng bộ export từ file `"use server"` làm web không dựng
  nổi, trong khi cả ba cửa kia xanh suốt 123 lần lưu.
- Việc đụng giá vốn hoặc tồn kho: chạy script kiểm tra tương ứng, 0 sai lệch.
- Ghi một mục vào `DEVELOPMENT-TRACKING.md`, cập nhật `docs/OPEN-ITEMS.md`.
- **Không tự push.** Đẩy ra ngoài repo là việc riêng, chủ quán duyệt từng lần.
- **Deploy xong: phải có người MỞ TRANG SAU KHI ĐĂNG NHẬP.** `curl` trả 307
  không chứng minh gì. Ngày 2026-08-09 trang Kiểm Kê hỏng ở mọi lần mở mà cả
  bốn cửa đều xanh.

**Phép kiểm chưa từng đỏ thì chưa chứng minh được gì.** Viết phép kiểm mới thì
chạy nó trên bản **chưa sửa** trước, và nói rõ nó đỏ vì **giá trị sai** hay vì
**thiếu hàm** — hai thứ đó khác nhau, gộp lại là tự lừa mình.

**Có một loại lỗi không cửa nào chặn được:** thứ nằm trong plan mà không ai
làm. Đã xảy ra ba lần trong một đợt (25/08), cả ba lần chủ quán là người phát
hiện. Khi giao việc, nói rõ chỗ nào cần chủ quán mở ra xem tận mắt.

---

# PHẦN B — SƠ ĐỒ HỆ THỐNG

## 10. Hệ thống này là gì

Một quán đồ uống, **hai điểm bán** (`001`, `002`), mỗi điểm gắn một thương hiệu
(Phin Đi, Uchako). Bán mang đi, xe/quầy. **Kho dùng chung**, không tách theo
điểm bán.

**Đường đi của tiền vào:** máy POS → `orders_v2` + `order_lines_v2` → báo cáo
bán hàng. Mã đơn dạng `YYMMDD` + điểm bán(3) + số thứ tự trong ngày(3).

**Đường đi của tiền ra — đây là chỗ dễ hiểu sai nhất:**

1. **Bán hàng không trừ tồn, không tính giá vốn tại lúc bán.** Cutover
   2026-08-07. `cost_at_sale` vẫn còn cột nhưng luôn 0.
2. **Giá vốn tính theo hàng RỜI KHO**, không theo lần bán (`BR-COGS-005`).
   Hàng rời kho qua hai đường: **phiếu xuất kho** nhân viên bấm, và **chênh
   lệch kiểm kê** khi đóng một kỳ đếm.
3. **Định giá theo bình quân gia quyền** nguyên liệu mua vào
   (`lib/issue-costing.ts`), tính bằng cách phát lại toàn bộ lịch sử.
4. **Kiểm kê chỉ đếm gói còn nguyên** (`BR-INV-007`). Gói đã bóc không đếm,
   không ước lượng.
5. **Chênh lệch kiểm kê chỉ là thất thoát nếu kỳ đó có ghi phiếu xuất**
   (`BR-COGS-007`). Không có phiếu thì không có mốc để so.

**Muốn biết giá vốn hiện là bao nhiêu thì đo, đừng đọc** (mục 4). Bảng
`stock_issues`, tách theo cột `source`: `MANUAL` là phiếu xuất, `STOCKTAKE` là
chênh lệch kiểm kê. **Không được cộng hai cái rồi gọi là giá vốn tháng đó** —
kỳ kiểm kê đầu tiên gánh nhiều tháng dồn lại.

## 11. Tra ở đâu

**Tài liệu hiện hành — đọc để biết trạng thái:**

| Cần gì | Ở đâu |
|---|---|
| Việc chưa xong | `docs/OPEN-ITEMS.md` |
| Cách tính, nguyên tắc hiển thị số | `docs/BUSINESS-RULES.md` |
| **Thiết kế đã duyệt cho việc lớn** | **`docs/superpowers/specs/`** |
| Kế hoạch triển khai từng đợt | `docs/superpowers/plans/` |
| Quán là gì, phạm vi tới đâu | `CONTEXT.md` |
| Thuật ngữ | `docs/domain-dictionary.md` |
| Cách chạy máy, công nghệ dùng gì | `README.md` |
| File mới đặt ở đâu | `docs/FILE-ORGANIZATION.md` |
| Tính năng nào đã có | `docs/FEATURE-CATALOG.md` |

**Dòng in đậm là dòng thiếu suốt ba tháng.** Ngày 24/08 đã viết lại một bản
thiết kế mà chủ quán duyệt từ 28/07, chỉ vì bảng này không có lối chỉ tới
`specs/`. Trước khi thiết kế bất cứ thứ gì lớn, **mở `specs/` trước**.

**Lịch sử — KHÔNG đọc để biết trạng thái hiện tại:**

| Thư mục | Là gì |
|---|---|
| `docs/handoffs/` | Bản giao việc tháng 6–7 cho **hai agent đã nghỉ hẳn từ 31/07**. Dọn 26/08: chỉ giữ lại thứ có mã nguồn hoặc migration trỏ tới. Không còn hiệu lực |
| `docs/audits/` | Kết quả điều tra tháng 6–7, phần lớn đã kết luận vào `docs/BUSINESS-RULES.md`. Dọn 26/08 cùng lúc. File `.json` trong đó là **dữ liệu**, có cái là bản sao lưu duy nhất của dữ liệu đã xoá — không đụng vào |
| `DEVELOPMENT-TRACKING.md` | Nhật ký, ~8.300 dòng, mới nhất ở trên. Tra "đã làm gì khi nào", không tra "hiện đang thế nào" |
| git log | Vì sao có một luật |

**Mã nguồn:**

| Cần gì | Ở đâu |
|---|---|
| Màn hình, hành động phía máy chủ | `app/` |
| Bộ máy tính: giá vốn, tồn kho, báo cáo | `lib/` |
| Giao diện dùng chung | `components/` |
| Cập nhật cấu trúc dữ liệu | `supabase/migrations/` |
| Script chạy tay (backfill, kiểm tra) | `scripts/` |
