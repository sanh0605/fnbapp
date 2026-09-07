# Định hướng tối ưu dự án theo hướng dẫn Anthropic

**Chủ quán giao 2026-09-07:** dùng luật và hướng dẫn của Anthropic để định hướng
lại toàn bộ tài liệu lẫn code, làm xong rồi mới triển khai phần còn lại theo bộ
luật đó.

## Nguồn đã đọc (đọc thẳng trang tài liệu chính thức, 2026-09-07)

| Trang | Địa chỉ |
|---|---|
| Bộ nhớ và chỉ dẫn dự án | `code.claude.com/docs/en/memory` |
| Mở rộng Claude Code | `code.claude.com/docs/en/features-overview` |
| Kho mã lớn / monorepo | `code.claude.com/docs/en/large-codebases` |
| Thực hành tốt nhất | `code.claude.com/docs/en/best-practices` |

## Ràng buộc gốc mà mọi khuyến nghị của Anthropic xoay quanh

> *"Hầu hết các thực hành tốt đều dựa trên một ràng buộc: cửa sổ ngữ cảnh của
> Claude đầy rất nhanh, và chất lượng giảm khi nó đầy."*

Hệ quả trực tiếp: **thứ gì nạp vào mọi phiên thì phải cực kỳ đáng giá.**

---

## Đối chiếu hiện trạng fnbapp (đo ngày 2026-09-07)

| Hạng mục | Anthropic khuyến nghị | fnbapp hiện tại | Kết luận |
|---|---|---|---|
| `CLAUDE.md` | Dưới 200 dòng; bỏ "giải thích dài"; giữ cạm bẫy + quyết định kiến trúc | **406 dòng**, phần lớn là tường thuật sự cố có ngày tháng | ❌ **Cần cắt** |
| Cách để agent tự kiểm chứng | "Cho Claude một phép kiểm nó tự chạy được" | 5 cửa: `tsc`, `vitest`, `check-rules-current`, `run-blocking`, `build` | ✅ **Tốt hơn mức khuyến nghị** |
| Hook | Dùng cho việc **bắt buộc** phải xảy ra | 2 hook, nhưng chỉ **nhắc**, không **chặn** | ⚠️ Nâng cấp được |
| Skill | Quy trình lặp lại, tài liệu tra cứu | 1 skill (`fnbapp-bulk-data-change`) | ⚠️ Còn nhiều nội dung trong `CLAUDE.md` nên thành skill |
| `.claude/rules/` có `paths:` | Luật gắn với một vùng code | Chưa dùng | ⚠️ Dùng được, nhưng có giới hạn (xem dưới) |
| Subagent cho điều tra | "Giữ phần đọc nhiều file ra khỏi ngữ cảnh chính" | Chưa dùng | ⚠️ Cơ hội lớn |
| Tài liệu trong `docs/` | Không thuộc phạm vi hướng dẫn; **tốn 0 ngữ cảnh** vì chỉ đọc khi cần | 28 file, 5.774 dòng | ✅ **Giữ** |
| Tổ chức code | Kho lớn: tách theo vùng, `CLAUDE.md` theo thư mục | `lib/` 61 module phẳng | ⚠️ Để sau khi xong tính năng |

## Bằng chứng tại chỗ

Phiên 2026-09-07 chạy với `CLAUDE.md` 406 dòng. Trong chính phiên đó, agent
**vi phạm luật của chính file này**: trả lời dài dòng (mục 6 yêu cầu ngắn gọn),
và bỏ bước tra ngược văn bản luật (dẫn tới sai ngưỡng thuế ba lượt liên tiếp).
Đây đúng là triệu chứng Anthropic mô tả: *file quá dài thì luật quan trọng bị
lạc trong nhiễu.*

---

## Định hướng — năm việc, xếp theo giá trị

### A. Cắt `CLAUDE.md`: giữ LUẬT, bỏ TƯỜNG THUẬT

Phép thử Anthropic đưa ra, áp cho **từng dòng**:
> *"Bỏ dòng này đi thì Claude có mắc lỗi không? Không thì cắt."*

- **Giữ:** mọi luật, mọi cấm đoán, mọi ngưỡng, bảng mức rủi ro, tiêu chí "xong việc".
- **Nén:** sự cố dài thành một mệnh đề trong ngoặc, giữ ngày và con số.
- **Chuyển đi:** phần tường thuật đầy đủ sang `docs/02-rules/business-rules/`
  (nơi đó không tốn ngữ cảnh), hoặc bỏ hẳn vì git đã giữ.
- **Không được mất:** một luật nào.

### B. Chuyển quy trình lặp lại thành skill

Nội dung mô tả một quy trình nhiều bước, chỉ cần lúc làm đúng việc đó, thì
Anthropic nói rõ là thuộc về skill chứ không phải `CLAUDE.md`.

### C. Nâng hook từ "nhắc" lên "chặn"

> *"Một chỉ dẫn trong CLAUDE.md là lời đề nghị, không phải bảo đảm. Hook mới là
> thi hành."*

Hai hook hiện có chỉ chèn lời nhắc. Bổ sung một hook **từ chối thật** cho nhóm
lệnh phá huỷ dữ liệu. Cân nhắc thêm `Stop` hook chạy bộ cửa kiểm trước khi kết
thúc lượt.

### D. Dùng subagent cho việc điều tra

> *"Vì ngữ cảnh là ràng buộc nền tảng, hãy dùng subagent để giữ phần nghiên cứu
> nằm ngoài nó."*

Việc đọc nhiều file để tra một câu hỏi nên giao subagent, chỉ nhận về kết luận.

### E. `.claude/rules/` cho luật gắn chặt một vùng code

Dùng được, **nhưng có giới hạn phải biết**: luật `paths:` chỉ nạp khi Claude
**mở một file khớp mẫu**. Việc thiết kế và trả lời diễn ra trong lúc trò chuyện,
khi chưa mở file nào — nên luật chi phối *cách trả lời* và *cách thiết kế* phải
ở lại `CLAUDE.md`. Chỉ chuyển đi luật thật sự gắn với thao tác trên file.

---

## Cái KHÔNG nên làm

- **Không xoá `docs/02-rules/business-rules/`.** Nó không tốn ngữ cảnh, và đúng
  loại "quyết định kiến trúc riêng của dự án" mà Anthropic bảo giữ.
- **Không ép mọi luật thành `paths:` rule** — xem giới hạn ở mục E.
- **Không xoá tài liệu để "cho nhẹ".** Tài liệu chỉ đọc khi cần thì không nặng.

## Cái tôi CHƯA tra

1. Trang `docs/en/skills` và `docs/en/hooks` — chưa đọc toàn văn, mới đọc phần
   tóm tắt trong hai trang khác.
2. Cách `Stop` hook tương tác với bộ cửa kiểm hiện có — chưa thử.
3. Ảnh hưởng của việc cắt `CLAUDE.md` lên mức tuân thủ — **chưa đo được**;
   Anthropic khuyên *"thử và quan sát xem hành vi có đổi không"*.
4. Số dòng cụ thể sau khi cắt — chỉ mới ước lượng, chưa cắt thật.
