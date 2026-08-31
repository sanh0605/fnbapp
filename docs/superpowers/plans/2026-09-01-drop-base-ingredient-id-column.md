# Bước 2 — xoá cột `base_ingredient_id`

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Bước 2 của việc xoá nhóm nguyên liệu.** Bước 1 (xoá bảng) đã viết xong, migration
`0089`/`0090` **chưa chạy**. Kế hoạch bước 1:
`docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md`.

**Chủ quán chốt 01/09, nguyên văn:**

> *"Xóa nó đi và anh sẽ tự nối nó lại nếu sau này có dựng lại."*

**Bước này chạm đường giá vốn.** Hai trong bốn hàm phải sửa là phiếu xuất kho.

---

## 1. Hiện trạng

### 1.1 Cột này có mấy trạng thái, đặt bằng cách nào

Một cột chữ trên `purchased_items`, **52/146 dòng có giá trị**. Đặt qua ô "Liên
kết Nhóm Nguyên Liệu" — **ô đó đã gỡ ở bước 1**, nên từ nay không ai đặt được
giá trị mới.

Sau khi `0090` chạy, 52 giá trị đó **trỏ vào bảng không còn tồn tại**.

### 1.2 Màn hình nào có nút gì

**Không còn màn hình nào.** Bước 1 đã gỡ ô nhập, gỡ cột hiển thị trong danh sách
mặt hàng, và gỡ hẳn màn hình Nhóm Nguyên Liệu.

Còn đúng một chỗ người dùng nhìn thấy: **câu báo lỗi khi đếm kiểm kê vượt tổng
đã mua** (§1.4).

### 1.3 Bốn hàm máy chủ dùng cột này — ba kiểu khác nhau

Đo 01/09 bằng `pg_get_functiondef` trên máy chủ, **không đọc file migration**
(bài học 01/09).

| Hàm | Dùng thế nào | Bỏ đi thì sao |
|---|---|---|
| `apply_stocktake_session_atomic` | Vòng gộp theo nhóm | **Đã xử lý ở bước 1** — `0089` gỡ cả vòng |
| `create_issue_slip_atomic` | Đọc rồi **trả về** | Chỉ là chuyền tay. Bỏ khoá khỏi kết quả |
| `reverse_manual_issue_atomic` | Đọc rồi **trả về** | Như trên |
| **`save_stocktake_line_atomic`** | **Dùng trong điều kiện tra cứu** | **Đây là chỗ duy nhất mất thứ thật** — §1.4 |

**Hai hàm phiếu xuất chỉ chuyền tay, không dùng để quyết định gì.** Đó là tin
tốt: đường giá vốn không đổi hành vi, chỉ bớt một khoá trong kết quả trả về.

### 1.4 Cái mất thật — một câu báo lỗi bớt hữu ích

`save_stocktake_line_atomic` dùng cột này để **dựng câu gợi ý trong lời báo lỗi**.

Khi chủ quán đếm một mặt hàng **nhiều hơn tổng đã từng mua**, `BR-INV-005` từ
chối (chủ quán chốt 04/08). Câu báo lỗi hiện nay còn kèm:

> *"Mặt hàng cùng nguyên liệu gốc: Sữa tươi Vinamilk (đã mua 12.000, đếm 8.000);
> Sữa tươi TH (đã mua 6.000, chưa đếm)."*

Câu đó tồn tại để trả lời câu hỏi thật: **"có phải đơn nhập bị ghi nhầm sang mã
khác không?"** Nó liệt kê các mặt hàng **cùng nhóm** kèm số đã mua, để chủ quán
nhìn ra ngay.

**Xoá cột thì gợi ý đó mất.** Lời từ chối vẫn còn — `BR-INV-005` không đổi — chỉ
là nó không còn chỉ chỗ nữa.

**Không có gì thay thế được.** Sau khi bỏ nhóm, không còn thứ gì trong dữ liệu
nói "hai mặt hàng này là họ hàng". Tra theo tên gần giống là đoán, và đoán sai
trong một câu báo lỗi thì hại hơn không có.

**Đây là mất mát duy nhất của cả bước 2, và chủ quán cần biết trước.**

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ một cột và bốn hàm. **Cố ý không đụng:**

- **Không đụng `BR-INV-005`** — vẫn từ chối đếm vượt, chỉ bớt câu gợi ý
- Không đụng phép tính chênh lệch, giá vốn, doanh thu
- Không đụng hai bảng sổ kho — giai đoạn D là việc riêng
- **Không đổi hình dạng kết quả trả về ngoài đúng khoá này**

### 1.6 Chỗ tôi CHƯA xem

- **11 file mã nguồn dùng `base_ingredient_id`** — bước 1 đã gỡ phần lớn, nhưng
  tôi **chưa đo lại sau bước 1**. Người thực thi phải đếm lại, đừng dùng số 11.
- **13 migration nhắc tới cột này** — chỉ bản mới nhất của mỗi hàm mới đáng kể,
  nhưng chưa tra hết.
- **`lib/manual-issue-transaction.ts` đọc cột này bằng `|| ""`** nên thiếu thì
  thành chuỗi rỗng chứ không ném lỗi. **Phải kiểm lại**, đừng tin câu này.

### 1.7 Ví dụ tính sẵn

**Phiếu xuất `ISS-00103`** (30/08). Hôm nay hàm trả về khoá `base_ingredient_id`
kèm phiếu; phía TypeScript nhận rồi **không ai dùng**.

| | Trước | Sau |
|---|---|---|
| Phiếu lưu được | có | **có** |
| Số lượng xuất | không đổi | **không đổi** |
| Giá vốn sinh ra | không đổi | **không đổi** |
| Khoá `base_ingredient_id` trong kết quả | có | **không còn** |

**Nếu bất kỳ dòng nào ngoài dòng cuối thay đổi thì dừng.**

## 2. Thay đổi

**Thứ tự bắt buộc, và bước 1 phải xong trước.** `0089`/`0090` phải chạy xong,
chủ quán xác nhận trên web, rồi mới tới bước này.

1. **Gỡ chỗ đọc bên TypeScript trước** — đo lại §1.6 rồi gỡ. Đẩy, chủ quán xác
   nhận bán và xuất kho được.
2. **Rồi sửa hàm máy chủ, mỗi hàm một lần lưu, phiếu xuất SAU CÙNG:**
   - `save_stocktake_line_atomic` — gỡ câu gợi ý, giữ nguyên lời từ chối
   - `reverse_manual_issue_atomic` — gỡ khoá khỏi kết quả
   - `create_issue_slip_atomic` — gỡ khoá khỏi kết quả
3. **Cuối cùng mới xoá cột.** Một migration riêng, **không chạy**.

**Vì sao code đi trước lần này:** gỡ một khoá khỏi kết quả trả về mà code còn
đọc thì code nhận `undefined`. Ở đây có `|| ""` đỡ, nhưng **không được dựa vào
đó** — bài học `0076` ngày 30/08 là mọi phiếu xuất báo lỗi đỏ suốt bốn tiếng vì
đúng kiểu này.

## 3. Kiểm chứng

- **Ví dụ §1.7 phải đứng yên** ở mọi dòng trừ dòng cuối. Lưu một phiếu xuất thật
  bằng script trên dữ liệu thật, trước và sau **mỗi** lần lưu — không dồn cuối.
- **Đảo một phiếu xuất thật** — `reverse_manual_issue_atomic` chỉ chạy ở đường
  đó, và nó là nhánh dễ quên nhất.
- **Lời từ chối `BR-INV-005` vẫn nổ**: dựng một lần đếm vượt tổng đã mua, phải
  vẫn bị từ chối. **Chỉ câu gợi ý mất, lời từ chối thì không.**
- **Không hàm nào còn nhắc `base_ingredient_id`** — hỏi máy chủ, bỏ chú thích
  trước khi tìm.
- **Giá vốn không đổi:** `stock_issues` đếm và tổng bằng nhau trước/sau.
- **Doanh thu không đổi**, năm tháng khớp.
- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa.** Nói rõ đỏ vì **giá
  trị sai** hay vì **thiếu hàm**.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Viết migration, KHÔNG chạy.** Không tự đẩy.

**Rồi chủ quán tự làm:** lưu một phiếu xuất kho, đảo một phiếu, và đếm thử một
mặt hàng vượt tổng đã mua để xem lời từ chối còn nguyên.

**Sau bước này việc xoá nhóm nguyên liệu xong hoàn toàn.** Danh mục còn một
tầng: Nguyên liệu / Vật tư tiêu hao / Dụng cụ.
