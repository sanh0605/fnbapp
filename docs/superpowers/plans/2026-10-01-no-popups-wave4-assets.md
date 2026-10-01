# Bỏ khung ô nhập — đợt 4: Tài sản — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thanh lý tài sản, thêm khung khấu hao, sửa khung khấu hao mở thành trang riêng. Lưu hoặc Bỏ thì quay về danh sách, thẻ đang xem (Còn dùng / Đã hết khấu hao / Đã thanh lý) giữ nguyên.

**Architecture:** Giống đợt 2 và 3. Dùng lại `safeReturnTo` của Kho (`app/admin/inventory/components/return-to.ts`, làm ở đợt 3), thêm hai địa chỉ `"/admin/inventory/assets"` và `"/admin/inventory/asset-bands"` vào kiểu `InventoryList`, kèm test.

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` (đợt 4). Luật: `BR-DATA-007`. Mẫu: đợt 2 dưới `app/admin/finance/`, đợt 3 dưới `app/admin/inventory/`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay: `DisposeAssetForm`, `AddBandForm`, `BandEditForm` dùng `FormModal` và giữ `isOpen`.
   - Sau đợt này: không còn `isOpen`.
     - Trang thanh lý `/admin/inventory/assets/[id]/dispose`. Tài sản không có, hoặc đã thanh lý hết (`bucket === "DISPOSED"`), thì `notFound()`. Danh sách cũng không hiện nút thanh lý cho tài sản đã thanh lý hết.
     - Trang thêm khung `/admin/inventory/asset-bands/new`, trang sửa khung `/admin/inventory/asset-bands/[id]/edit`. Khung không có thì `notFound()`.
2. **Nút.**
   - "Đánh dấu hỏng / thanh lý" trên thẻ tài sản thành liên kết sang trang thanh lý, kèm `returnTo` là địa chỉ danh sách có `?tab=` đang xem.
   - "+ Thêm khung" và "Sửa" ở Thời hạn khấu hao thành liên kết.
   - Trên trang: `BackLink` ("← Tài sản" hoặc "← Thời hạn khấu hao") về `returnTo`, nút "Bỏ" về `returnTo`, nút lưu giữ chữ cũ ("Xác nhận" ở thanh lý, "Lưu" ở khung).
   - Giữ nguyên: nút Xoá khung (`DeleteBandButton`) và khung xác nhận của nó; "Bảng thời hạn" trên trang Tài sản.
3. **Danh sách.** Không đổi nội dung. Trang Tài sản đã giữ thẻ trên địa chỉ (`?tab=`); trang đưa `tab` đang xem xuống `AssetCard` để dựng `returnTo`.
4. **Ô nhập.** Giữ nguyên tên, luật, `inputMode="numeric"`. Thanh lý: số lượng 1 đến số còn lại; ngày mặc định hôm nay giờ Sài Gòn (giữ cách tính hiện tại, test cũ đang canh); số tiền sẽ ghi chi phí tính thử ngay khi mở trang (trước đây chạy khi bấm nút mở khung; nay chạy trong `useEffect` lúc trang hiện) và mỗi lần đổi số lượng hoặc ngày.
5. **Dữ liệu.** Không đổi server action, không đổi bảng.
   - Trang thanh lý: `getAssetsData()` rồi `find` theo `id`.
   - Trang sửa khung: `getAssetBands()` rồi `find` theo `id`.

Thêm:
- **Màn hình hai thiết bị:** hai trang này đang dựng một cột rộng tối đa `max-w-2xl` (dựng cho điện thoại trước). Trang mới theo đúng khuôn đó: `p-4 max-w-2xl mx-auto space-y-4`. Trên máy tính một form một cột là đủ dùng, không cần bảng.
- **Menu:** `/admin/inventory/asset-bands/new` thêm vào `app/admin/nav-allowlist.ts`.
- **Tài liệu:** `docs/03-workflows/assets.md` dòng `routes:` thêm ba địa chỉ mới.

Đã xem: `assets/page.tsx`, `assets/components/AssetCard.tsx` (chỗ nút), `DisposeAssetForm.tsx`, `DisposeAssetForm.test.tsx` (đầu), `asset-bands/page.tsx`, `AddBandForm.tsx`, `BandEditForm.tsx`, tên hàm trong hai `actions.ts`.

Chưa xem: `AssetCard.test.tsx`, `DeleteBandButton.tsx`.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Điện thoại: vùng bấm 44px, `inputMode="numeric"` cho mọi ô số.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Giữ mọi khẳng định của test cũ; chỉ bỏ bước bấm nút mở khung.

## Review Focus

1. Đang ở thẻ "Đã hết khấu hao", thanh lý một tài sản: xong quay về đúng thẻ "Đã hết khấu hao".
2. Mở trang thanh lý: ô "Sẽ ghi nhận chi phí tháng này" có số ngay, không cần gõ gì.
3. Gõ tay địa chỉ thanh lý của tài sản đã thanh lý hết: 404.
4. Thêm khung chồng lên khung cũ: máy chủ từ chối, dòng đỏ hiện trên trang, không rời trang.
5. Mở lúc 01:00 sáng giờ Sài Gòn: ngày thanh lý mặc định là hôm nay, không phải hôm qua (test cũ canh).

---

### Task 1: Mở rộng `InventoryList`

- [ ] Thêm hai địa chỉ vào kiểu và hai ca vào `app/admin/inventory/components/return-to.test.ts`: `"/admin/inventory/assets?tab=DISPOSED"` với list assets giữ nguyên; `"/admin/inventory/asset-bands"` với list assets thành `"/admin/inventory/assets"`.

### Task 2: Thanh lý

**Files:** `assets/components/DisposeAssetForm.tsx`, `DisposeAssetForm.test.tsx`, `AssetCard.tsx`, `AssetCard.test.tsx`, `assets/page.tsx`, tạo `assets/[id]/dispose/page.tsx`.

- [ ] Test form (đỏ trên bản cũ): render `<DisposeAssetForm asset={…} returnTo="/admin/inventory/assets?tab=FULLY_DEPRECIATED" />` thấy ngay ô "Số lượng thanh lý"; `previewDisposalCharge` được gọi một lần lúc hiện mà không bấm gì; "Bỏ" thì `push("/admin/inventory/assets?tab=FULLY_DEPRECIATED")`. Sửa các test cũ: bỏ bước bấm nút mở khung, mock `useRouter` trả cả `push`.
- [ ] Test thẻ: `AssetCard` với `returnTo="/admin/inventory/assets?tab=FULLY_DEPRECIATED"` có liên kết "Đánh dấu hỏng / thanh lý" tới `/admin/inventory/assets/<id>/dispose?returnTo=%2Fadmin%2Finventory%2Fassets%3Ftab%3DFULLY_DEPRECIATED`; tài sản `bucket: "DISPOSED"` không có liên kết đó.
- [ ] Code: `AssetCard` nhận prop `returnTo: string`; trang danh sách truyền `tabHref(activeTab)`.

### Task 3: Khung khấu hao

**Files:** `asset-bands/components/AddBandForm.tsx`, `BandEditForm.tsx`, `asset-bands/page.tsx`, tạo `asset-bands/new/page.tsx`, `asset-bands/[id]/edit/page.tsx`, `AddBandForm.test.tsx`, `BandEditForm.test.tsx`.

- [ ] Test (đỏ): mỗi form render thấy ngay ô "Số tháng khấu hao"; `BandEditForm` điền sẵn số tháng của khung; "Bỏ" về `/admin/inventory/asset-bands`.
- [ ] Code: như mục Hiện trạng. Câu nhắc "Khung mới phải khớp khít…" và "Sửa khung chỉ áp dụng cho tài sản mua sau khi lưu…" giữ nguyên.

### Task 4: Menu, tài liệu

- [ ] `app/admin/nav-allowlist.ts`, `docs/03-workflows/assets.md` như mục Thêm.
- [ ] Opus: chứng minh đỏ trên bản cũ, chạy đủ năm lệnh, commit trên `feat/no-popups`.
