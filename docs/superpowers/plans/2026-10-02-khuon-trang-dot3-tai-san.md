# Khuôn danh sách và chi tiết, đợt 3: Tài sản + Thời hạn khấu hao

> **For agentic workers:** UI goes to Gemini via `agy --model gemini-3.8-flash-high` (CLAUDE.md "Ai viết code"; `agy models` checked 2026-10-02). Backend (`app/admin/inventory/assets/actions.ts` + test) goes to Sonnet. Gemini cannot run shell headless; Opus runs tests, proves them red on the old code, and commits.

**Goal:** Đưa trang Tài sản và Thời hạn khấu hao về khuôn của đợt 1–2. Bấm dòng thì mở trang chi tiết. Tài sản có bảng khấu hao theo tháng và lịch sử thanh lý trong trang chi tiết. "Thanh lý" chỉ nằm trong trang chi tiết.

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`, mục 4 dòng đợt 3. Mẫu: `app/admin/suppliers/**`, `app/admin/inventory/items/**`, `app/admin/inventory/units/**`.

## Hiện trạng

1. **Trạng thái.**
   - Tài sản: lọc theo ba thẻ "Còn dùng", "Đã hết khấu hao", "Đã thanh lý", đặt bằng `?tab=`. Giữ nguyên. Thêm `?page=`.
   - Trang chi tiết tài sản là trạng thái mới, `/admin/inventory/assets/[id]`. Mã không có, hoặc tài sản `INACTIVE`, thì 404.
   - Thời hạn khấu hao: hiện chỉ có "đang xem". Thêm "đang chọn" (ô tick). Trang chi tiết mới `/admin/inventory/asset-bands/[id]`.
2. **Nút.**
   - **Tài sản, danh sách:** thẻ lọc, liên kết "Thời hạn khấu hao" ở góc phải đầu trang. Không có nút tạo: tài sản sinh ra từ phiếu nhập. **Không có thùng rác, không có ô tick**: hôm nay tài sản không xoá được ở đâu cả, và đợt này không thêm ("Theo trang"). Bỏ "Đánh dấu hỏng / thanh lý" khỏi thẻ.
   - **Tài sản, chi tiết:** "← Tài sản" về `returnTo`. "Thanh lý" sang `/admin/inventory/assets/[id]/dispose?returnTo=<trang chi tiết>`, ẩn khi đã thanh lý hết. **Không có "Chỉnh sửa"**: tài sản hôm nay không sửa được (giá, ngày, thời hạn được chốt lúc nhập), đợt này không thêm.
   - **Trang thanh lý:** dựng lại cùng khung chi tiết. "Lưu" và "Huỷ" về trang chi tiết.
   - **Thời hạn khấu hao, danh sách:** "+ Thêm khung", ô tick, thùng rác "Xoá", thanh chọn nhiều. Ô tick và thùng rác chỉ hiện với `ADMIN` (`BR-ACCESS-003`, như hiện nay). Bỏ "Sửa" khỏi dòng.
   - **Thời hạn khấu hao, chi tiết:** "← Thời hạn khấu hao", "Chỉnh sửa", "Xoá" (chỉ `ADMIN`).
   - **Trang sửa / thêm khung:** "Lưu", "Huỷ". Sửa thì về chi tiết; thêm thì về danh sách.
3. **Danh sách.**
   - Tài sản: mọi tài sản không `INACTIVE`, theo thẻ đang chọn, sắp theo tên (như `getAssetsData()`). 20 dòng một trang.
     - Cột máy tính: Mã · Tên · Ngày mua · Số lượng còn ("1 / 2 cái") · Đơn giá (phụ, ẩn dưới 1280px) · Thời hạn (phụ) · Giá trị còn lại · Trạng thái.
     - Thẻ điện thoại: tên, nhãn trạng thái, "Mua ngày …", số lượng còn, giá trị còn lại.
   - Thời hạn khấu hao: mọi khung, sắp theo giá thấp nhất. Cột: Mã · Khoảng đơn giá · Số tháng khấu hao.
4. **Ô nhập.**
   - `tab` lạ thì về "Còn dùng" như hiện nay. `page` không phải số nguyên ≥ 1 thì về 1; lớn hơn số trang thì về trang cuối.
   - Ô trong trang thanh lý và trang sửa khung giữ nguyên luật hiện có (`validateDisposalDate`, `validateBands`).
   - `returnTo` qua `safeReturnTo`, đã nhận đường dẫn chi tiết từ đợt 2.
5. **Dữ liệu.**
   - Không đổi bảng, không chạy migration.
   - Thêm một hàm đọc `getAssetDetail(id)` (Sonnet): trả tài sản, lịch khấu hao theo tháng, các lần thanh lý. Không ghi gì.
   - Xoá khung: `deleteAssetBand` đã từ chối bằng tiếng Việt ("Không thể xoá: …") khi xoá làm hở khoảng giá. Giữ nguyên.

Thêm:
- **Số thật (đo 2026-10-02, chỉ đọc):** 84 tài sản, không cái nào `INACTIVE`; 2 lần thanh lý; 3 khung.
  - Theo thẻ: Còn dùng 83 (5 trang: 20, 20, 20, 20, 3), Đã hết khấu hao 0, Đã thanh lý 1 (Cốc đong 100ml, TS-025). Truy vấn tính theo tháng mua + thời hạn − 1; trang tính bằng `summarizeAsset`, có thể lệch nếu truy vấn sai cách đếm tháng — mở trang để đối chiếu.
  - Khung: KH-001 0–200.000đ 12 tháng; KH-002 200.000–500.000đ 24 tháng; KH-003 từ 500.000đ 36 tháng.
- **Ví dụ tính sẵn: Bình bơm (thuỷ tinh, 1300ml, 10ml/lần), TS-004.** Mua 04/04/2026, 2 cái, đơn giá 205.920đ, tổng 411.840đ, 24 tháng. Thanh lý TL-002: 1 cái ngày 02/07/2026, không ghi lý do.
  - Lịch khấu hao: 04, 05, 06/2026 mỗi tháng 17.160đ (2 cái); 07/2026 188.760đ (1 cái giữ lại 8.580đ + cái thanh lý dồn nốt 180.180đ); từ 08/2026 đến 03/2028 mỗi tháng 8.580đ (1 cái). Cộng 24 tháng = 411.840đ.
  - Đến hết 10/2026 đã khấu hao 265.980đ; giá trị còn lại 145.860đ (= 17 tháng × 8.580đ).
  - Trang chi tiết: khối thông tin Mã, Tên, Ngày mua, Số lượng (còn 1 / mua 2 cái), Đơn giá, Tổng tiền mua, Thời hạn khấu hao, Đã khấu hao đến nay, Giá trị còn lại, Trạng thái. Dưới là bảng "Khấu hao theo tháng" (24 dòng: Tháng · Số cái giữ · Khấu hao) và "Thanh lý (1)" (Ngày · Số lượng · Lý do "—").
- **Menu:** không thêm mục. Hai trang chi tiết là `[id]`.
- **Tài liệu:** dòng `routes:` của `docs/03-workflows/assets.md` thêm `/admin/inventory/assets/[id]` và `/admin/inventory/asset-bands/[id]`.
- **Canh:** bỏ `app/admin/inventory/asset-bands/page.tsx` khỏi CHỜ trong `app/admin/list-template.test.ts`.

Đã xem: hai trang danh sách, trang thanh lý, trang sửa khung, `actions.ts` của cả hai, `lib/assets/asset-depreciation.ts` (lịch khấu hao, giá trị còn lại), `safeReturnTo`, số liệu thật ở trên.
Chưa xem: trên trình duyệt (làm sau khi gộp).

## Review Focus

1. Trang `[id]` máy chủ không truyền hàm sang component máy khách (lỗi đợt 1).
2. Thanh lý từ chi tiết rồi lưu: quay về đúng trang chi tiết, số lượng còn và lịch khấu hao đổi theo.
3. Tài sản đã thanh lý hết: chi tiết vẫn mở, không có nút "Thanh lý"; mở thẳng trang thanh lý thì 404 như hiện nay.
4. Xoá khung làm hở khoảng giá: thông báo từ chối hiện đúng ở thùng rác, ở chọn nhiều và ở trang chi tiết.
5. Đổi thẻ lọc thì về trang 1; từ chi tiết quay lại còn đúng thẻ và số trang.

---

### Task 1 (Sonnet): `getAssetDetail`

Brief: `docs/superpowers/plans/dot3-backend-brief.md`.

### Task 2 (Gemini): Tài sản

**Files:**
- Modify: `app/admin/inventory/assets/page.tsx`; Create `assets/components/AssetsClient.tsx` (+test); Modify `assets/components/AssetCard.tsx` (+test: bỏ liên kết thanh lý, thành thẻ điện thoại)
- Create: `assets/[id]/page.tsx` (+test), `assets/[id]/components/AssetDetailView.tsx` (+test)
- Modify: `assets/[id]/dispose/page.tsx`, `components/DisposeAssetForm.tsx` (chỉ khung, bỏ `max-w-2xl`)

- [ ] Test trước, chạy đỏ: danh sách không còn "Đánh dấu hỏng / thanh lý", dòng trỏ `/admin/inventory/assets/TS-004?returnTo=…`; chi tiết TS-004 có "Thanh lý (1)", nút "Thanh lý" trỏ `/dispose?returnTo=<chi tiết>`, không có "Chỉnh sửa"/"Xoá"; tài sản đã thanh lý hết không có nút "Thanh lý"; trang `[id]` không truyền hàm.
- [ ] Gemini làm; chạy xanh, `tsc`.

### Task 3 (Gemini): Thời hạn khấu hao

**Files:**
- Modify: `app/admin/inventory/asset-bands/page.tsx`; Create `asset-bands/components/BandsClient.tsx` (+test)
- Create: `asset-bands/[id]/page.tsx` (+test), `asset-bands/[id]/components/BandDetailView.tsx` (+test)
- Modify: `asset-bands/[id]/edit/page.tsx`, `new/page.tsx`, `components/BandEditForm.tsx`, `AddBandForm.tsx` (chỉ khung)
- Delete: `asset-bands/components/DeleteBandButton.tsx` (thay bằng thùng rác và `RemoveRecordButton`)

- [ ] Test trước, chạy đỏ: danh sách không còn "Sửa", dòng trỏ chi tiết, thùng rác chỉ khi `canDelete`; chi tiết KH-002 có "Chỉnh sửa" trỏ `/edit?returnTo=…`; sửa xong về chi tiết.
- [ ] Gemini làm; chạy xanh.

### Task 4 (Opus): canh, tài liệu, năm cổng, commit
