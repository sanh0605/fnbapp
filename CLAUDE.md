# CLAUDE.md — FNB App

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
