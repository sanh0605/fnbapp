# Đánh giá từng file tài liệu, đối chiếu tài liệu Anthropic

**Viết 2026-09-07 bởi Opus 5, theo yêu cầu của chủ quán:** đọc kỹ tài liệu
Anthropic rồi soát từng file, nói rõ giữ hay xoá, mỗi kết luận phải có chỗ dẫn
chứng. Không đoán, không đọc tiêu đề rồi suy.

Cách làm: mở và đọc hết nội dung 30 file trong `docs/`, `CLAUDE.md`, `README.md`,
và bốn file cấu hình trong `.claude/`. Không file nào bị đánh giá qua tên.

---

## 1. Nguồn Anthropic đã đọc (đọc thẳng trang chính thức, 2026-09-07)

| Trang | Địa chỉ |
|---|---|
| Bộ nhớ và chỉ dẫn dự án | `code.claude.com/docs/en/memory` |
| Thực hành tốt nhất | `code.claude.com/docs/en/best-practices` |
| Mở rộng Claude Code | `code.claude.com/docs/en/features-overview` |
| Kho mã lớn / monorepo | `code.claude.com/docs/en/large-codebases` |
| Skill | `code.claude.com/docs/en/skills` |
| Hook | `code.claude.com/docs/en/hooks` |

Bốn câu quyết định, trích nguyên văn:

> *"CLAUDE.md files are loaded into the context window at the start of every
> session, consuming tokens alongside your conversation."* — memory

> *"Size: target under 200 lines per CLAUDE.md file. Longer files consume more
> context and reduce adherence."* — memory

> *"Keep it concise. For each line, ask: 'Would removing this cause Claude to make
> mistakes?' If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your
> actual instructions!"* — best-practices

> *"Consistency: if two rules contradict each other, Claude may pick one
> arbitrarily."* — memory

---

## 2. Chỗ mà đợt trước suýt làm sai: cái gì tốn ngữ cảnh, cái gì không

Anthropic **không** khuyên xoá tài liệu trong kho mã. Mọi câu về "cắt cho gọn"
đều nói riêng về `CLAUDE.md` — thứ nạp vào mọi phiên. Bảng chi phí ngữ cảnh
trong `features-overview` ghi rõ:

| Thứ | Nạp lúc nào | Chi phí ngữ cảnh |
|---|---|---|
| `CLAUDE.md` | mở phiên | **mọi request** |
| `.claude/rules/*.md` có `paths:` | khi Claude mở file khớp mẫu | chỉ lúc đó |
| Skill | tên + mô tả lúc mở phiên; thân khi dùng | thấp |
| Hook | khi sự kiện xảy ra | **bằng không** |
| File trong `docs/` | chỉ khi có người mở ra đọc | **bằng không** |

**Kết luận cứng: xoá một file trong `docs/` không tiết kiệm được một token nào
của phiên làm việc.** Cái giá thật của một file tài liệu là *nó có thể sai*, chứ
không phải nó nặng. Nên tiêu chí đánh giá là: **file này còn đúng không, và có ai
đọc nó không** — không phải "file này có dài không".

Đo hiện tại: thứ nạp vào mọi phiên gồm `CLAUDE.md` toàn máy (139 dòng) +
`CLAUDE.md` dự án (151 dòng) + mô tả của các skill. Cả hai file đều dưới ngưỡng
200 dòng Anthropic nêu.

---

## 3. Đánh giá từng file

Cột "ai đọc" trả lời câu quan trọng nhất: nếu không ai đọc và không máy nào kiểm,
file đó chỉ còn là chỗ chứa sai sót.

### 3.1 Nạp vào phiên làm việc

| File | Dòng | Ai đọc | Phán quyết |
|---|---:|---|---|
| `CLAUDE.md` | 151 | mọi phiên | **Giữ.** Dưới 200 dòng. Đã thêm mục "Khi luật máy toàn cục gọi thứ không có" hôm nay |
| `.claude/rules/ui-devices.md` | 39 | khi mở file `app/**/*.tsx` | **Giữ.** Đúng kiểu `paths:` Anthropic khuyên; luật giao diện chỉ cần lúc dựng màn hình |
| `.claude/skills/fnbapp-bulk-data-change/SKILL.md` | 96 | khi sắp ghi dữ liệu hàng loạt | **Giữ.** Đây là ví dụ mẫu của một skill tốt: nó tự nhắc "đừng tin đoạn trên nếu chưa kiểm lại", và ghi rõ ngày đo |
| `.claude/commands/fix-ui-feedback.md` | 42 | khi chủ quán gõ `/fix-ui-feedback` | **Giữ, nhưng đang hỏng hai dòng** — xem §5 |
| `.claude/hooks/block-destructive-sql.sh` | 47 | mỗi lệnh Bash | **Giữ.** Chặn thật (thoát mã 2), đúng thứ Anthropic gọi là *enforcement* chứ không phải lời đề nghị |
| `.claude/settings.json` | 101 | mọi phiên | **Giữ, đang hỏng** — hai khối `ask`, xem §5 |

### 3.2 `docs/01-system/` — hệ thống là gì

| File | Dòng | Phán quyết | Bằng chứng |
|---|---:|---|---|
| `SYSTEM-OVERVIEW.md` | 103 | **Giữ** | Chứa ba thứ không đọc code ra được: kho dùng chung một kho, bẫy tên `lib/sheets_db.ts` (tên Sheets, ruột Supabase), và vùng chạy `sin1` là cài đặt ngoài mã nguồn |
| `TABLE-DICTIONARY.md` | 63 | **Giữ** | 41 bảng kèm nghĩa tiếng Việt. Không suy ra được từ schema: schema cho tên cột, không cho biết `stock_issues` là "chỗ tính giá vốn" |
| `SYSTEM-MAP.md` | 177 | **Giữ** | Khối ```relations``` trong file này bị cửa `map-drift` so với bản máy sinh mỗi lần commit. Chép tay nhưng có máy canh |
| `MULTI-BRANCH-IMPACT.md` | 82 | **Giữ** | Liệt kê đúng 6 bảng và 2 file phải sửa nếu tách kho theo chi nhánh, mỗi bảng kèm số migration. Đây là kết quả của một lần dò thật, dò lại tốn cả buổi |

### 3.3 `docs/02-rules/` — luật kinh doanh

| File | Dòng | Phán quyết |
|---|---:|---|
| `GLOSSARY.md` | 30 | **Giữ.** Cầu nối tiếng Việt ↔ tên bảng, viết cho chủ quán đọc |
| `business-rules/README.md` | 51 | **Giữ.** Bảng trạng thái luật (`APPROVED`/`OBSERVED`/`UNRESOLVED`/`RETIRED`) và thủ tục đổi luật |
| `business-rules/cogs.md` | 126 | **Giữ.** Chỗ đắt nhất trong toàn bộ tài liệu: `BR-COGS-006` ghi lại lần chủ quán bác một con số và hoá ra máy sai 7,4%, kèm ví dụ `PO-031` tính sẵn |
| `business-rules/inventory.md` | 117 | **Giữ.** `BR-INV-007` (chỉ đếm gói còn nguyên) là chính sách kế toán, không suy ra được từ code |
| `business-rules/sales.md` | 53 | **Giữ.** `BR-SALE-005` khoá vĩnh viễn việc 44.229.000đ bốn tháng đầu là *không kiểm chứng được*, không phải *đã kiểm* |
| `business-rules/catalog.md` | 35 | **Giữ.** Luật trùng tên hai mức, kèm lý do "Dứa/Dừa" |
| `business-rules/data-integrity.md` | 80 | **Giữ.** 12 luật sao lưu/khôi phục/ghi lùi ngày |
| `business-rules/access.md` | 16 | **Giữ.** Có một luật chủ quán mở rộng 03/09: tài liệu công khai **không được liệt kê cả tên** biến bí mật |
| `business-rules/unresolved.md` | 9 | **Giữ, phải sửa nội dung** — xem §6, `BR-U-002` đang nói sai hiện trạng |

**Vì sao giữ toàn bộ:** đây đúng thứ Anthropic xếp vào *"Architectural decisions
specific to your project"* — cột ✅ Include của best-practices — và chúng nằm
ngoài `CLAUDE.md` nên không tốn ngữ cảnh phiên nào.

### 3.4 `docs/03-workflows/` — mười luồng

Mười file: `sales`, `purchasing`, `stock-issue`, `stocktake`, `assets`,
`reports`, `product-catalog`, `inventory-catalog`, `users`, `operations`.
Tổng 811 dòng. **Giữ cả mười.**

Bằng chứng chúng không phải văn suông: mỗi file mở đầu bằng khối ```flow-decl```
khai báo route, file, bảng, mã luật — và **máy đối chiếu từng dòng đó với code**
(`scripts/doc-checks/flow-doc-core.ts`: route không tồn tại thì đỏ, file không
tồn tại thì đỏ, khai ghi vào một bảng mà file không ghi thì đỏ). Sửa một file
được khai báo mà không cập nhật tài liệu luồng cũng đỏ.

Đây là loại tài liệu duy nhất trong kho có máy canh nội dung. Xoá là mất luôn
phép kiểm.

### 3.5 `docs/04-operations/`

| File | Dòng | Phán quyết |
|---|---:|---|
| `INCIDENT-RESPONSE.md` | 124 | **Giữ.** Bốn loại sự cố, mỗi loại: triệu chứng → kiểm gì trước → làm gì. Đọc lúc đang cuống thì không ai đi lục tài liệu màn hình |
| `OPEN-ITEMS.md` | 3 | **Giữ.** Máy sinh từ `it.todo`, hiện đang trống ("Không có việc treo") |

### 3.6 `docs/generated/` — vùng máy sinh

| File | Dòng | Phán quyết | Bằng chứng |
|---|---:|---|---|
| `README.md` | 5 | **Giữ.** Câu "chạy lại là đúng, sửa tay bị đè" |
| `system-map.md` | 100 | **Giữ.** Cửa `map-drift` đọc nó mỗi lần commit |
| `architecture.md` | 109 | **Đề nghị xoá** | Không tài liệu nào trỏ người đọc tới nó; không cửa kiểm nào đọc nó. Chỗ duy nhất nhắc tên file là chính công cụ sinh ra nó (`scripts/system-map/generate-diagram.ts:24`). Nó vẽ lại đúng dữ liệu đã có trong `system-map.md`, dưới dạng sơ đồ Mermaid |

Xoá `architecture.md` thì nên xoá cả `scripts/system-map/generate-diagram.ts` và
đoạn "architecture diagram" trong `npm run gen:docs`. Đây là **đề nghị**, chờ chủ
quán duyệt vì luật xoá tài liệu là việc phải duyệt.

### 3.7 `docs/superpowers/specs/`

| File | Dòng | Phán quyết |
|---|---:|---|
| `2026-09-02-project-reset-design.md` | 847 | **Giữ, thêm một dòng trạng thái.** Đây là hồ sơ duy nhất còn lại của mười vòng phỏng vấn chủ quán ngày 02/09. Nhưng nó **đang mô tả một thư mục tài liệu không còn đúng**: §3.2 vẽ `docs/generated/edge-cases.md` — file đó **chưa bao giờ được tạo** (kiểm: `docs/generated/` chỉ có 3 file). Cần một dòng đầu file ghi "hồ sơ quyết định, số đo trong §1.1 là ảnh chụp 02/09" |
| `2026-09-07-toi-uu-theo-huong-dan-anthropic.md` | 105 | **Đề nghị xoá.** Viết sáng nay, đã bị chính hôm nay vượt qua: nó ghi *"2 hook, nhưng chỉ nhắc, không chặn"* — sai, `.claude/hooks/block-destructive-sql.sh` chặn thật bằng mã thoát 2. File này thay bằng chính file đang đọc |

### 3.8 Gốc kho mã

| File | Dòng | Phán quyết |
|---|---:|---|
| `README.md` | 123 | **Giữ.** Lệnh chạy máy, năm cửa kiểm, vùng deploy `sin1`, và luật không liệt kê tên biến bí mật |

---

## 4. Cái thiếu so với thiết kế đã duyệt

`2026-09-02-project-reset-design.md` §3.2 thiết kế **hai file máy sinh cộng một
file thứ ba là `docs/generated/edge-cases.md`** (trường hợp biên, tiếng Việt, cho
chủ quán đọc). File đó không tồn tại. Chính spec §5.2 đã báo trước lý do: máy
trích được tên phép kiểm nhưng không dịch được sang tiếng Việt trơn tru.

**Hai lối, chủ quán chọn:** (a) bỏ hẳn khỏi thiết kế, sửa §3.2; (b) làm thật, kèm
luật "tên test viết tiếng Việt". Tôi nghiêng về (a) — vì đến giờ chưa ai hỏi thiếu nó.

---

## 5. Sai đã tìm được hôm nay và đã sửa

Tất cả đều kiểm chứng được bằng cách mở đúng dòng đó ra xem.

| Chỗ | Sai gì | Đã làm |
|---|---|---|
| 5 chỗ trong `docs/03-workflows/` | trỏ "spec §10"; spec được trỏ tới **không có §10** (mục lớn nhất của nó là §6b) | trỏ lại `BR-SALE-002` / `BR-COGS-007` / `SYSTEM-OVERVIEW.md` |
| `cogs.md:109`, `assets.md:43` | trỏ `CLAUDE.md §8` — mục 8 không còn tồn tại | trỏ mục "Viết code" |
| `INCIDENT-RESPONSE.md:7` | trỏ "CLAUDE.md, Rule 0" — luật số 0 đã bị gộp đi | trỏ mục "Trả lời câu hỏi về số liệu" |
| 37 chỗ trong code và tài liệu (gồm ba dòng trên) | trỏ số mục `CLAUDE.md` đã biến mất sau lần cắt 07/09 | trỏ bằng **tên mục** |
| 12 chỗ trong code | trỏ file kế hoạch đã xoá | bỏ đường dẫn, giữ nội dung và ngày |
| cửa `docs-refs` | không thấy đường dẫn bị xuống dòng giữa chừng; không quét `types/` và `.claude/*.md` | đã vá, có test đỏ trước |
| cửa mới `claude-section-refs` | chưa tồn tại | thêm: cấm trỏ số mục; tên mục trong ngoặc kép phải là tiêu đề có thật trong `CLAUDE.md` |

**Còn hai chỗ chưa sửa được**, vì máy chặn không cho tôi ghi vào `.claude/` dù
chủ quán đã cho phép trong phiên: `.claude/settings.json` (hai khối `ask`, khối
đầu 26 dòng bảo vệ bị vô hiệu) và `.claude/commands/fix-ui-feedback.md` (dòng 7
trỏ kế hoạch đã xoá, dòng 35 trỏ "mục 7"). Hai dòng sau đang làm cửa kiểm đỏ.

---

## 6. Mâu thuẫn chưa giải được — phải truy vấn máy chủ, không được đoán

Ba chỗ dưới đây **hai tài liệu nói ngược nhau**. Không tài liệu nào là nguồn của
hiện trạng, nên tôi không chọn bên nào; phải chạy truy vấn rồi mới sửa.

1. **`base_ingredients` còn hay đã xoá.** `TABLE-DICTIONARY.md:8-13` ghi bảng này
   đã bị `DROP TABLE` ở migration `0090` và hệ thống còn 41 bảng.
   `catalog.md` (`BR-CATALOG-002`) ghi "migration đã viết, **chưa chạy**" tính đến
   01/09. Cách giải: đọc `information_schema.tables` trên máy chủ thật.
2. **`BR-U-002` nói "phạm vi hiện tại là một thương hiệu, một quán".** Trong khi
   `SYSTEM-OVERVIEW.md`, `operations.md` và `BR-SALE-006` đều mô tả **hai điểm
   bán, hai thương hiệu** đang chạy. Một trong hai câu là cũ.
3. **Migration `0071`/`0072` đã chạy chưa.** `BR-SALE-006` ghi "chưa chạy, chờ chủ
   quán duyệt riêng"; `MULTI-BRANCH-IMPACT.md` dùng chính hai migration đó làm
   bằng chứng rằng nền đa điểm bán **đã có sẵn**.

Ngoài ra, **`BR-U-003` nhắc "Phase 3 sẽ soát"** — Phase 3 là một kế hoạch đã bị
xoá. Câu đó cần viết lại thành việc còn treo hoặc bỏ.

Và **15 chỗ trong `docs/02-rules/` và `docs/03-workflows/` còn trỏ vào các bản kế
hoạch đã xoá** theo lối văn xuôi ("xem mục D5b của kế hoạch", "danh sách đầy đủ ở
§5 của kế hoạch"). Không cửa kiểm nào bắt được vì chúng không phải đường dẫn.
Nội dung xung quanh vẫn đúng; chỉ lời mời "xem thêm ở đó" là dẫn vào chỗ trống.

---

## 7. Cái tôi CHƯA tra

1. **Chưa chạy truy vấn nào lên máy chủ trong phiên này.** Ba mâu thuẫn ở §6 vì
   thế vẫn để mở, không phải đã kết luận.
2. **Chưa đo mức tuân thủ trước và sau khi cắt `CLAUDE.md`.** Anthropic khuyên
   *"test changes by observing whether Claude's behavior actually shifts"*; tôi
   chưa có cách đo việc đó ngoài quan sát chủ quan.
3. **Chưa đọc toàn văn 847 dòng của spec 02/09** — đã đọc mục lục, §1, §3.2,
   §3.2b, §4, §5, và các chỗ được trỏ tới. Phần phỏng vấn §2 (vòng 1–10) mới đọc
   lướt tiêu đề từng vòng.
4. **Chưa đo mức dùng thật của từng skill.** Đã lập bảng "việc nào gọi skill nào"
   (§8) nhưng chưa có số liệu skill nào được gọi bao nhiêu lần; Anthropic có cách
   đo qua OpenTelemetry (`skill_activated`), chưa bật.

---

## 8. Skill và plugin: đã cài gì, việc nào gọi cái nào

Kiểm trên đĩa 2026-09-07, không đọc từ trí nhớ.

**Mười plugin đang bật** (`C:\Users\Admin\.claude\settings.json`, khoá
`enabledPlugins`): `superpowers`, `frontend-design`, `feature-dev`,
`code-review`, `code-simplifier`, `skill-creator`, `context7`, `playwright`,
`github`, `vercel` — tất cả từ chợ `claude-plugins-official`.

**Một skill của riêng dự án:** `.claude/skills/fnbapp-bulk-data-change/`.

Bảng "việc nào gọi skill nào" đã đưa thẳng vào `CLAUDE.md` — vì bảng đó chỉ có
tác dụng nếu nạp vào mọi phiên; để trong file này thì đúng lúc cần lại không ai
mở.

### 8.1 Hai skill đã cài nhưng máy không thấy

`skills-lock.json` ở gốc kho khai hai skill:

| Skill | Khai nằm ở | Thật ra nằm ở |
|---|---|---|
| `ui-ux-pro-max` (703 dòng + 1,8 MB dữ liệu) | `.claude/skills/ui-ux-pro-max/SKILL.md` | `.agents/skills/ui-ux-pro-max/` |
| `web-design-guidelines` (39 dòng, của Vercel) | — | `.agents/skills/web-design-guidelines/` |

`.claude/skills/` hiện chỉ có đúng một thư mục: `fnbapp-bulk-data-change`.

**Hệ quả: cả hai skill này chưa bao giờ nạp được.** Tài liệu Anthropic
(`docs/en/skills`) chỉ liệt kê ba chỗ máy tìm skill — `~/.claude/skills/`,
`.claude/skills/`, và thư mục của plugin. `.agents/` không nằm trong đó, và
`.gitignore:92` còn bỏ qua cả thư mục ấy.

**Chủ quán chốt 2026-09-07: đưa cả hai vào `.claude/skills/` của dự án**, để cả
kho dùng chung. Đã chép xong (38 file, 1,9 MB — riêng `google-fonts.csv` 745 KB;
`.gitignore:81` cho phép `.claude/skills/` nên số này sẽ vào git khi commit).

Hai chỗ phải sửa sau khi chép, không phải chép là chạy:

- 14 dòng lệnh trong `ui-ux-pro-max/SKILL.md` gọi `python3 skills/ui-ux-pro-max/...`
  — đường dẫn đó không có thật trong kho này. Đã đổi thành
  `python .claude/skills/ui-ux-pro-max/...` (máy này có `python` 3.12.5, không có
  `python3`).
- Đã chạy thử `search.py` với truy vấn "admin dashboard inventory" và nhận đúng
  kết quả, không phải chỉ chép file rồi tin là chạy.

Bản sao cũ trong `.agents/` (37 file) đã xoá 2026-09-07 sau khi `diff -rq` xác
nhận hai bản khớp nhau. `.agents/` nằm ngoài git nên bản đó không còn ở đâu nữa.

### 8.2 `ui-ux-pro-max` và `frontend-design` có trùng nhau không

Đọc cả hai file gốc (`frontend-design` 71 dòng trong bộ nhớ đệm plugin;
`ui-ux-pro-max` 703 dòng + 1,8 MB dữ liệu). **Không trùng.** Chúng khác nhau ở
loại nội dung, không chỉ ở độ dài.

| | `frontend-design` (Anthropic) | `ui-ux-pro-max` (bên thứ ba) |
|---|---|---|
| Là gì | Quan điểm nghề: quyết định thế nào cho ra một bản sắc riêng | Kho tra cứu: 161 bảng màu, 57 cặp font, 99 luật UX, 25 loại biểu đồ, 161 loại sản phẩm |
| Trả lời câu | "Chọn thế nào để không ra sản phẩm nhìn như máy làm" | "Với màn hình loại này thì dùng màu nào, biểu đồ nào, cỡ chữ bao nhiêu" |
| Cách dùng | Đọc rồi tự quyết, hai lượt: lập bản thiết kế → tự soi lại xem có rơi vào mẫu mặc định không | Chạy `search.py` với truy vấn, nhận danh sách gợi ý kèm checklist |
| Điểm mạnh | Liệt kê đích danh năm kiểu "nhìn là biết AI làm" và cấm rơi vào | Có ngưỡng đo được: tương phản 4,5:1, vùng chạm 44×44px, chuyển động 150–300ms |
| Điểm yếu | Không có dữ liệu, không có ngưỡng số | Không dạy cách tránh cái tầm thường; đưa menu chứ không đưa lập trường |

**Chỗ chồng lấn thật:** cả hai đều nói về màu, chữ, bố cục. Nhưng một bên đưa
*nguyên tắc chọn*, bên kia đưa *danh sách để chọn*.

**Quyết cho fnbapp:** dùng `ui-ux-pro-max` làm mặc định. Lý do là đặc thù dự án
này, không phải skill nào hay hơn: đây là phần mềm nội bộ cho một quán — màn
hình quản trị, báo cáo, máy bán hàng — không có trang bán hàng ra ngoài, không
có việc dựng nhận diện thương hiệu. Thứ hay hỏng ở đây là bảng số trên điện
thoại, vùng chạm, tương phản chữ trên nền — đúng phần `ui-ux-pro-max` có ngưỡng
đo được. `frontend-design` để dành cho mặt trước cần nhận diện riêng, hiện chỉ
có trang đăng nhập.

**Không bỏ cái nào.** Theo bảng chi phí ngữ cảnh của Anthropic, một skill chỉ tốn
phần mô tả cho tới khi được gọi; giữ thêm một skill không tốn thêm gì đáng kể.
Cái giá thật của việc giữ cả hai là *gọi nhầm*, và cái đó đã chặn bằng ba dòng
phân vai trong `CLAUDE.md`.

**Một điều phải theo dõi:** mô tả của `ui-ux-pro-max` dài khoảng 1.000 ký tự.
Tài liệu Anthropic (`docs/en/skills`) ghi rõ khi danh sách skill dài ra, máy sẽ
**cắt bớt phần mô tả**, và mỗi mục bị chặn ở 1.536 ký tự. Nếu sau này cài thêm
nhiều skill, mô tả dài này sẽ lấn chỗ của skill khác — lúc đó rút gọn nó lại.
