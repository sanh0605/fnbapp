# CLAUDE.md — FNB App

## 0. Collaboration files (READ FIRST)

Multi-agent repo (Claude Code + Codex). Trước mỗi phiên, đọc theo thứ tự:

1. `docs/COLLABORATION.md` — protocol, file map, status markers, commit conventions
2. `DEVELOPMENT-TRACKING.md` — 3 entries mới nhất (chronicle log)
3. `docs/handoffs/2026-06-25-codex-handoff-active-task-tracking.md` — active task tracking với status
4. `docs/ROADMAP.md` — pending work and phase status; full audit program at `docs/superpowers/specs/2026-07-17-full-system-audit-program.md`
5. `docs/domain-dictionary.md` — terminology (chỉ khi cần)

Mọi thay đổi cuối phiên: append entry vào `DEVELOPMENT-TRACKING.md`, update status markers trong handoff, không push.

## 1. Think Before Coding

- Nêu rõ assumptions trước khi code — nếu không chắc, hỏi thay vì đoán
- Khi có nhiều cách hiểu, trình bày các lựa chọn — không tự chọn im lặng
- Nếu có cách đơn giản hơn, nói ra
- Nếu bị confused, dừng lại và hỏi rõ thay vì tiến hành sai hướng

## 2. Simplicity First

- Chỉ code đúng những gì được yêu cầu — không thêm tính năng ngoài scope
- Không tạo abstraction cho code chỉ dùng một chỗ
- Không thêm "flexibility" hay "configurability" nếu không được yêu cầu
- Không xử lý error cho tình huống không thể xảy ra
- Nếu 200 dòng có thể viết lại thành 50, viết lại

## 3. Surgical Changes

- Chỉ chạm vào code liên quan trực tiếp đến yêu cầu
- Không "cải thiện" code lân cận, comment, hay formatting
- Không refactor những thứ không bị broken
- Giữ nguyên style hiện có, kể cả khi có cách khác
- Nếu phát hiện dead code không liên quan — mention, không tự xóa
- Khi thay đổi tạo ra orphan (import/variable/function thừa do chính mình tạo): xóa chúng

## 4. Goal-Driven Execution

Với mọi task, xác định tiêu chí thành công trước:

| Thay vì... | Chuyển thành... |
|---|---|
| "Thêm validation" | "Viết test cho input lỗi, rồi làm cho pass" |
| "Fix bug" | "Tái hiện bug bằng test, rồi làm cho pass" |
| "Refactor X" | "Đảm bảo test pass trước và sau refactor" |

Với task nhiều bước, nêu plan ngắn trước khi làm:
```
1. [Bước] → verify: [kiểm tra]
2. [Bước] → verify: [kiểm tra]
```

## 5. Token Efficiency

- Không đọc file nếu nội dung đã có trong context
- Không re-read file vừa edit — Edit tool đã track state
- Batch nhiều Edit trong cùng 1 lượt thay vì từng cái một
- Dùng Grep/Glob thay vì Read toàn bộ file khi chỉ cần tìm 1 đoạn
- Không đọc file không liên quan đến task

## 6. Confirm Before Code

- **Nếu yêu cầu chưa rõ ràng, PHẢI hỏi lại — không được code cho đến khi có câu trả lời rõ ràng**
- Với task mơ hồ hoặc có nhiều cách hiểu: nêu cách hiểu, chờ xác nhận trước khi code
- Với task lớn (>3 file thay đổi): trình bày plan ngắn, chờ anh duyệt
- Không tự suy diễn ý định — hỏi thẳng nếu không chắc
- Ví dụ câu hỏi cần hỏi lại: "thêm ảnh vào X" → hỏi X là chỗ nào cụ thể nếu có nhiều chỗ

## 7. Giao tiếp bằng tên thật, không dùng mã

- Khi trao đổi với chủ quán, luôn dùng **tên thật** của sản phẩm/bán thành phẩm/nguyên liệu (VD: "Trứng gà", "Hồng trà", "Sữa đặc"), **không** dùng mã nội bộ (VD: `NNL-007`, `BTP-008`, `ING-003`)
- Lý do: mã không có ý nghĩa gì với chủ quán, buộc họ phải dừng lại tra cứu mới hiểu — mất thời gian, ngược với mục đích báo cáo
- Nếu chỉ có mã trong tay, tra tên trước (`Base_Ingredients`/`Semi_Products`/`Products`) rồi mới báo cáo
- Mã vẫn dùng bình thường trong code/script/commit message/tài liệu kỹ thuật — quy tắc này chỉ áp dụng cho phần giao tiếp trực tiếp với chủ quán

## 8. Chủ động cảnh báo ảnh hưởng chéo

- Khi làm nhiều việc sửa dữ liệu liên quan trong cùng phiên (VD: nhiều đợt sửa giá vốn khác nhau), **phải chủ động dừng lại và nói rõ** nếu việc này có thể ảnh hưởng/phụ thuộc việc kia — **không đợi chủ quán hỏi mới nói**
- Ví dụ cụ thể đã xảy ra: giá vốn MAC được tính bằng cách duyệt lại toàn bộ lịch sử nhập/xuất kho theo thứ tự — nếu số lượng xuất kho lịch sử bị ghi thiếu, nó âm thầm làm sai giá bình quân tính ra ở lần nhập tiếp theo, ảnh hưởng đến mọi đơn bán sau đó. Đã sửa giá vốn nhiều đợt trong cùng đêm mà không kiểm tra xem tồn kho các nguyên liệu đó đã đúng chưa, tới khi chủ quán hỏi thẳng mới phát hiện
- Trước khi bắt đầu một đợt sửa/audit, kiểm tra xem có vấn đề đã biết nào (từ ROADMAP, audit trước đó) đụng vào cùng dữ liệu không, và nói ra ngay — dù ảnh hưởng nhỏ. Im lặng bị hiểu là "đã kiểm tra và ổn", tệ hơn là nói rõ còn điều chưa chắc chắn

## 9. Nguyên tắc nền tảng: tính tồn kho và giá vốn (owner xác nhận 2026-07-22)

Quy tắc này là sự thật nền tảng về cách vận hành thực tế của quán — mọi agent (Claude/Codex/Antigravity) đều phải tuân theo khi đụng đến tồn kho hoặc giá vốn, không suy diễn khác đi.

1. **Team chưa từng lập lệnh nấu bán thành phẩm chính thức trong lịch sử.** Không có dữ liệu lệnh sản xuất đáng tin cho quá khứ — đừng giả định lệnh sản xuất từng được ghi đầy đủ khi audit/tính lại dữ liệu cũ.
2. **Chỉ có 3 nguồn dữ liệu đáng tin để tính toán:** (a) công thức — cả công thức nấu bán thành phẩm lẫn công thức pha chế sản phẩm bán, (b) đơn bán hàng, (c) đơn nhập hàng. Dùng **công thức + đơn bán hàng** để tính trừ tồn kho; dùng **đơn nhập hàng** để tính giá vốn (bình quân gia quyền). Mọi dữ liệu khác trong `Stock_Ledger` (SALES_CONSUME, PRODUCTION_CONSUME/YIELD, RECLASSIFICATION_REVERSAL ghi từ trước) là **suy ra**, không phải nguồn gốc — không được tin làm chuẩn khi tính lại từ đầu.
3. **Quy tắc trừ tồn khi bán hàng:**
   - Sản phẩm dùng **nguyên liệu thô** trực tiếp để pha chế → trừ thẳng tồn nguyên liệu.
   - Sản phẩm dùng **bán thành phẩm** để pha chế: nếu tồn bán thành phẩm không đủ, hệ thống tự sinh "lệnh nấu ngầm" (implicit production) — trừ tồn nguyên liệu thô theo đúng công thức nấu bán thành phẩm đó, cộng tồn bán thành phẩm tương ứng, rồi mới trừ tồn bán thành phẩm để pha chế sản phẩm bán ra.
   - Tóm gọn: mỗi lần phát sinh lệnh nấu (kể cả ngầm) → trừ tồn nguyên liệu thô, cộng tồn bán thành phẩm.
   - Đây chính xác là cơ chế `allocateRecipeConsumption`/`splitImplicitProduction` (`lib/inventory-consumption.ts`) và `lib/full-history-recompute.ts` đã cài đặt — không cần thiết kế lại, chỉ cần nhớ đây là quy tắc chuẩn khi audit hoặc giải thích số liệu cho chủ quán.
