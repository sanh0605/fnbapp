# CLAUDE.md — FNB App

Bộ quy tắc duy nhất phải đọc mỗi phiên. Mọi thứ khác chỉ tra khi cần.

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
`DEVELOPMENT-TRACKING.md` là chỗ cả hai cùng ghi. Hôm đó Opus chạy
`git add docs/OPEN-ITEMS.md` trong lúc Sonnet đang sửa mục 38 trong cùng file,
nên một lần lưu nói về kích thước bản sao lưu lại **nuốt luôn** thay đổi của
mục 38. Nội dung không sai, nhưng ai tra lịch sử dòng đó sẽ đọc được một lời
giải thích không liên quan. Không nghiêm trọng, nhưng lặp lại nhiều lần thì
lịch sử mất giá trị — mà lịch sử là thứ mục 10 bảo tra khi cần biết "vì sao có
một luật".

**Hai agent nói chuyện với nhau bằng tiếng Anh** (chủ quán chốt 2026-08-10):
prompt giao việc, phản biện, báo cáo kỹ thuật giữa Opus và Sonnet — tiếng Anh,
vì tốn ít token hơn và chủ quán không phải đọc phần đó.

**Mọi thứ chủ quán đọc thì bằng tiếng Việt**: kết quả, giải thích, câu hỏi, cảnh
báo. Không đổi. Chữ hiển thị trong app cũng vậy (mục 8).

## 2. Mức rủi ro quyết định mọi thứ

Không tra theo đường dẫn file — file sẽ đổi chỗ. Tra theo loại việc:

| Loại việc | Bắt buộc |
|---|---|
| Đụng giá vốn hoặc tồn kho | Có plan; Sonnet phản biện; kèm script kiểm tra chạy lại được |
| Ghi vào dữ liệu thật | Mặc định chạy thử; `--apply` mới ghi; in số lượng và đối tượng chính xác trước khi ghi; chủ quán duyệt lần ghi |
| Xoá dữ liệu gốc (nguyên liệu, món, công thức, đơn, nhà cung cấp) | **Không xoá. Đánh dấu ngừng dùng.** Đơn hàng cũ vẫn cần chúng để giải thích được số của chính nó |
| Lộ ra ngoài repo (push, deploy) | Chủ quán duyệt từng lần. Không có uỷ quyền sẵn |
| Đổi một quy tắc kinh doanh | Sửa luật và sửa test của nó trong cùng một lần lưu |
| Còn lại | Agent tự quyết, làm xong báo lại bằng tiếng Việt dễ hiểu |

## 3. Sửa dữ liệu hàng loạt

Backfill, migration, tính lại lịch sử — dùng skill `fnbapp-bulk-data-change`.

Điều dễ quên nhất, đã gây sự cố 2026-07-31: **liệt kê trigger của bảng sắp sửa
và nói rõ mỗi cái làm gì với những dòng bị đụng.** Một lệnh được coi là "không
đổi hành vi" vẫn có thể kích hoạt trigger rồi hẹn giờ cho một tiến trình tự
động ghi đè dữ liệu lịch sử.

## 4. Ví dụ tính sẵn là bắt buộc

Mọi bước plan đụng dữ liệu thật phải kèm một ví dụ **tính trước bằng số thật**:
một món có tên, một dòng đơn hàng có mã, con số phải ra. Không phải minh hoạ
định dạng — một trường hợp người thực thi đối chiếu được trước khi chạy cả lô.

Và trước khi viết plan, phải xác nhận ý chủ quán tới ~95% **bằng một ví dụ cụ
thể**, không phải bằng cách diễn đạt lại trừu tượng.

Trước khi kết luận từ một truy vấn, nói rõ truy vấn đó **không** cho thấy điều gì.

## 5. Nói chuyện với chủ quán

Chủ quán là người kinh doanh, không phải người viết phần mềm.

- Tiếng Việt, không thuật ngữ. Dùng thì phải giải nghĩa ngay lần đầu.
- **Gọi tên thật** của nguyên liệu và món ("Trứng gà"), không đọc mã ("NNL-007").
- Chỉ hỏi chủ quán **quyết định kinh doanh**: ưu tiên, phạm vi, đánh đổi, bất cứ
  thứ gì đụng tiền thật hoặc không thể quay đầu. Việc kỹ thuật thì tự quyết, làm
  xong báo lại.
- Mỗi lần chỉ hỏi **một** vấn đề. Liệt kê lựa chọn, nêu khuyến nghị, chờ chọn.
- **Chủ động cảnh báo ảnh hưởng chéo.** Nếu việc đang làm có thể ảnh hưởng hoặc
  phụ thuộc việc khác trong cùng phiên, nói ngay — đừng đợi được hỏi. Im lặng bị
  hiểu là "đã kiểm tra và ổn".

## 6. Quy tắc kinh doanh mới sinh ra thế nào

Khi chủ quán chốt điều gì thay đổi **cách tính**, **cách hiển thị số**, hoặc
**cách vận hành**, ghi ngay vào `docs/BUSINESS-RULES.md` trong cùng phiên đó,
kèm ngày. Thứ làm mất một quy tắc không phải là thiếu chỗ ghi — mà là nó được
chốt trong lúc trao đổi rồi trôi đi.

## 7. Tồn kho và giá vốn: nền tảng để suy luận

Cutover xong 2026-08-07 (Plan C), chứng minh trên một đơn bán thật. Thay hẳn
nền tảng cũ chốt 2026-07-22 — tra git log nếu cần biết nền cũ.

1. **Bán hàng không trừ tồn, không tính giá vốn tại lúc bán, không còn lệnh
   nấu ngầm.** `cost_at_sale` vẫn còn cột nhưng luôn 0 — không màn hình nào
   đọc.
2. **`stock_ledger` chỉ còn ghi hàng nhập và kết quả kiểm kê định kỳ.** Mọi
   dòng suy ra kiểu cũ (bán hàng, sản xuất ngầm, điều chỉnh) đã xoá hẳn
   2026-08-07 (Task 5) — chủ đích, không phải lỗi.
3. **Giá vốn tính theo đợt kiểm kê, không theo lần bán.** Đóng kiểm kê ghi
   chênh lệch đếm-thật trừ lý-thuyết vào `stock_issues`, định giá theo bình
   quân gia quyền nguyên liệu mua vào (`lib/issue-costing.ts`).
4. **`stock_issues` hiện RỖNG — trạng thái thật, không phải lỗi.** Mọi báo
   cáo giá vốn hiện 0đ. Nguyên liệu thô: tồn = toàn bộ đã nhập, chưa trừ gì.
   Bán thành phẩm: tồn về 0, không còn nền để tính (`BR-INV-006`). **Lần
   kiểm kê đầu tiên là thứ bật máy tính giá vốn lên**, không phải dọn dẹp.

## 8. Viết code

- **Điện thoại trước, máy tính sau — mọi trang, kể cả bố cục.** Chủ quán chốt
  2026-08-08. Không phải "làm cho chạy được trên màn hẹp", mà là: **thiết kế cho
  điện thoại là bản chính**, máy tính là bản mở rộng ra từ đó. Bố cục cũng vậy,
  không riêng cỡ chữ với khoảng cách.

  Lý do ông ấy nêu bằng việc thật: đếm hàng là đứng trước kệ, hàng vỡ thì ghi tại
  chỗ. Không ai chạy về bàn mở máy tính để ghi một hộp sữa đổ.

  Cụ thể: không bảng ngang trên điện thoại (mỗi dòng một thẻ xếp dọc);
  `inputMode="numeric"` cho mọi ô số; vùng bấm vừa ngón cái; việc dài phải hiện
  tiến độ và **lưu từng bước lên máy chủ** — khoá màn hình giữa chừng không được
  mất việc đã làm.

  Áp dụng cho **trang mới và trang đang sửa**. 28 trang cũ là việc riêng, đã nằm
  ở `docs/OPEN-ITEMS.md` mục 28 — đừng biến quy tắc này thành cái cớ viết lại cả
  admin trong một lượt.

  **Mở rộng, chủ quán chốt 2026-08-17.** Khi tới đợt cải tổ giao diện, phạm vi
  là **toàn bộ hệ thống**, và **điện thoại là bản duy nhất được dựng trước** —
  bản máy tính làm sau, thành một đợt riêng. Lý do ông ấy nêu: thiết bị dùng hệ
  thống nhiều nhất là điện thoại, không phải máy tính.

  Điều này **không huỷ** đoạn trên. Câu "đừng viết lại cả admin trong một lượt"
  vẫn còn hiệu lực và vẫn là cách làm: cải tổ đi từng đợt, mỗi đợt vài trang.
  Cái đổi là **đích đến của mỗi đợt** — trước đây một trang được coi là xong khi
  chạy tốt trên cả hai; từ nay xong nghĩa là **xong trên điện thoại**, và máy
  tính được phép còn thô cho tới đợt sau.

  **Hệ quả phải nói trước, không phải để cãi mà để khỏi bất ngờ:** vài màn hình
  quản trị dày số liệu (báo cáo, danh sách đơn nhập, công thức) trên điện thoại
  **không phải là bảng cũ thu nhỏ** — chúng cần một cách trình bày khác hẳn.
  Nên mỗi trang như vậy tốn công **hơn** là "làm cho responsive", không phải ít
  hơn. Trang Giá trị hàng đã xuất (2026-08-13) là mẫu đã dựng theo lối này:
  không có bảng ngang nào, mỗi mục một thẻ.

  **Không cần đo tỉ lệ thiết bị.** Đề xuất ghi lại người dùng mở bằng máy gì đã
  được nêu và chủ quán bác ngay: ông ấy biết chắc là điện thoại. **Điều kiện xem
  lại là chủ quán tự nêu, không phải một con số** — khi nào bắt đầu dùng máy
  tính thật thì ông ấy sẽ đổi hướng xây dựng. Đừng dựng công cụ đo để "xác nhận"
  một điều đã được chốt.

- **Thứ gì linh hoạt thì phải có chỗ cho chủ quán tự đặt, không nhét cứng vào
  code.** Chủ quán chốt 2026-08-19: *"các điểm mang tính linh hoạt đều phải có
  nơi mà anh có thể tự thiết lập trực tiếp trên hệ thống mà không thông qua
  hardcode."*

  Cụ thể là những thứ đổi theo cách quán vận hành chứ không theo luật kế toán:
  danh sách nhóm chi phí, các khoản chi định kỳ, lịch kiểm kê và số ngày nhắc
  trước, bảng thời hạn khấu hao theo mức giá. Mỗi thứ đó là **một bảng dữ liệu
  kèm một màn hình**, không phải một hằng số trong code.

  Phép thử: nếu chủ quán muốn đổi mà phải chờ sửa code rồi đẩy bản mới, thì đã
  làm sai. Ngược lại, thứ gì đổi được sẽ **đổi kết quả tính toán** — nên phải
  ghi lại giá trị đã dùng tại thời điểm tính, hoặc chấp nhận rằng sửa bảng là
  tính lại toàn bộ (như khấu hao), và nói rõ là cái nào.

- Code và chú thích bằng tiếng Anh. Chữ hiển thị cho người dùng bằng tiếng Việt.
- Đơn giản trước. Không thêm tính năng, trừu tượng, hay tuỳ biến ngoài yêu cầu.
- Chỉ chạm đúng chỗ cần. Không "cải thiện" code lân cận, không refactor thứ
  không hỏng. Thấy code chết không liên quan thì nói, đừng tự xoá.
- Không rõ thì hỏi, đừng đoán.

## 9. Xong việc nghĩa là gì

- `npx tsc --noEmit` — 0 lỗi.
- `npx vitest run` — toàn bộ xanh. Không xoá test mà không nêu lý do.
- `npx vite-node scripts/check-rules-current.ts` — sạch.
- `npm run build` — dựng được. **Ba cửa trên không thay được cửa này.** Next.js
  có ràng buộc riêng mà chúng không biết: ngày 2026-08-05 một hàm đồng bộ được
  export từ file `"use server"` làm web không dựng nổi, trong khi cả ba cửa kia
  vẫn xanh suốt 123 lần lưu. Không ai biết cho tới lúc thử đưa lên máy chủ.
- Việc đụng giá vốn hoặc tồn kho: chạy script kiểm tra tương ứng, 0 sai lệch.
- Ghi một mục vào `DEVELOPMENT-TRACKING.md`, cập nhật `docs/OPEN-ITEMS.md` nếu
  có mục nào đổi trạng thái.
- **Không tự push.** Xong việc là xong ở máy. Đẩy ra ngoài repo là việc riêng,
  chủ quán duyệt từng lần (mục 2) — không phải bước cuối của "xong việc".
- **Deploy xong: phải có người MỞ TRANG SAU KHI ĐĂNG NHẬP.** `curl` trả 307
  không chứng minh gì về trang — 307 là phản hồi cho người **chưa** đăng nhập,
  nên nó chỉ nói máy chủ biết đá về màn hình đăng nhập. Ngày 2026-08-09 trang
  Kiểm Kê hỏng ở mọi lần mở (sắp xếp theo cột `findAllWhere` không nhận), và cả
  bốn cửa — tsc, vitest, build, curl 307 — đều xanh. Chủ quán mở bằng mắt mới
  thấy. Cửa nào không thể thất bại thì không phải cửa.

## 10. Tra ở đâu

| Cần gì | Ở đâu |
|---|---|
| Việc chưa xong | `docs/OPEN-ITEMS.md` |
| Cách tính, nguyên tắc hiển thị số | `docs/BUSINESS-RULES.md` |
| Quán là gì, phạm vi tới đâu | `CONTEXT.md` |
| Đã làm gì, khi nào | `DEVELOPMENT-TRACKING.md` |
| Thuật ngữ | `docs/domain-dictionary.md` |
| Cách chạy máy, công nghệ dùng gì | `README.md` |
| File mới đặt ở đâu | `docs/FILE-ORGANIZATION.md` |
| Vì sao có một luật | git log |
| Màn hình, hành động phía máy chủ | `app/` |
| Bộ máy tính: giá vốn, tồn kho, báo cáo | `lib/` |
| Giao diện dùng chung | `components/` |
| Cập nhật cấu trúc dữ liệu | `supabase/migrations/` |

Bốn dòng cuối là thư mục code, tạm tới khi chia lại theo mảng nghiệp vụ.
