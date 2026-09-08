# CLAUDE.md — FNB App

Quản lý quán cà phê: bán hàng, kho, giá vốn, tài sản, báo cáo.
Next.js App Router · TypeScript · Supabase Postgres · Vitest. Múi giờ Asia/Saigon.

## Lệnh

| Lệnh | Dùng khi |
|---|---|
| `npx tsc --noEmit` | Sau mỗi đợt sửa code |
| `npx vitest run` | Trước khi báo xong |
| `npx vite-node scripts/check-rules-current.ts` | Sau khi sửa tài liệu |
| `npx vite-node scripts/doc-checks/run-blocking.ts` | Sau khi sửa tài liệu |
| `npm run build` | Trước khi báo xong |

Bốn lệnh đầu xanh không đảm bảo `npm run build` xanh. Phải chạy cả năm.
Việc đụng giá vốn hoặc tồn kho: chạy thêm script `verify-*` tương ứng, yêu cầu 0 sai lệch.
Không xoá test mà không nêu lý do.

## Khi luật máy toàn cục gọi thứ không có

`C:\Users\Admin\CLAUDE.md` nạp vào mọi phiên và **không được sửa**. Luật nào ở đó
gọi một thứ không tồn tại trong máy này thì dùng bản thay thế dưới đây, không bỏ bước.

| Luật toàn máy | Dùng thay | Vì sao |
|---|---|---|
| skill `superpowers:code-reviewer` | skill `superpowers:requesting-code-review`, hoặc lệnh `/code-review` | tên cũ không có trong danh sách skill đã cài |
| lệnh `/final-before-start-dev` | mục "Lệnh" — chạy đủ năm cửa | lệnh này không có |
| lệnh `/update-dev-tracking` và file nhật ký phát triển nó ghi vào | quyết định kinh doanh ghi `docs/02-rules/business-rules/`; phần còn lại git log giữ | file nhật ký đã xoá 2026-09-02 |
| kiểm `Nest application successfully started` | `npm run build` xanh | dự án là Next.js, không phải NestJS |
| "Always try to use Lodash" | hàm mảng và đối tượng có sẵn của JavaScript | kho không cài Lodash; thêm thư viện là ngoài yêu cầu |
| tên "CamelCase" | camelCase cho biến và hàm, PascalCase cho component và kiểu — theo code hiện có | luật toàn máy viết mơ hồ |
| dòng "will review your output" ở cuối file | `/code-review`, hoặc subagent `reviewer` trong `.claude/agents/` | agent được nhắc đã bỏ 2026-07-31 |

## Việc nào gọi skill nào

Gọi trước khi làm, không phải sau khi làm hỏng. Tên dưới đây đã kiểm là có trong máy này.

| Việc | Gọi |
|---|---|
| Sắp làm tính năng mới hoặc đổi hành vi | `superpowers:brainstorming`, rồi `superpowers:writing-plans` |
| Bắt tay làm theo một kế hoạch đã duyệt | `superpowers:executing-plans` |
| Viết code cho một mục | `superpowers:test-driven-development` |
| Test đỏ, lỗi không hiểu | `superpowers:systematic-debugging` |
| Sắp báo "xong" | `superpowers:verification-before-completion` |
| Soát lại việc trước khi giao | `/code-review`, hoặc `superpowers:requesting-code-review` |
| Nhận góp ý về code | `superpowers:receiving-code-review` |
| Ghi hàng loạt vào dữ liệu thật | `fnbapp-bulk-data-change` |
| Sửa góp ý giao diện chủ quán gõ | `/fix-ui-feedback` |
| Dựng hoặc sửa màn hình quản trị, báo cáo, máy bán hàng | `ui-ux-pro-max` + `.claude/rules/ui-devices.md` |
| Làm một mặt trước cần nhận diện riêng (trang đăng nhập, trang khách nhìn thấy) | `frontend-design` |
| Soát lại một màn hình đã dựng | `web-design-guidelines` |
| Câu hỏi về Next.js App Router | `vercel:nextjs` |
| Deploy, biến môi trường, log Vercel | `vercel:deployments-cicd`, `vercel:env-vars` (đẩy vẫn phải duyệt từng lần) |
| Tra tài liệu thư viện ngoài | MCP `context7` |
| Mở trang thật kiểm bằng mắt | MCP `playwright` |
| Sửa hook hoặc quyền trong `.claude/settings.json` | `update-config` |
| Viết hoặc sửa một skill | `superpowers:writing-skills` |

## Vai trò

- Opus: đặc tả, thiết kế, kế hoạch, review. Không tự viết code.
- Sonnet: viết code, script, migration.
- Sonnet phản biện kế hoạch trước khi code; soát mà sạch thì phải nói rõ là đã soát.
- Không ai tự duyệt việc của chính mình.
- Hai agent sửa cùng một file tài liệu: chạy `git status` trước khi lưu, tránh ghi đè việc đang dở của agent kia.
- Agent nói với nhau bằng tiếng Anh. Mọi thứ chủ quán đọc, kể cả chữ trong app, bằng tiếng Việt.

## Quy trình

Bốn bước: đặc tả → thiết kế → kế hoạch → code.

- Tạo bảng dữ liệu mới, màn hình mới, hoặc khái niệm mới: làm đủ bốn bước, lưu đặc tả và thiết kế vào `docs/superpowers/specs/`.
- Sửa thứ đã có: viết thiết kế rút gọn trong kế hoạch, rồi code.
- Mốc phân biệt, không tự đánh giá: migration có `create table` không; `app/` có thêm thư mục không.
- Câu hỏi thiết kế cho thứ chưa tồn tại: không trả lời ứng khẩu trong chat. Tra rồi viết ra.

Mọi kế hoạch mở đầu bằng mục hiện trạng, năm câu đánh số, mục nào không áp dụng thì ghi "không áp dụng, vì…":

1. Có mấy trạng thái, đặt mỗi trạng thái bằng cách nào?
2. Có những nút nào, mỗi nút làm gì, nút nào không nên hiện khi nào?
3. Danh sách chứa gì, loại cái gì ra, vì lý do gì?
4. Mỗi ô nhập nhận giá trị nào, nhập ngoài khoảng thì sao?
5. Phục vụ loại dữ liệu nào, cố ý không phục vụ loại nào?

- Năm câu là sàn, không phải trần: tự nghĩ thêm bộ câu hỏi riêng cho đúng việc đó; chủ quán không nhớ giùm.
- Trước khi viết kế hoạch, xác nhận ý chủ quán tới ~95% bằng một ví dụ cụ thể, không diễn đạt lại trừu tượng.
- Ghi rõ chỗ chưa xem: "đã xem A, B. Chưa xem C, D."
- Kế hoạch đụng dữ liệu thật phải kèm một ví dụ tính sẵn bằng số thật, có tên món và mã dòng đơn.
- Sonnet trả lại kế hoạch thiếu mục hiện trạng, chưa code.
- Đánh dấu một mục là xong bằng cách đổi `it.todo` của nó thành test xanh; `docs/04-operations/OPEN-ITEMS.md` sinh lại từ đó, không sửa tay.

## Việc phải chủ quán duyệt từng lần

| Việc | Luật |
|---|---|
| Ghi vào dữ liệu thật | Mặc định chạy thử; `--apply` mới ghi; in số dòng và đối tượng trước khi ghi |
| Đẩy code ra ngoài (push, deploy) | Không có uỷ quyền trước cho lần sau |
| Chạy migration lên máy chủ thật | Duyệt riêng, tách khỏi duyệt push |
| Xoá file tài liệu | Kiểm ai đang trích dẫn trước khi xoá |

Một câu trả lời chỉ duyệt một việc. "Chạy migration và đẩy không?" mà nhận "đẩy đi" thì chỉ được đẩy.

**Gõ mấy lệnh trên bằng công cụ Bash, không phải PowerShell.** Luật xin phép trong
`.claude/settings.json` viết dạng `Bash(git push *)`, `Bash(npx supabase db push *)` —
chỉ khớp công cụ Bash. Cùng câu lệnh đó chạy qua PowerShell thì không trúng luật nào,
rơi xuống bộ lọc tự động và bị từ chối thẳng, chủ quán **không thấy hộp thoại nào cả**.
Máy này lấy PowerShell làm chính nên rất dễ quen tay (`Select-Object -Last 20` thay vì
`| tail -20`) rồi tự chặn mình. Bị bộ lọc từ chối thì **kiểm công cụ trước**, đừng kết
luận là máy cấm; và tuyệt đối không nhờ phiên khác chạy giùm (mất chốt duyệt của chủ quán).

## Luật dữ liệu

- Không xoá nguyên liệu, món, đơn, nhà cung cấp. Đánh dấu ngừng dùng. Khoá ngoại đặt `RESTRICT` nên máy tự từ chối; dịch lời từ chối sang tiếng Việt.
- Ngoại lệ: công thức và bán thành phẩm được xoá hẳn. Món chưa bán lần nào được xoá hẳn kèm lịch sử giá; món đã bán chỉ được ẩn.
- Migration đổi kiểu trả về của một hàm phải lên cùng lúc với code đọc hàm đó. Không bao giờ chạy migration trước.
- Sửa dữ liệu hàng loạt: dùng skill `fnbapp-bulk-data-change`.
- Đổi một quy tắc kinh doanh: sửa luật và sửa test của nó trong cùng một lần lưu.
- Chủ quán chốt điều gì đổi cách tính, cách hiển thị số, hoặc cách vận hành: ghi vào `docs/02-rules/business-rules/` ngay trong phiên đó, kèm ngày.

## Trả lời câu hỏi về số liệu

IMPORTANT: tài liệu không bao giờ là nguồn cho con số hiện tại. Truy vấn máy chủ.

- Con số trong kế hoạch cũ phải đo lại trước khi dùng.
- Nói rõ truy vấn không cho thấy điều gì, trước khi kết luận.
- Lấy tên cột từ `information_schema` rồi tra bản đó; đoán tên rồi thử sẽ đổ lỗi đỏ vào nhật ký của chủ quán.
- Gỡ một thứ ra thì liệt kê chỗ đọc kết quả của nó, không chỉ chỗ gọi nó.
- Đo bằng đúng ngôn ngữ sẽ chạy thật; Python và JavaScript làm tròn 0,5 ngược nhau.
- Báo kết quả kèm mẫu số: "0 lệch trên 3.364 dòng", không nói trống "0 lệch".

## Khẳng định về luật, thuế, chuẩn kế toán

IMPORTANT: tra ra một kết quả không phải là tra xong. Bắt buộc tra ngược xem văn bản đã bị sửa hoặc bãi bỏ chưa.

- Mỗi khẳng định kèm đủ: số hiệu · ngày ban hành · ngày hiệu lực · điều khoản · link gốc. Thiếu một thứ thì ghi "chưa xác minh".
- Ghi rõ đã đọc văn bản gốc hay chỉ đọc bài tóm tắt.
- Hai nguồn mâu thuẫn thì phải đào tiếp, không chọn bên nghe hợp lý hơn.
- Mọi câu trả lời có mục "cái tôi chưa tra". Không để trống.
- Con số pháp lý không được đọc lại trong file; phải tra lại.
- Thứ có hậu quả pháp lý cần một người làm kế toán xác nhận trước khi chốt.

## Nói chuyện với chủ quán

Chủ quán là người kinh doanh, nghiệm thu bằng cách bấm thử, không đọc code.

- Tiếng Việt, ngắn gọn, không thuật ngữ.
- Mỗi khái niệm kỹ thuật quy về một việc đời thường, ngay lúc nói. Ví dụ nằm trong cuộc trò chuyện, không chép vào file này.
- Không dán code dài vào chat. Ghi vào file rồi tóm tắt.
- Báo lỗi theo ba nhịp: chuyện gì xảy ra → vì sao → cần làm gì.
- Gọi tên thật của nguyên liệu và món, không đọc mã.
- Chỉ hỏi chủ quán quyết định kinh doanh. Việc kỹ thuật tự quyết rồi báo lại.
- Không hỏi lại điều chủ quán đã chốt; tra `docs/superpowers/specs/`, `docs/02-rules/business-rules/` và git log trước.
- Mỗi lượt một vấn đề, tối đa ba câu về vấn đề đó, đánh số, kèm phương án chọn và khuyến nghị.
- Thấy lỗ hổng trong nghiệp vụ chủ quán mô tả thì nói ngay, không lấp bằng phỏng đoán.
- Cảnh báo ảnh hưởng chéo mà không đợi được hỏi.
- Nói trước cái giá: việc có thể làm máy bán hàng ngừng nhận đơn phải báo trước.
- Giao việc xong phải nói rõ chỗ nào cần chủ quán mở ra xem tận mắt.

## Viết code

- Máy tính và điện thoại dựng hai bố cục riêng. Trang xong khi cả hai dùng được. Chi tiết: `.claude/rules/ui-devices.md`.
- Không đo tỉ lệ thiết bị người dùng mở; chủ quán đã bác (2026-08-26). Điều kiện xem lại do chủ quán tự nêu.
- Màn hình mới phải gắn lối vào menu; quên thì `npx vitest run` đỏ.
- Thứ chủ quán có thể muốn đổi phải là một bảng dữ liệu kèm màn hình tự sửa, không nhét cứng vào code. Phải nói rõ: ghi lại giá trị đã dùng lúc tính, hay sửa bảng là tính lại toàn bộ.
- Code và chú thích tiếng Anh; chữ hiển thị tiếng Việt.
- Không thêm tính năng, lớp trừu tượng, hay tuỳ chọn ngoài yêu cầu.
- Thấy code chết không liên quan thì nói, không tự xoá.
- Phép kiểm mới phải chạy đỏ trên bản chưa sửa trước, và nói rõ đỏ vì giá trị sai hay vì thiếu hàm.
- Deploy xong phải có người mở trang sau khi đăng nhập; `curl` trả 307 không chứng minh gì.

## Cấu trúc và đường dẫn

| Thư mục | Chứa |
|---|---|
| `app/` | route Next.js; component riêng của một màn hình nằm trong thư mục `components/` cạnh màn hình đó |
| `lib/` | logic theo vùng, mỗi vùng một thư mục con: `db`, `shared`, `auth`, `sales`, `pos`, `purchasing`, `costing`, `stock`, `assets`, `products`, `catalog`, `reports`, `dev-feedback` |
| `components/` | chỉ thứ dùng chung: `ui/`, `providers/`, `dev-feedback/` |
| `tests/` | test không có module bên cạnh: chữ migration, edge function, service worker |
| `scripts/`, `supabase/`, `app/pos/`, `lib/costing/` | có `CLAUDE.md` riêng, máy nạp khi mở file trong đó |

Module mới đặt vào đúng vùng; không có vùng hợp thì hỏi trước khi tạo vùng mới. Gốc `lib/` không chứa file — có phép kiểm canh.
Import cùng thư mục viết tương đối (`./TenFile`); import khác thư mục viết bằng alias `@/...`. Ví dụ có sẵn: `app/admin/inventory/assets/components/AssetCard.tsx` import `./DisposeAssetForm`.
Đường dẫn viết bắt đầu bằng tên thư mục gốc (`app`, `lib`, `components`, `tests`, `scripts`, `docs`, `supabase`, `types`, `.claude`), không mở đầu bằng dấu gạch chéo. Phép kiểm chỉ nhận dạng lối này, nên đừng lấy đường dẫn không có thật ra làm ví dụ.

## Tài liệu

| Cần biết | Mở |
|---|---|
| Phạm vi hệ thống | `docs/01-system/SYSTEM-OVERVIEW.md` |
| Tên bảng nghĩa là gì | `docs/01-system/TABLE-DICTIONARY.md` |
| Sửa chỗ này lan tới đâu | `docs/generated/system-map.md` |
| Một luồng chạy đầu cuối | `docs/03-workflows/` |
| Giá vốn, tồn kho, báo cáo tính ra sao | `docs/02-rules/business-rules/` |
| Thuật ngữ | `docs/02-rules/GLOSSARY.md` |
| Việc chưa xong | `docs/04-operations/OPEN-ITEMS.md` |
| Sự cố | `docs/04-operations/INCIDENT-RESPONSE.md` |
| Thiết kế đã duyệt, đọc trước khi đề xuất | `docs/superpowers/specs/` |

Tài liệu cho biết đã quyết cái gì. Chỉ truy vấn cho biết hiện đang thế nào.
