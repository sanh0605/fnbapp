# Thu hồi quyền chạy hai hàm bán hàng khỏi vai công khai

**Written 2026-09-02 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Mục 81 trong `docs/OPEN-ITEMS.md`.** Tôi nêu 01/09 khi soát giai đoạn C, đo
02/09, chủ quán duyệt sửa 02/09.

**Đây là đường thu tiền.** Sai một chữ trong tên tham số là mọi lần bán hỏng.

---

## 1. Hiện trạng

### 1.1 Quyền chạy có mấy trạng thái, đặt bằng cách nào

Postgres mặc định cho **mọi vai** chạy một hàm mới. Muốn siết thì phải **thu hồi
rồi cấp lại** — không có trạng thái trung gian, và **không có màn hình nào đặt
được**; chỉ đặt bằng migration.

### 1.2 Màn hình có nút gì

**Không áp dụng.** Việc thuần máy chủ, chủ quán không thấy gì — trừ khi làm sai
thì máy bán hàng ngừng nhận đơn.

### 1.3 Ai chạy được cái gì — đo 02/09

| Hàm | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `create_pos_order_atomic` | **CÓ** | **CÓ** | có |
| `create_pos_order_atomic_unvalidated_0025` | **CÓ** | **CÓ** | có |
| `save_purchase_order_atomic` (đối chiếu) | không | không | có |

**Hai hàm bán hàng là những hàm ghi duy nhất mà vai công khai với tới được.**

**Cánh cửa đang khoá bằng thứ khác:** chìa của vai công khai nằm ở biến
`SUPABASE_ANON_KEY`, **chỉ có trên máy chủ**. Không tên `NEXT_PUBLIC_SUPABASE*`
nào xuất hiện trong `app/`, `lib/`, `components/`, và ứng dụng dùng chìa quản trị
(`lib/supabase.ts`). Chỗ duy nhất còn nhắc chìa công khai là một script cũ.

**Nên: lỗ thật, sau cánh cửa đang đóng.** Không phải "không khai thác được",
cũng không phải "gấp".

### 1.4 Mẫu đúng là gì — và mẫu rút gọn sẽ làm sai

Các migration gần đây viết **hai dòng**:

```
revoke all on function ... from authenticated;
grant execute on function ... to service_role;
```

**Chép hai dòng đó vào đây là làm chưa xong.** Chúng đủ ở chỗ khác vì `public`
và `anon` **đã bị thu từ `0006`**. Hai hàm bán hàng thì **chưa từng bị thu gì**.

Mẫu đầy đủ, lấy từ `0006_atomic_purchase_order_write.sql`, là **bốn dòng**:

```
revoke all on function ... from public;
revoke all on function ... from anon;
revoke all on function ... from authenticated;
grant execute on function ... to service_role;
```

**Bỏ dòng `from public` là quan trọng nhất** — đó là dòng gỡ quyền mặc định
Postgres tự cấp. Thu `anon` mà quên `public` thì `anon` vẫn chạy được qua
`public`.

### 1.5 Giá trị nào hợp lệ, sai thì sao

Không có ô nhập. Chỗ chết người là **chữ ký hàm**:

| Sai gì | Hậu quả |
|---|---|
| Gõ thiếu/thừa một tham số | Lệnh **không khớp hàm nào**, chạy êm mà **không thu hồi gì** — hỏng mà im lặng |
| Thu hồi luôn của `service_role` | **Mọi lần bán hỏng ngay** |
| Chỉ thu hàm ngoài, quên hàm trong | Hàm trong vẫn gọi được thẳng, **bỏ qua toàn bộ lớp kiểm** |

**Chữ ký hiện tại, đo 02/09 bằng `pg_get_function_identity_arguments`:**

```
p_outlet_code text, p_order jsonb, p_lines jsonb, p_event jsonb,
p_client_request_id text, p_payments jsonb
```

**Giống nhau cho cả hai hàm.** Nhưng **phải đo lại trước khi viết** — chữ ký vừa
đổi hôm 01/09 khi bỏ tham số sổ kho, và sẽ đổi nữa nếu ai làm bước 2.

### 1.6 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ hai hàm bán hàng. **Cố ý không đụng:**

- **Không đụng thân hàm.** Chỉ đổi quyền, không đổi một dòng lệnh nào
- Không đụng hàm nào khác — 52 chỗ kia đã đúng
- Không đụng quyền trên bảng, chỉ quyền chạy hàm
- **Không đổi tên hàm** (lý do ở kế hoạch `0085`)

### 1.7 Chỗ tôi CHƯA xem

- **Còn hàm nào khác thiếu cấp quyền không** — mới đo đúng hai hàm này vì mục 81
  nêu chúng. **Chưa quét cả hệ thống**, và đáng quét: nếu còn cái thứ ba thì
  cùng một migration xử luôn rẻ hơn.
- **Vai `anon` có bị chặn ở tầng nào khác không** (RLS, cấu hình PostgREST) —
  chưa xem. Nếu có thì lỗ này nông hơn tôi mô tả, và **phải nói lại cho đúng**.

### 1.8 Ví dụ tính sẵn

Sau khi chạy, chạy lại đúng phép đo §1.3:

| Hàm | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `create_pos_order_atomic` | **không** | **không** | **có** |
| `create_pos_order_atomic_unvalidated_0025` | **không** | **không** | **có** |

**Cột cuối là cột quan trọng nhất.** `service_role` mất quyền là máy bán hàng
chết. Phải đo, không được suy.

## 2. Thay đổi

1. **Quét cả hệ thống trước** (§1.7): còn hàm nào vai công khai chạy được thì
   liệt kê ra. Nếu có thì báo trước khi viết, đừng tự gộp.
2. **Đo lại chữ ký** của hai hàm bằng `pg_get_function_identity_arguments` trên
   máy chủ — **đừng chép từ file migration** (bài học 01/09).
3. **Viết một migration**, bốn dòng cho mỗi hàm theo mẫu `0006` (§1.4). **Không
   chạy.**

**Không cần sửa mã nguồn nào** — ứng dụng dùng chìa quản trị, và `service_role`
giữ nguyên quyền. **Vì thế migration này chạy độc lập được**, không có bẫy thứ
tự kiểu `0076`. **Nhưng phải chứng minh điều đó bằng phép đo §1.8, không bằng
câu này.**

## 3. Kiểm chứng

- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa:** nội dung migration
  phải chứa cả bốn dòng cho **cả hai** hàm. Nói rõ đỏ vì **giá trị sai** hay
  **thiếu hàm**.
- **Sau khi chạy, đo lại §1.3 trên máy chủ** — ba cột phải ra đúng bảng §1.8.
  **Đặc biệt `service_role` phải còn `có`.**
- **Bán thật một ly sau khi chạy.** Đây là phép kiểm duy nhất chứng minh máy bán
  hàng còn sống; mọi phép kiểm khác chỉ chứng minh cú pháp đúng.
- **Doanh thu không đổi**, năm tháng khớp.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Viết migration, KHÔNG chạy** — chủ quán duyệt lần chạy riêng.
Không tự đẩy.

**Rồi chủ quán bán một ly thật trên máy POS.** Nếu hỏng thì hỏng ngay và hỏng
hẳn, không âm thầm — nên thử một lần là đủ biết.
