# Nền tảng: nâng cấp Next/React, dọn code theo ponytail, dọn database — đề xuất

Chủ quán, 2026-10-15: *"việc mà anh đang muốn thay đổi nhất là giao diện, ui, ux, frontend… Hiện tại
đang không trong giai đoạn bán hàng, có nên update next và react để phần giao diện nói chung có thể
tốt lên hơn không? Rồi anh muốn tái cấu trúc lại code theo ponytail và tối ưu database để lưu dữ liệu
đầy đủ nhưng không có cột thừa."* Và: *"kết hợp các việc mà fnbapp-f5 đã làm để phân tích sâu và chi
tiết hơn."*

Bản này gộp bốn nguồn: bản soát toàn bộ ngày 2026-10-14 (đã đẩy cùng `feebd7ee`; file kế hoạch đã xoá, git giữ), hai bản
đề xuất theo mảng của phiên fnbapp-f5 (`docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`,
`docs/superpowers/specs/2026-10-15-kho-de-xuat.md`), hàng 6c và 6d của kế hoạch chung, và số đo
mới ngày 2026-10-15 (chỉ đọc). Mọi con số đo lại trước khi dùng.

## Hiện trạng

1. **Trạng thái.** Không áp dụng, vì nền tảng không có trạng thái riêng; mỗi bước dưới đây ở một
   trong ba trạng thái chưa làm, đang làm, xong, ghi tay trong kế hoạch chung.
2. **Nút.** Không áp dụng, vì không dựng màn hình. Nâng cấp không đổi nút nào; mọi nút phải chạy
   như cũ sau khi nâng cấp, đó là tiêu chí nghiệm thu.
3. **Danh sách.** Gồm: nâng cấp nền (Next, React, công cụ kiểm), dọn code chết đã liệt kê, dọn cột
   thừa theo mảng. Loại ra: vẽ lại từng trang (6c, làm theo mảng như đã chốt 2026-10-15) và máy bán
   hàng (phần 7), vì hai thứ đó có kế hoạch riêng.
4. **Ô nhập.** Không áp dụng, vì không có ô nhập.
5. **Dữ liệu.** Nâng cấp nền không đụng dữ liệu, không có migration. Dọn cột đụng 40 bảng, 409 cột;
   danh sách cột thừa đã có ở hai mảng, ba mảng chưa soát.

Đo trên máy chủ 2026-10-15, chỉ đọc: 40 bảng, 409 cột, 1 view. Bảng nhiều cột nhất: `orders_v2` 29,
`purchase_orders` 23, `order_lines_v2` 17, `cash_entries` 16, `stocktake_sessions` 15.

Đo trên nhánh `feat/no-popups` (`26e72d2f`) 2026-10-15: 469 file mã nguồn không tính test, 57.046
dòng; 110 trang `page.tsx`; 4 `route.ts`; 135 file `"use client"`; 492 file test; 123 migration.

## 1. Nâng cấp Next 14 → 16, React 18 → 19

### Đang dùng và bản mới nhất (đo 2026-10-15)

| Thứ | Đang dùng | Mới nhất | Bản mới có nhận React 19 / Next 16 không |
|---|---|---|---|
| next | 14.2.3 | 16.4.1 | — |
| react, react-dom | 18 | 19.3.1 | — |
| next-auth | 4.24.14 | 4.24.14 | có: peer `next ^16`, `react ^19` |
| react-datepicker | 9.1.0 | — | có: peer `react ^19` |
| @testing-library/react | 16.3.3 | — | có: peer `react ^19` |
| eslint, eslint-config-next | 8, 14.2.3 | 9, 16.4.1 | Next 16 bỏ `next lint`, cần eslint 9 dạng flat config |
| Node trên máy | 24.14.1 | — | Next 16 cần ≥ 20.9 |

Không có thư viện nào chặn đường. `googleapis` (111 MB) không file nào dùng ngoài một test nhắc tên.

### Chỗ nâng cấp sẽ đụng (grep 2026-10-15)

| Việc | Số chỗ | Ai sửa |
|---|---|---|
| Trang nhận `params`/`searchParams` đồng bộ; Next 16 bắt buộc `await` | 101 trang, 0 trang đã dùng Promise | codemod `next-async-request-api` tự sửa |
| `cookies()`, `headers()` | 0 | — |
| `revalidateTag(tag)` cần đối số thứ hai, hoặc đổi sang `updateTag` trong server action | 44 chỗ | Sonnet, một lần grep |
| `revalidatePath` | 103 chỗ, không đổi | — |
| `unstable_cache` | 5 file, kiểm lại cách chạy trên Next 16 | Sonnet |
| `middleware.ts` (next-auth `withAuth`) đổi tên `proxy.ts`, chạy Node.js | 1 file | Sonnet |
| `next.config.js`: bỏ `swcMinify`, bỏ khối `eslint`; giữ `redirects` | 1 file | Sonnet |
| `npm run lint` → eslint CLI, flat config | 1 file cấu hình | Sonnet |
| `forwardRef` (vẫn chạy ở React 19, chỉ là cũ) | 4 file | không bắt buộc |
| `useFormState`, `next/image`, cấu hình webpack, AMP, parallel routes | 0 | — |

### Được gì

- `next dev` và `next build` ghi hai thư mục riêng (`.next/dev` và `.next`), nên hết cảnh build làm
  sập máy chủ dev cổng 8386; không cần build trong worktree riêng nữa.
- Turbopack mặc định: mở trang lần đầu khi dev nhanh hơn.
- React 19 cho phần giao diện sắp vẽ lại: `useActionState`, `useOptimistic`, form action, `use()`,
  ref truyền như prop, View Transitions. Giao diện mới vẽ một lần trên nền mới, không phải sửa lại.
- React Compiler có sẵn, **không bật** trong lần nâng cấp này (hướng dẫn chính thức nói không bật
  chỉ để hoàn tất nâng cấp).

### Rủi ro và cách đỡ

- **Cache mặc định đổi** (từ Next 15): `fetch` không cache, trang không dùng lại từ cache phía
  trình duyệt khi bấm Link. Trang có thể đọc máy chủ nhiều hơn. Đỡ: đo thời gian mở 5 trang (Tổng
  quan, Đơn hàng, Phiếu nhập, Doanh số, máy bán hàng) trước và sau, cùng cách đo của phần 0.
- **Máy bán hàng** là phần client nặng nhất (`POSScreen.tsx` 1.192 dòng, có test offline). Đỡ:
  mở máy bán trên bản preview Vercel sau khi đăng nhập, thêm món vào giỏ, kiểm đơn chờ offline;
  phép thử `POSScreen.offline.test.tsx` phải xanh.
- **Không có migration**, không đụng dữ liệu. Hỏng thì Vercel quay lại bản trước trong một phút.
- Đang không bán hàng: đây là lúc rẻ nhất để chịu rủi ro này.

### Các bước (một phiên, một lần đẩy)

1. Nhánh `chore/next-16`. Đo trước: thời gian `npm run build`, thời gian mở 5 trang.
2. `npx @next/codemod@canary upgrade latest` (Next 16.4.1, React 19.3.1, types), rồi
   `next-async-request-api .` và `next-lint-to-eslint-cli .`
3. Sửa tay các dòng trong bảng trên. Gỡ `googleapis` cùng lúc.
4. Năm lệnh kiểm xanh, thêm `npm run lint` eslint 9.
5. Preview Vercel; mở sau đăng nhập 5 trang + máy bán hàng ở 1568/1024/390 px.
6. Đẩy (chủ quán duyệt riêng). Theo dõi lỗi máy chủ một giờ.

## 2. Code thừa (ponytail)

Bản soát 2026-10-14 đợt 3 ước khoảng −8.000 dòng, −1 thư viện. Phần Kho đã xoá (S3, phiên
fnbapp-f5). Còn trên nhánh hôm nay, mỗi file đã grep không ai dùng:

- `components/ui/DeleteConfirmModal.tsx`, `FormModal.tsx`, `LoadingButton.tsx`.
- `getCashEntries`, `summariseEntries` (`lib/finance`, `app/admin/finance/actions.ts`);
  `getPromotionPerformanceV2` (`app/admin/reports/engagement-actions.ts`);
  `lib/shared/money-digits.ts`.
- `app/api/revalidate`.
- `tests/migrations/`: 65 file, 3.964 dòng; bản soát nói 16 file canh bảng đã gỡ, phải grep lại từng
  file vì từ 14/10 tới nay có thêm migration 0119–0124.
- `googleapis` trong `package.json`.

Đợt 4 gộp chỗ lặp (đo lại 2026-10-15): `safeReturnTo` 13 bản chép; `useFilterForm` cho 19 trang
danh sách; một hàm tính giá giỏ dùng chung máy bán, giỏ, sửa đơn, máy chủ (C10); dòng đơn ở danh
sách và chi tiết dùng chung (C14). Gộp lặp làm **trong lúc vẽ lại mảng đó**, không làm đợt riêng:
vẽ lại trang mà vẫn giữ bản chép là làm hai lần.

File lớn nhất, chỉ để biết, không tách khi chưa có lý do: `POSScreen.tsx` 1.192, `CartPanel.tsx`
690, `lib/db/tables.ts` 674, `CashBookClient.tsx` 653, `DataList.tsx` 650, `PurchasedItemForm.tsx`
616, `DateRangeButton.tsx` 587. Không có comment `shortcut:` nào.

## 3. Database

Cách làm đã chốt 2026-10-15 ("Làm lại từng mảng"): soát cột theo mảng, mỗi mảng một đợt migration
ngoài giờ bán, thứ tự "code thôi đọc → migration → code thôi gửi". Không soát lại toàn bộ 40 bảng
một lần nữa.

| Mảng | Bảng (số cột) | Đã soát | Còn |
|---|---|---|---|
| Bán hàng | orders_v2 29, order_lines_v2 17, order_payments 6, order_events 11, products 10, product_variants 7, product_categories 5, product_types 4, product_price_history 7, modifiers 10, modifier_groups 9, modifier_group_products 3, promotions 14 | có (f5) | migration 0121 đã chạy, 0 cột chết trên đơn; còn C10 (bảng khuyến mãi áp cho đơn, bảng món của khuyến mãi: bảng mới, đủ bốn bước), bỏ DELETED, `products.brand_id` |
| Kho | purchased_items 11, suppliers 12, units 6, uom_conversions 9, item_categories 5, purchase_orders 23, purchase_order_lines 11, purchase_order_edits 10, purchase_sources 4, issue_slips 6, stock_issues 10, stocktake_sessions 15, stocktake_lines 7, assets 12, asset_disposals 8, asset_depreciation_bands 7 | có (f5) | 6 cột thừa đã liệt kê (`default_unit_id`, `parent_id`, `abbreviation`, `issue_slips.note`, `asset_depreciation_bands.status`, `purchase_order_lines.base_unit`), `unit` hai kiểu trên 359 dòng, mã PO/STK cắt ở 1000, RESTRICT thay CASCADE; bước 7 của kho-de-xuat |
| Thu chi | cash_entries 16, cash_categories 12, cash_transfers 13, bank_accounts 11, monthly_expense_items 10 | chưa | soát khi tới mảng; kèm Q6 Shopee (53 phiếu, 26.048.237đ) |
| Báo cáo, Tổng quan | dashboard_settings 9 | chưa | soát khi tới mảng |
| Máy bán hàng | pos_drafts 11, pos_sync_failures 6 | chưa | soát ở phần 7, cuối cùng |
| Nhân sự, Thương hiệu, Điểm bán | users 8, brands 7, outlets 12 | chưa | gộp vào mảng Bán hàng đợt sau |

## Ba cách sắp thứ tự

**A. Nền trước, rồi từng mảng (khuyến nghị).** Nâng cấp → dọn code chết → từng mảng (cột thừa +
giao diện + gộp lặp của mảng đó) → máy bán hàng. Nâng cấp là việc máy làm phần lớn (codemod sửa
101 trang), một phiên, một lần đẩy, không migration, quay lại được trong một phút. Mọi trang vẽ
lại sau đó đứng trên React 19 và được vẽ đúng một lần.

**B. Giao diện trước, nâng cấp sau.** Vẽ lại xong rồi codemod chạm lại đúng những trang vừa vẽ;
đợt vẽ không dùng được React 19. Chỉ hợp khi muốn thấy giao diện mới ngay tuần này.

**C. Dọn hết database một lần rồi mới giao diện.** Trái với chốt 2026-10-15 "làm lại từng mảng";
cột thừa ở ba mảng chưa soát chỉ lộ ra khi soát kỹ mảng đó cùng màn hình của nó.

## Kế hoạch A

| Bước | Việc | Cỡ | Đụng dữ liệu | Cần duyệt |
|---|---|---|---|---|
| 1 | Nâng cấp Next 16, React 19, eslint 9; gỡ `googleapis` | 1 phiên | không | đẩy |
| 2 | Xoá code chết mục 2; đo dòng trước và sau; không đổi gì chủ quán thấy | 1 phiên | không | đẩy |
| 3 | Mảng Bán hàng còn lại: C10 + bảng khuyến mãi (bốn bước), bỏ DELETED, giao diện theo khuôn chung | theo kế hoạch con | có | migration, đẩy, từng lần |
| 4 | Mảng Kho bước 4–8 của kho-de-xuat: Ngừng dùng, Tồn kho, Kiểm kê, bỏ Bảng quy đổi, đợt migration cấu trúc | theo kế hoạch con | có | migration, đẩy, từng lần |
| 5 | Mảng Thu chi: soát cột + giao diện + Q6 | soát trước rồi mới ước | có | như trên |
| 6 | Mảng Báo cáo và Tổng quan | soát trước | có | như trên |
| 7 | Máy bán hàng và đăng nhập (phần 7), kể cả `pos_drafts`, `pos_sync_failures`, C1 bán khi mất mạng | soát trước | có | báo trước: có thể làm quầy ngừng nhận đơn |

Trước bước 3, khuôn chung (6c) phải chốt một lần: tra cách 3–4 hệ thống lớn cùng ngành dựng trang
danh sách, chi tiết, tạo/sửa, báo cáo; vẽ một trang mẫu cho chủ quán xem; chốt rồi mới vẽ từng
mảng. Khuôn thành phần `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` và khuôn
danh sách/chi tiết `2026-10-02` là điểm xuất phát, không phải đích.

## Đã xem, chưa xem

Đã xem: `package.json`, `next.config.js`, `middleware.ts`, `vitest.config.ts`, hướng dẫn nâng cấp
chính thức bản 15 và 16 (nextjs.org, cập nhật 2026-10-02), peer dependencies của next-auth,
react-datepicker, @testing-library/react trên npm, kế hoạch chung, bản soát 14/10, hai bản đề xuất
Bán hàng và Kho, trả lời của phiên fnbapp-f5 (cây làm việc sạch, 7 commit tài liệu chưa đẩy, Bán
hàng còn C10, Kho còn bước 4–8), `information_schema` trên máy chủ.

Chưa xem: codemod chạy thật trên code này (chỉ đếm chỗ đụng); 5 file `unstable_cache` chạy ra sao
trên Next 16; cài đặt Node trên Vercel; từng file trong `tests/migrations/` còn canh thứ gì; cột
của ba mảng chưa soát.

## Câu hỏi chủ quán

1. Chốt thứ tự A (nền trước, rồi từng mảng) không? Khuyến nghị: A.
2. (Hỏi sau khi xong bước 2.) Khuôn chung 6c: tra hệ thống lớn và vẽ một trang mẫu trước khi vẽ mảng
   Bán hàng?
