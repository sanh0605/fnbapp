# Chuyển dấu "không quản lý tồn kho" từ nhóm sang mặt hàng

**Written 2026-08-31 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Vì sao làm bây giờ:** chủ quán chốt 29/08 xoá nhóm nguyên liệu tầng 2. Mục 75
trong `docs/OPEN-ITEMS.md` chốt sẵn thứ tự — **xoá nhóm làm sau cùng**, sau công
thức và sau sổ kho. Công thức xoá xong 31/08, sổ kho xong 31/08. Đây là việc dọn
đường cuối cùng.

**Một lời đính chính phải nằm ngay đầu.** Trong lúc trao đổi 31/08 tôi nói với
chủ quán rằng Đá viên và Khoai lang đều đã được đánh dấu nên cái chặn không tồn
tại. **Sai** — tôi đọc dấu trên **nhóm** rồi kết luận cho **mặt hàng**. Cái chặn
có thật, và mục 75 đã đo đúng nó từ 29/08. Tôi đo lại từ đầu thay vì mở ra đọc,
đúng lỗi mục 11 cảnh báo.

---

## 1. Hiện trạng

### 1.1 Dấu này có mấy trạng thái, và đặt bằng cách nào

Hai giá trị (có / không), nhưng **nằm ở hai bảng**, và phép kiểm là **cộng dồn**
— chỉ cần một trong hai bên có dấu là mặt hàng bị loại khỏi kiểm kê.

| Đặt ở đâu | Màn hình | Ai đặt được |
|---|---|---|
| `base_ingredients.is_non_inventory` | Nhóm Nguyên Liệu | Có ô bấm |
| `purchased_items.is_non_inventory` | Hàng Mua Vào | **Chỉ hiện khi chọn nhóm Vật tư tiêu hao** |

**Không có ngày hiệu lực.** Không cột `_from`, không lịch sử. Đây là mục 50
trong `docs/OPEN-ITEMS.md` và là chỗ nguy hiểm nhất của cả việc này (xem §1.4).

### 1.2 Màn hình có nút gì, và cái nào không hiện khi nào

Ô **"Không quản lý tồn kho"** trong form Hàng Mua Vào
(`components/inventory` — thực tế nằm ở `app/admin/inventory/items/components/PurchasedItemForm.tsx`)
**chỉ hiện khi nhóm là Vật tư tiêu hao**.

| Nhóm | Ô có hiện? | Vì sao |
|---|---|---|
| Vật tư tiêu hao | **Có** | — |
| Dụng cụ | **Không**, và khi lưu còn bị ép về "không" | Dụng cụ bắt buộc khấu hao, không được tính hết vào chi phí lúc mua (mục 59) |
| Nguyên liệu | **Không** | Cố ý: thừa hưởng từ nhóm, để một câu trả lời chỉ có một nguồn |

**Lý do của nguyên liệu sắp hết hiệu lực** — nhóm sắp bị xoá thì không còn gì để
thừa hưởng. Nên việc này **phải mở ô đó cho nguyên liệu**, nếu không chủ quán
đánh dấu được lần này nhưng lần sau mua thứ tương tự thì không có chỗ bấm.

**Không mở cho dụng cụ.** Lý do cấm vẫn nguyên.

### 1.3 Danh sách nào bị ảnh hưởng, cái gì bị loại ra vì lý do gì

Hai màn hình đọc dấu này, **cả hai đọc trên nhóm rồi suy ra mặt hàng**:

| Chỗ đọc | Dùng để |
|---|---|
| `app/admin/inventory/stocktake/actions.ts` | Loại khỏi màn hình Kiểm kê |
| `app/admin/inventory/issue-slips/actions.ts` | Loại khỏi danh sách chọn của Phiếu xuất kho |

Cộng thêm `app/admin/inventory/actions.ts` và một chỗ trong `lib/historical/` —
**chưa xem hai chỗ này**, xem §1.6.

**Đo 31/08 — 9 mặt hàng đang được loại, theo hai đường khác nhau:**

| Đường | Số mặt hàng | Xoá nhóm thì sao |
|---|---:|---|
| Dấu trên chính mặt hàng | **7** (các loại túi, Muỗng nhựa đen) | Không sao |
| **Chỉ có dấu trên nhóm** | **2** — Đá viên, Khoai lang | **MẤT DẤU** |

**Và 5 nhóm có dấu nhưng chưa có mặt hàng nào**: Nước, Muối hồng, Nước sôi,
Trái tắc, Trái chanh. Xoá nhóm là mất luôn ý định đó — mai kia tạo mặt hàng Trái
tắc thì **phải tự bấm dấu trên mặt hàng**. Mục 75 ghi rằng hôm 29/08 chủ quán
được hướng dẫn **ngược lại**, trước khi ai kịp đo.

### 1.4 Giá trị nào hợp lệ, và đổi ngoài khoảng đó thì sao

Dấu chỉ nhận có/không. **Chỗ nguy không nằm ở giá trị mà ở việc không có ngày.**

`BR-COGS-007` lấy **giá trị hiện tại** của dấu để xếp một lần mua vào dòng
"Nguyên liệu mua dùng ngay". Nên bỏ dấu một món vào tháng 11 sẽ **xếp lại mọi
lần mua từ tháng 3**, và tháng đã chốt sổ nhảy số. Chính chủ quán nêu phản đối
này hôm 19/08 về khấu hao: đổi thời gian khấu hao thì sản phẩm đã đặt trước đó
vẫn phải giữ nguyên.

**Việc này KHÔNG rơi vào bẫy đó — nhưng phải chứng minh bằng số, không bằng
lời.** Chuyển dấu từ nhóm sang mặt hàng giữ nguyên kết quả xếp loại: 9 mặt hàng
trước, 9 mặt hàng sau. Đó là phép kiểm chính của §3.

**Việc này không sửa mục 50.** Dấu vẫn không có ngày hiệu lực sau khi xong. Nói
rõ để không ai tưởng đã xong.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ 2 mặt hàng (Đá viên, Khoai lang) và một ô trong form. **Cố ý không đụng:**

- 7 mặt hàng đã có dấu trên chính nó — không sờ tới
- Dụng cụ — không mở ô, lý do cấm còn nguyên (mục 59)
- **Không xoá nhóm nguyên liệu trong đợt này.** Đây là việc dọn đường; xoá là
  việc riêng, chủ quán duyệt riêng
- Không sửa mục 50 (ngày hiệu lực) — việc khác, lớn hơn

### 1.6 Chỗ tôi CHƯA xem

- **`app/admin/inventory/actions.ts`** có một chỗ lọc `is_non_inventory` — chưa
  xem màn hình nào dùng và có ảnh hưởng không.
- **`lib/historical/history-ops/negative-stock-resolution.ts`** đọc dấu trên
  **mặt hàng** (không phải nhóm) — chưa xem nó còn chạy không.
- **Báo cáo lãi lỗ** gom dòng "Nguyên liệu mua dùng ngay" bằng cách nào — mới
  đọc `docs/BUSINESS-RULES.md`, **chưa đọc mã**. Đây là chỗ tiền, phải xem trước
  khi chạy.
- **5 nhóm rỗng** — chưa hỏi chủ quán có muốn giữ ý định đó lại bằng cách nào.

### 1.7 Ví dụ tính sẵn, bằng số thật đo hôm nay

**Khoai lang (`SPM-052`)** — 23 dòng đơn nhập đã hoàn tất, **2.126.000đ**, từ
31/05 đến 29/08. Hôm nay xếp vào "Nguyên liệu mua dùng ngay" nhờ dấu trên nhóm.
Sau khi chuyển dấu sang mặt hàng: **vẫn 2.126.000đ, cùng dòng đó.**

**Con số này KHÔNG khớp tài liệu, và tài liệu mới là cái cũ.** Mục 75 ghi
1.896.000đ, đo 29/08. Chênh **230.000đ** vì chủ quán vẫn mua tiếp — đúng Luật số
0. Người thực thi **phải đo lại trước khi chạy**, đừng dùng con số này.

**Đá viên (`SPM-005`)** — **0 dòng đơn nhập**. Không có tiền nào đi theo, nhưng
vẫn phải chuyển dấu, nếu không nó hiện lại trong màn hình Kiểm kê và chủ quán bị
bắt đếm đá viên.

## 2. Thay đổi

1. **Chuyển dấu cho 2 mặt hàng** — `SPM-005`, `SPM-052`: đặt
   `purchased_items.is_non_inventory = true`. **Ghi vào dữ liệu thật** — mặc
   định chạy thử, `--apply` mới ghi, chủ quán duyệt lần chạy.
2. **Mở ô đánh dấu cho nhóm Nguyên liệu** trong form Hàng Mua Vào — đổi điều
   kiện hiện ô để nhận cả nguyên liệu. **Không mở cho dụng cụ**, và giữ nguyên
   đoạn ép giá trị về "không" cho dụng cụ.
3. **Không đụng gì khác.**

**Không sửa hai chỗ đọc** (màn hình Kiểm kê và Phiếu xuất kho) **trong đợt này.**
Phép kiểm là cộng dồn nên chúng vẫn cho kết quả đúng khi dấu nằm ở cả hai nơi.
Sửa chúng là việc của đợt xoá nhóm, và tách ra thì mỗi đợt tự đứng được.

## 3. Kiểm chứng

- **Phép đo trung tính, chạy trước và sau, phải ra CÙNG một danh sách:** đếm mặt
  hàng bị loại theo phép cộng dồn. **9 trước, 9 sau**, cùng 9 mã.
- **Đo lại tiền của Khoai lang ngay trước khi chạy** (§1.7 nói vì sao), và
  **cùng con số đó sau khi chạy**.
- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa**: chọn nhóm Nguyên
  liệu thì ô đánh dấu phải hiện. Nói rõ đỏ vì **giá trị sai** hay vì **thiếu
  hàm**.
- **Phép kiểm dụng cụ vẫn xanh**: chọn Dụng cụ thì ô **không** hiện. Cái này đã
  có, không được để việc mở cho nguyên liệu làm hỏng nó.
- **Trả lời §1.6 trước khi chạy**, ít nhất chỗ báo cáo lãi lỗ — đó là chỗ tiền.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Ghi dữ liệu thật — chủ quán duyệt riêng lần chạy.** Không tự
đẩy.

**Rồi chủ quán tự xem hai chỗ:** mở màn hình Kiểm kê xác nhận **không** thấy Đá
viên và Khoai lang; mở form Hàng Mua Vào, chọn nhóm Nguyên liệu, thấy ô đánh dấu
hiện ra.

**Việc này KHÔNG xoá nhóm nguyên liệu.** Sau khi xong, việc xoá vẫn còn chặn ở
hai chỗ chưa gỡ: 5 nhóm rỗng mang ý định chưa có chỗ chứa, và hai chỗ đọc vẫn
đang đọc trên nhóm.
