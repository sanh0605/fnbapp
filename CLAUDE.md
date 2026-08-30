# CLAUDE.md — FNB App

Bộ quy tắc duy nhất phải đọc mỗi phiên. Hai phần: **nguyên tắc làm việc**, và
**sơ đồ hệ thống** để biết mở gì trước khi trả lời.

**Quy ước bắt buộc trong mọi tài liệu và skill: viết đường dẫn theo lối kho mã**
— bắt đầu bằng `app/`, `lib/`, `scripts/`, `docs/`, `supabase/`, `types/`,
`.claude/` — chứ đừng viết kiểu URL bắt đầu bằng dấu gạch chéo. Cửa
`check-rules-current` chỉ nhận dạng lối thứ nhất, nên một file hay route bị gỡ
mà tài liệu còn nhắc sẽ **đỏ ngay lúc lưu**; viết lối kia thì lọt qua.

Đo 26/08 bằng một tài liệu thử chứa cùng một route viết hai kiểu: kiểu đúng bị
chặn, kiểu kia không. **Và cửa này bắt luôn ví dụ minh hoạ đầu tiên của chính
đoạn văn này** — nên đừng đóng khung một đường dẫn không có thật để làm ví dụ.

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

## 1b. Bốn bước, và bước nào cũng nằm trong file này

**Chủ quán chốt 31/08.** Luật này viết đủ ngay tại đây, **không trỏ sang file
khác**. Lý do ông ấy nêu: đọc hết `CLAUDE.md` rồi *tự quyết đọc gì tiếp* — và
chính chỗ tự quyết đó là chỗ bỏ sót. Nguyên tắc này đã nằm trong bản thiết kế
01/08 (*"luật nằm ở chỗ máy tự nạp, không nằm ở file phải nhớ mở"*) và vẫn bị
vi phạm.

**Đo 31/08: 25 kế hoạch triển khai trong 7 ngày, 0 tài liệu thiết kế trong 29
ngày.** Quy trình thật đang là *kế hoạch → code*.

Hậu quả không phải lỗi khó. Sáu thứ chủ quán phải tự phát hiện trong một tuần —
bộ lọc "Ngừng bán" cho một trạng thái không đặt được, không có nút ngừng bán,
phiếu xuất chưa từng chạy cho vật tư tiêu hao, tồn không đổi theo quy cách,
dụng cụ nằm trong danh sách phiếu xuất, ngày thanh lý không bị kiểm — **cả sáu
đều là "chưa ai viết ra thứ này là gì"**, không cái nào là đánh đổi lợi hại.

### Bốn bước

| Bước | Là gì | Ai đọc |
|---|---|---|
| **1. Đặc tả** | Chủ quán cần gì, tính năng phục vụ ai, cố ý **không** phục vụ ai | Chủ quán |
| **2. Thiết kế** | Hình dạng: trạng thái, ô nhập, danh sách, nút, luồng tiền | Chủ quán duyệt, Sonnet đọc |
| **3. Kế hoạch** | Sửa file nào, đo bằng gì, cái gì có thể vỡ | Sonnet |
| **4. Code** | Sonnet viết, phản biện trước khi viết | — |

### Bước nào áp dụng — mốc phải MÁY nhìn ra được

**Tạo thứ chưa từng có** — bảng dữ liệu mới, màn hình mới, khái niệm mới →
**đủ bốn bước**, đặc tả và thiết kế lưu vào `docs/superpowers/specs/`.

**Sửa thứ đã có** → **bước 2 rút gọn nằm trong kế hoạch** (xem dưới) rồi bước
3, 4.

**Không được tự chấm việc mình sắp làm là lớn hay nhỏ.** Luật cũ ghi *"trước
khi thiết kế việc lớn thì mở specs"* và hỏng ba lần, mỗi lần vì người đánh giá
chính là người sắp làm. Mốc mới nhìn được bằng mắt: migration có `create table`
không; `app/` có thêm thư mục không.

### Mục mô tả hiện trạng — bắt buộc trong MỌI kế hoạch

**Viết trước khi bàn tới thay đổi.** Không phải danh sách câu hỏi đưa chủ quán
trả lời — **là bản mô tả do mình viết, để ông ấy đọc và bác.** Đưa câu hỏi là
đẩy phần đảm bảo đủ về phía ông ấy; đưa mô tả thì ông ấy chỉ cần nói "sai chỗ
này".

Tối thiểu: có mấy trạng thái và đặt bằng cách nào; màn hình có nút nào, làm gì,
khi nào không nên hiện; danh sách chứa gì và loại gì ra; mỗi ô nhận giá trị nào
là hợp lệ và ngoài khoảng thì sao; phục vụ loại dữ liệu nào và cố ý không phục
vụ loại nào.

**Đó là sàn, không phải trần.** Mỗi việc có bộ câu hỏi riêng và không ai nhớ hết
được — **nghĩ ra bộ câu hỏi cho đúng việc đó là phần việc của mình**, không phải
việc chủ quán nhớ giùm. Chủ quán nói thẳng 31/08: *"anh cần em làm rõ các vấn đề
mà anh chưa nhắc đến"*.

**Và phải ghi rõ chỗ mình CHƯA xem.** "Đã xem A, B, C. Chưa xem D, E." Thiếu sót
viết ra thì chủ quán thấy được; thiếu sót im lặng thì không ai thấy cho tới lúc
nó hỏng.

**Chỉ hỏi chủ quán thứ chỉ ông ấy trả lời được.** Tra được bằng mã nguồn hay
truy vấn thì tự đi tra.

### Sonnet được phép chặn

Giao việc mà kế hoạch thiếu mục mô tả hiện trạng thì **Sonnet trả lại, chưa
code**. Chặn ở đầu vào rẻ hơn chặn sau khi đã làm.

## 2. Mức rủi ro quyết định mọi thứ

Không tra theo đường dẫn file — file sẽ đổi chỗ. Tra theo loại việc:

| Loại việc | Bắt buộc |
|---|---|
| Đụng giá vốn hoặc tồn kho | Có plan; Sonnet phản biện; kèm script kiểm tra chạy lại được |
| Ghi vào dữ liệu thật | Mặc định chạy thử; `--apply` mới ghi; in số lượng và đối tượng chính xác trước khi ghi; chủ quán duyệt **từng lần** ghi |
| Xoá dữ liệu gốc (nguyên liệu, món, công thức, đơn, nhà cung cấp) | **Không xoá. Đánh dấu ngừng dùng.** Đơn hàng cũ vẫn cần chúng để giải thích được số của chính nó. **Ngoại lệ thứ hai, chủ quán chốt 29/08:** món **chưa từng bán lần nào** thì xoá hẳn được, kèm lịch sử giá và biến thể của nó. Món **đã bán dù một lần** thì chỉ ẩn, không xoá. Không phải tin vào code: mọi khoá ngoại vào `products` và `product_variants` đều đặt `RESTRICT`, nên máy tự từ chối — cứ thử xoá rồi dịch lời từ chối sang tiếng Việt. **Một ngoại lệ, chủ quán chốt 27/08:** công thức và bán thành phẩm bị xoá hẳn — lý do ông ấy nêu là làm lại trên nền sạch dễ hơn chữa cái sai cũ, và số liệu ủng hộ: 3.363/3.364 dòng đơn đã tự mang bản sao công thức nên lịch sử không mất. Ngoại lệ này **chỉ áp cho công thức**, không mở rộng ra mục nào khác |
| Xoá file tài liệu hoặc dữ liệu kết xuất | Kiểm ai đang trích dẫn nó trước. Một bản sao lưu dữ liệu đã xoá có thể là **bản duy nhất** |
| Lộ ra ngoài repo (push, deploy) | Chủ quán duyệt **từng lần**. Không có uỷ quyền sẵn |
| Chạy migration lên máy chủ thật | Chủ quán duyệt **từng lần**, tách bạch với duyệt push. **Nhưng duyệt riêng không có nghĩa là chạy riêng:** migration đổi *kết quả trả về* của một hàm thì **code đọc kết quả đó phải lên cùng lúc** — chạy trước là mọi lần gọi đều hỏng. Ngày 30/08 tôi chạy `0076` (bỏ mã dòng sổ kho khỏi kết quả) mà chưa đẩy code; suốt bốn tiếng mỗi phiếu xuất **ghi thành công nhưng báo lỗi đỏ**, và chủ quán bấm lại là ghi thêm một phiếu nữa. Thứ tự đúng: đẩy code trước hoặc cùng lúc, không bao giờ chạy migration trước |
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

**Gỡ một thứ ra thì phải xem ai đang ĂN đầu ra của nó**, không chỉ xem ai gọi
nó. Ngày 30/08 một kế hoạch bảo "thôi ghi dòng sổ kho trong hàm ghi phiếu
xuất" — hợp lý, vì quyển sổ đó sắp bỏ. Nhưng hàm đó **trả về mã dòng sổ kho**,
và phía TypeScript có dòng `if (!line.ledger_id) throw`. Làm theo kế hoạch là
**mọi phiếu xuất đều hỏng**, kể cả 95 phiếu đang chạy tốt — chữa một món, làm
hỏng cả tính năng. Cùng họ với mục 71 (siết một cột là sửa mọi chỗ ghi), nhưng
áp cho **giá trị trả về**: liệt kê chỗ đọc kết quả, đừng chỉ liệt kê chỗ gọi.

**Truy vấn hỏng của mình nằm trong nhật ký lỗi của chủ quán.** Ngày 27/08 có
bốn câu gõ sai tên cột, cả bốn được Supabase ghi lại thành ERROR trong đúng
chỗ chủ quán mở ra để xem hệ thống có bất thường không — và ông ấy đã mang một
cái sang hỏi. Hại thật không nằm ở câu hỏng, mà ở chỗ **sau này không ai phân
biệt được lỗi thật với rác của mình**. Lấy tên cột từ `information_schema` một
lần rồi tra bản đó, đừng đoán tên rồi thử.

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

- **Thiết bị nào ra thiết bị đó — chủ quán chốt lại 2026-08-26.** Màn hình máy
  tính dựng theo lối máy tính, màn hình điện thoại dựng theo lối điện thoại.
  **Không để bản này bóp méo bản kia**, và không có bản nào là "bản chính".

  **Đây là luật thay thế.** Từ 2026-08-08 tới 2026-08-25 luật là *"điện thoại
  trước, máy tính sau, xong nghĩa là xong trên điện thoại, máy tính được phép
  còn thô"*. Nó sinh ra đúng thứ nó cho phép: bảng thống kê theo điểm bán dựng
  toàn thẻ dọc, mở trên máy tính thành vài cái thẻ trôi giữa khoảng trắng — chủ
  quán phải bảo mới sửa. Luật cũ không sai về ý, nhưng cái nó **cho phép** thì
  hại hơn cái nó bảo vệ.

  **Trang chỉ xong khi cả hai thiết bị đều dùng được**, không phải khi điện
  thoại xong.

  Lý do điện thoại vẫn quan trọng, chủ quán nêu bằng việc thật (2026-08-08):
  đếm hàng là đứng trước kệ, hàng vỡ thì ghi tại chỗ. Không ai chạy về bàn mở
  máy tính để ghi một hộp sữa đổ. Nên điện thoại **không được là bản rút gọn**
  của máy tính — nhưng máy tính cũng không được là bản phóng to của điện thoại.

  Cụ thể trên **điện thoại**: không bảng ngang (mỗi dòng một thẻ xếp dọc);
  `inputMode="numeric"` cho mọi ô số; vùng bấm vừa ngón cái; việc dài phải hiện
  tiến độ và **lưu từng bước lên máy chủ**.

  Cụ thể trên **máy tính**: dữ liệu nhiều cột thì dùng bảng thật, so sánh được
  bằng mắt theo cột; đừng bày thẻ rời giữa khoảng trắng.

  Cùng một dữ liệu, **hai bố cục viết riêng** — không phải một bố cục co giãn
  cho vừa cả hai.

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

**Một đơn có thể có nhiều dòng dữ liệu.** Sửa một đơn không ghi đè bản cũ mà
tạo bản mới: bản cũ thành `SUPERSEDED`, bản mới `COMPLETED`, **cả hai giữ chung
một mã đơn**. Đo 26/08: 2.376 dòng cho 2.360 đơn. Hệ quả bắt buộc nhớ:

- Đếm doanh thu phải lọc `status='COMPLETED'` **và** `superseded_by` rỗng —
  thiếu một trong hai là đếm đôi.
- Xử lý theo mã đơn, đừng theo dòng. Đổi mã theo dòng sẽ xé một đơn làm ba.
- **Thời điểm bán được đóng băng khi sửa:** bản mới chép nguyên `created_at`
  của bản gốc (`lib/order-edit-cart.ts`). Nên ngày trên mã đơn và ngày trong
  báo cáo không bao giờ lệch nhau.

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

**Web chạy ở đâu, dữ liệu nằm ở đâu — phải cùng một chỗ.** Máy chủ dữ liệu
đặt tại Singapore. Máy chạy web phải đặt ở Singapore (`sin1`) chứ không để
Vercel tự chọn — mặc định của nó là Washington, và ngày 27/08 chính chỗ đó làm
trang Hàng Mua Vào hỏng suốt cả buổi, đồng thời mỗi lần mở trang mất 3,5 giây
thay vì dưới 1 giây. Đây là một dòng cài đặt trong dự án, **không nằm trong mã
nguồn** — nên đổi chỗ chạy hay dựng lại dự án là mất, và không cửa kiểm nào
bắt được.

**Muốn biết giá vốn hiện là bao nhiêu thì đo, đừng đọc** (mục 4). Bảng
`stock_issues`, tách theo cột `source`: `MANUAL` là phiếu xuất, `STOCKTAKE` là
chênh lệch kiểm kê. **Không được cộng hai cái rồi gọi là giá vốn tháng đó** —
kỳ kiểm kê đầu tiên gánh nhiều tháng dồn lại.

## 11. Tra ở đâu — và tra thế nào cho khỏi làm trùng

**Luật này thay cho câu "trước khi thiết kế việc lớn thì mở `specs/`".** Câu đó
hỏng ba lần trong một tháng, và hỏng cùng một kiểu, nên đừng khôi phục nó.

### Cửa mở lúc nào

**Bất cứ khi nào sắp đề xuất, lên kế hoạch, hay thiết kế một việc — kể cả việc
một dòng.** Không hỏi "việc này có lớn không".

Chữ "lớn" là chỗ hỏng: người tự đánh giá là người sắp làm, và cả ba lần đều tự
chấm là nhỏ. Ngày 27/08 việc bị chấm nhỏ là "cho máy bán hàng tự gửi lại" —
nghe như một chi tiết nối theo bản vá, thật ra đã có bản thiết kế chủ quán
duyệt từ 27/07.

### Một lệnh. Đọc hết danh sách nó in ra.

```
for f in docs/superpowers/specs/*.md; do
  printf "%-50s | %s
" "$(basename "$f" .md)"     "$(grep -im1 status "$f" | sed 's/[*_#]//g' | cut -c1-58)"
done
```

In ra **mọi** file kèm dòng trạng thái của nó. Đọc hết — **đừng lọc, đừng tìm
kiếm, đừng nhờ lệnh phân loại hộ.**

**Vì sao không lọc — đo 27/08, hai lần liên tiếp cùng ngày.** Bản đầu của luật
này bảo tra bằng danh từ lĩnh vực: gõ "pos" ra **12 trên 13 bản**, lọc mà ra
gần hết thì không lọc gì cả. Tra theo tên file thì chính xác nhưng "stocktake",
"asset", "purchase" ra **0** dù cả ba đều có tài liệu. Và chỗ hỏng thật ngày
hôm đó là **đoán sai chữ**: chữ nghĩ trong đầu là "thử lại", tài liệu tên là
*POS Offline Resilience*.

**Rồi bản thứ hai của luật này cũng sai, theo chiều nguy hiểm hơn.** Nó dùng
`grep -il "status.*approv"` — mà `approv` khớp cả *"approved by owner"* lẫn
*"awaiting owner **approval**"*, hai thứ ngược nhau. Danh sách nó in ra gọi **5
bản chủ quán chưa đồng ý** là đã chốt, đồng thời bỏ sót vài bản duyệt thật vì
chúng viết trạng thái kiểu khác. Đem một bản chưa duyệt ra làm căn cứ còn tệ
hơn không tra.

Dòng trạng thái trong `specs/` viết mỗi file một kiểu — "Approved", "Approved
by user", "approved by owner", "Draft — awaiting user approval", "proposed,
awaiting owner approval", "design, pending owner review", "ACTIVE" — và nhiều
file tháng 6 không có dòng nào (phần lớn là bảng phân việc cũ, không phải thiết
kế). **Không có mẫu chung nào để lệnh tự phân loại đúng.** Nên lệnh chỉ được
phép in ra, còn phân loại là việc của người đọc.

**Đọc hết thì không cần đoán gì cả** — và nhìn thấy chữ "awaiting" tận mắt thì
không nhầm nó thành "approved" được.

**Có tên trong danh sách mà chạm vào vùng mình định làm thì mở ra đọc, đừng
thiết kế lại. Nhưng đọc xong phải nhìn đúng dòng trạng thái**: chưa duyệt thì
đó là đề xuất đang chờ chủ quán, không phải quyết định đã có.

### Rồi tra thứ liên đới

Danh sách trên cho biết *đã chốt cái gì*. Còn hai chỗ cho biết *việc này đụng
vào ai*:

```
grep -in "<danh-từ>" docs/OPEN-ITEMS.md docs/BUSINESS-RULES.md
```

Ở đây tìm kiếm dùng được, vì hai file này là danh sách dài chứ không phải kho
file, và trả về nhiều dòng cũng vẫn đọc được.

### Dừng khi nào

Trả lời được hai câu này thì dừng:

1. **Bản thiết kế đã duyệt nào chạm vào vùng này?** (kể cả câu trả lời "không
   có" — nhưng phải là sau khi đọc hết 13 dòng)
2. **Mục nào trong `docs/OPEN-ITEMS.md` sẽ đổi nghĩa nếu làm việc này?**

Không trả lời được thì chưa tra xong. Đọc đủ để bắt đầu viết **không phải** là
điều kiện dừng.

### Tra tài liệu KHÔNG thay được việc đo

Ba lần trên là lỗi tra thiếu. Có một lỗi khác ngược hẳn: **tra ra rồi tin luôn
con số trong đó** (Luật số 0, mục 4). Tài liệu cho biết *đã quyết cái gì*; chỉ
truy vấn mới cho biết *hiện đang thế nào*. Ngày 27/08 việc được đề xuất vì
tưởng có rủi ro, đo ra **0 đơn hỏng trên 689 đơn** — thứ chặn được nó cuối cùng
là phép đếm, không phải bản thiết kế.

---

**Tài liệu hiện hành — đọc để biết trạng thái:**

| Cần gì | Ở đâu |
|---|---|
| Việc chưa xong | `docs/OPEN-ITEMS.md` |
| Cách tính, nguyên tắc hiển thị số | `docs/BUSINESS-RULES.md` |
| **Thiết kế đã duyệt — đọc TRƯỚC khi đề xuất bất cứ việc gì** | **`docs/superpowers/specs/`** |
| Kế hoạch triển khai từng đợt | `docs/superpowers/plans/` |
| Quán là gì, phạm vi tới đâu | `CONTEXT.md` |
| Thuật ngữ | `docs/domain-dictionary.md` |
| Cách chạy máy, công nghệ dùng gì | `README.md` |
| File mới đặt ở đâu | `docs/FILE-ORGANIZATION.md` |
| Tính năng nào đã có | `docs/FEATURE-CATALOG.md` |

**Dòng in đậm là dòng đã gây ba lần làm trùng.** Ngày 24/08 nó còn chưa có
trong bảng, và hôm đó một bản thiết kế chủ quán duyệt từ 28/07 bị viết lại từ
đầu. Thêm dòng vào bảng vẫn chưa đủ: 27/08 lại suýt viết lại bản duyệt từ
27/07, lần này vì tra bằng tên cách chữa thay vì tên lĩnh vực. **Quy trình tra
ở đầu mục này mới là thứ chặn được, không phải bảng này.**

**`specs/` không có mục lục — và sẽ không bao giờ có**, vì một mục lục viết tay
sẽ cũ đi đúng như câu giá vốn ở đầu file này. Liệt kê lại bằng lệnh ở đầu mục
này, và **đọc cả dòng trạng thái**.

**Câu "đo 26/08 ra 13 bản đã được chủ quán duyệt" từng nằm ở đây và nó sai** —
con số đó do một lệnh lọc nhầm sinh ra, gộp cả những bản đang chờ chủ quán
duyệt vào cùng một rổ với bản đã duyệt. Đó là lý do lệnh bây giờ chỉ in ra chứ
không phân loại.

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
