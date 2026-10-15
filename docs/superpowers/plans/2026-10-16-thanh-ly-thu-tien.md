# Kế hoạch: thanh lý tài sản ghi số tiền thu được

Ngày 2026-10-16. Luật: `BR-COGS-008` đoạn "A disposal records the money it brought in" (chủ quán chốt 2026-10-08, chọn "1a" và "2a"). Việc chờ: `it.todo` trong `app/admin/inventory/assets/components/DisposeAssetForm.test.tsx`.
Sửa thứ đã có (không tạo bảng, không thêm thư mục `app/`), nên thiết kế viết rút gọn ở đây.

Đã xem: `app/admin/inventory/assets/actions.ts` (`disposeAsset`), `DisposeAssetForm.tsx`, `lib/reports/profit-and-loss.ts` bước 2, `lib/reports/profit-and-loss-table.ts`, `lib/assets/asset-depreciation.ts`, ràng buộc của `cash_entries`, `cash_categories`, `asset_disposals` trên máy chủ, thứ tự bảng trong `supabase/functions/backup-to-drive/core.ts`.
Chưa xem: trang chi tiết tài sản (chỗ liệt kê các lần thanh lý), màn hình sửa một dòng sổ thu chi, `scripts/restore-backup-to-target.ts`.

## Hiện trạng

1. **Trạng thái.** Một lần thanh lý không có trạng thái, chỉ thêm, không sửa, không xoá. Dòng sổ thu chi có hai trạng thái, `ACTIVE` và `CANCELLED` (huỷ ở màn hình sổ thu chi).
2. **Nút.** Trang thanh lý có một nút "Thanh lý". Không có nút sửa hay huỷ một lần thanh lý, và việc này không thêm nút đó.
3. **Danh sách.** Trang thanh lý chọn lô còn hàng. Danh sách tài khoản ngân hàng mới thêm chỉ lấy tài khoản đang dùng (`ACTIVE`).
4. **Ô nhập.** Hiện có số lượng (số nguyên, từ 1 tới số còn lại), ngày (từ ngày mua tới hôm nay) và lý do (tuỳ ý). Thêm hai ô:
   - **Số tiền thu được:** số nguyên đồng, từ 0 trở lên. Để trống thì không lưu được, báo "Nhập số tiền thu được, bỏ đi thì nhập 0".
   - **Nhận vào:** Tiền mặt, hoặc Chuyển khoản kèm tài khoản. Chỉ hiện khi số tiền lớn hơn 0.
5. **Loại dữ liệu.** Chỉ tiền bán lại tài sản đã có trong sổ tài sản. Cố ý không phục vụ hai việc: bán đồ không có trong sổ tài sản (ghi tay vào sổ thu chi như hôm nay) và trả góp nhiều lần (một lần thanh lý có tối đa một dòng thu).

Câu hỏi thêm cho việc này:

6. **Sửa nhầm số tiền thì sao?** Huỷ dòng thu ở sổ thu chi, rồi ghi tay một dòng đúng vào cùng nhóm. Lãi lỗ đọc theo nhóm nên vẫn đúng. Trang tài sản hiện dòng thu đã huỷ là "đã huỷ", không giấu.
7. **Ngừng dùng nhóm "Thu thanh lý tài sản" thì sao?** Thanh lý có tiền bị từ chối, kèm lời báo bằng tiếng Việt. Thanh lý 0đ vẫn lưu được.
8. **Hai lần thanh lý cũ** (02/07/2026, "Cốc đong 100ml" và "Bình bơm") là 0đ, đúng như chủ quán chốt. Không có dòng thu nào được tạo cho chúng, không ghi gì vào dữ liệu cũ.

## Thiết kế

Chỉ ghi số tiền ở **một chỗ**: dòng thu trong sổ thu chi. Lần thanh lý không giữ bản sao số tiền.

- **Liên kết.** Thêm `cash_entries.asset_disposal_id text references asset_disposals(id) on delete restrict`, có `unique`. Đây đúng là lối `cash_entries.monthly_item_id` đang dùng: dòng tiền trỏ về chứng từ sinh ra nó.
  - Thanh lý 0đ thì không có dòng thu, nên "không có dòng nào trỏ tới" nghĩa là 0đ.
  - Không có hai con số có thể lệch nhau.
  - Trong bản sao lưu, `asset_disposals` (dòng 33) đứng trước `cash_entries` (dòng 72), nên khôi phục vẫn đúng thứ tự. Không phải sửa hay triển khai lại hàm sao lưu.
- **Nhóm thu.** Thêm `cash_categories.is_asset_disposal boolean not null default false`, chép đúng lối `is_sales_revenue`:
  - ràng buộc: cờ bật thì nhóm phải là thu (`INCOME`) và tính vào lãi lỗ;
  - chỉ mục `unique` một phần (`where is_asset_disposal`): tối đa một nhóm bật cờ;
  - migration thêm dòng nhóm "Thu thanh lý tài sản" (INCOME, tính lãi lỗ, bật cờ). Mã lấy số kế tiếp: hiện có CFC-001…007, nên là CFC-008, phải đo lại lúc viết.
  - Chủ quán đổi tên nhóm thoải mái; máy tìm nhóm theo cờ, không theo tên hay mã.
- **Ghi.** Hàm Postgres `dispose_asset_atomic`, gọi qua rpc, vì ghi hai bảng (luật dự án):
  - thêm lần thanh lý; nếu tiền lớn hơn 0 thì thêm dòng thu: ngày = ngày thanh lý, nhóm = nhóm có cờ, ghi chú "Thanh lý <mã TL>: <tên tài sản> × <số lượng>";
  - mã TL và mã dòng thu sinh ở TypeScript bằng `generateNewId` như hôm nay, rồi truyền vào hàm;
  - trigger `asset_disposals_guard` (0123) vẫn chặn thanh lý quá số còn;
  - ràng buộc sẵn có của `cash_entries` (số tiền > 0, chuyển khoản phải có tài khoản) tự chặn dữ liệu sai.
- **Action.** `disposeAsset` đọc thêm `proceeds`, `payment_method`, `bank_account_id`:
  - kiểm tra ở máy chủ: trống thì từ chối; không phải số nguyên hoặc âm thì từ chối;
  - từ chối khi tiền > 0 mà thiếu cách nhận, hoặc chọn chuyển khoản mà thiếu tài khoản;
  - thay `insert` bằng rpc;
  - làm mới cả đường dẫn sổ thu chi và lãi lỗ.
- **Lãi lỗ.** Trong `lib/reports/profit-and-loss.ts` bước 2, thêm nhánh: nhóm thu có `is_asset_disposal` thì cộng vào khoản mới `disposalIncome` (có `sources`), không vào `otherIncome`.
  - `profit-and-loss-table.ts` thêm dòng "Thu thanh lý tài sản" ngay dưới "Thu khác", chỉ hiện khi khác 0; cộng vào lãi ròng; câu diễn giải thêm "+ thu thanh lý".
  - Phần còn lại của tài sản vẫn nằm ở dòng khấu hao, không trừ bù vào dòng thu (lựa chọn "2a").
- **Chỗ khác đọc kết quả:**
  - `scripts/verify-pnl-monthly-core.ts` thêm `disposalIncome` vào bảng so khớp;
  - fixture `app/admin/reports/pnl/__fixtures__/pnl-2026.ts` và các test có dựng đối tượng tháng thêm trường mới.

### Sửa sau phản biện của Sonnet (2026-10-16)

1. **Lãi lỗ.** `disposalIncome` phải có ở mọi chỗ sau:
   - `lib/reports/profit-and-loss.ts`: kiểu dữ liệu và `sources` (dòng 30-51), `emptyMonth`, `hasAnyFigure` (thiếu thì tháng chỉ có tiền thanh lý bị rơi khỏi báo cáo), phần sắp xếp nguồn (~292);
   - `profit-and-loss-table.ts`: `net` (128), câu diễn giải (196), mảng tách cột và phép kiểm lệch làm tròn (229-236). Thiếu thì mọi tháng có thanh lý hiện nhầm câu "lệch do làm tròn";
   - `scripts/verify-pnl-monthly.ts`: dòng in (34-43). `-core.ts`: mảng `lines` (36).
2. **Giữ nhóm có cờ đúng.**
   - Ràng buộc `not (is_sales_revenue and is_asset_disposal)`.
   - Ở `app/admin/finance/categories/actions.ts`, nhóm có cờ:
     - không đổi được Thu/Chi;
     - không bỏ được "tính vào lãi lỗ";
     - không bật được "doanh thu bán hàng";
     - không xoá hẳn được;
     - từ chối bằng lời tiếng Việt.
   - Ngừng dùng thì vẫn cho (câu 7).
   - Không thêm giao diện khoá; máy chủ từ chối là đủ.
3. **Dòng thu sinh từ thanh lý.**
   - Ở `updateCashEntry` không đổi được nhóm và ngày (để tiền thu và khấu hao của lần thanh lý luôn nằm cùng một tháng); báo "Dòng này ghi từ thanh lý tài sản, không đổi nhóm được" hoặc "…không đổi ngày được". Số tiền, cách nhận và ghi chú vẫn sửa được.
   - Thêm một test: sửa dòng thì `asset_disposal_id` vẫn còn. Đã đọc: `update` chỉ ghi các cột được gửi lên, `tables.ts:595`.
   - Xoá hẳn dòng thu (chỉ chủ quán làm được) thì lần thanh lý đọc thành 0đ. Chấp nhận, vì đó là ý người xoá.
   - Dòng gõ tay vào nhóm này vẫn tính vào "Thu thanh lý tài sản" ở lãi lỗ, nhưng không hiện ở trang tài sản. Cố ý như vậy, và đó cũng là cách sửa nhầm ở câu 6.
4. **Hàm `dispose_asset_atomic`.**
   - Lúc ghi, kiểm nhóm có cờ còn dùng và tài khoản ngân hàng còn dùng; sai thì báo bằng tiếng Việt như `asset_disposals_guard`.
   - Đặt `set search_path to 'public'`; `revoke all … from public, anon, authenticated` như 0123.
   - Có hàm bọc trong `lib/assets/`, theo mẫu `asset-bands-transaction.ts`.
   - `disposeAsset` dùng `parseCashEntry` (`cash-entry-rules.ts`) để kiểm dòng thu: ngày, số tiền, cách nhận, ghi chú. Sổ thu chi không nhận một dòng mà tay gõ cũng bị từ chối.
   - Phần đầu migration liệt kê trigger: `trg_cash_entries_touch`, `trg_cash_categories_touch`, `asset_disposals_guard`.
5. **Kiểu dữ liệu.** `is_asset_disposal?: boolean` là trường tuỳ chọn, đọc bằng `=== true` như `is_sales_revenue`, để khoảng 10 fixture không phải sửa. `asset_disposal_id?: string | null` cũng vậy.
6. **Phiếu A làm cả dữ liệu cho màn hình**, Gemini chỉ vẽ:
   - `getAssetItemDetail` / `buildAssetItemDetail` (`lib/assets/asset-items.ts`) nạp dòng thu theo `asset_disposal_id`: số tiền, cách nhận, tên tài khoản, trạng thái;
   - trang thanh lý nạp các tài khoản ngân hàng đang dùng và truyền vào form.

Ghi chú:
- Thanh lý ghi vào tháng đã qua thì lãi lỗ tháng đó đổi cả khấu hao lẫn thu. Khấu hao vốn đã như vậy từ trước; hệ thống không khoá tháng.
- Ô số tiền giữ "bắt buộc nhập, 0 hợp lệ", đúng chữ trong `BR-COGS-008`: *"The amount box starts empty and must be filled; 0 is a valid answer."*

## Ví dụ tính sẵn (đo 2026-10-16 bằng `buildAssetSchedule`, chính hàm hệ thống dùng)

"Xe bán nước gấp gọn" (TS-027): mua 04/04/2026, 2.100.000đ, khấu hao 36 tháng, mỗi tháng 58.333,33đ. Giả sử bán ngày 16/10/2026 được 1.200.000đ tiền mặt.

| Dòng lãi lỗ tháng 10/2026 | Không bán | Bán 1.200.000đ |
|---|---|---|
| Khấu hao của xe này | 58.333đ | 1.750.000đ (6 tháng 4–9 đã tính 350.000đ; phần còn lại dồn hết vào tháng 10) |
| Thu thanh lý tài sản | không hiện | 1.200.000đ |
| Ảnh hưởng tới lãi tháng 10 | | −1.750.000 + 58.333 + 1.200.000 = **−491.667đ** so với không bán |

Từ tháng 11 trở đi không còn khấu hao của xe này (đo: 0 tháng có khấu hao sau tháng 10). Sổ thu chi có thêm một dòng thu tiền mặt 1.200.000đ, ngày 16/10/2026, nhóm "Thu thanh lý tài sản", ghi chú "Thanh lý TL-003: Xe bán nước gấp gọn × 1". Trang tài sản của xe hiện "Thu được 1.200.000đ, tiền mặt".

Con số khớp với ví dụ chủ quán đã duyệt ngày 08/10, cũng lỗ 491.667đ.

## Phiếu giao việc

**A. Backend: `backend-coder` (Sonnet 5.5).** Viết test trước.
- Migration `0131`: cột `cash_entries.asset_disposal_id`, cờ `cash_categories.is_asset_disposal` kèm ràng buộc và chỉ mục, dòng nhóm "Thu thanh lý tài sản", hàm `dispose_asset_atomic`. Test chữ migration đặt trong `tests/`.
- `disposeAsset` dùng rpc và kiểm tra các ô mới.
- Lãi lỗ thêm `disposalIncome` và dòng mới; `verify-pnl-monthly` thêm cột.
- Các mục 1-6 ở "Sửa sau phản biện".
- Đổi `it.todo` thành test xanh.
- Cập nhật `BR-COGS-008` (bỏ chữ "not built yet"), `docs/03-workflows/assets.md` mục "Where it writes", và `docs/01-system/TABLE-DICTIONARY.md`.

**B. Giao diện: Gemini qua `agy`** (bản mới nhất, kiểm `agy models` lúc giao), làm sau A vì cần tên trường.
- Trang thanh lý thêm ô số tiền và ô nhận vào (Tiền mặt / Chuyển khoản + tài khoản).
- Trang chi tiết tài sản: mỗi lần thanh lý hiện số tiền thu được và cách nhận, hoặc "0đ"; dòng thu đã huỷ ghi "đã huỷ".
- Bố cục máy tính và điện thoại riêng (`.claude/rules/ui-devices.md`); không dùng hộp bật lên (`BR-DATA-007`).

## Kiểm và duyệt

- Năm lệnh kiểm của dự án; build chạy trong `.worktrees`.
- `npx vite-node scripts/verify-pnl-monthly.ts`: các tháng đã có phải lệch 0, vì hôm nay chưa có dòng thu thanh lý nào. Báo kèm số tháng đã so.
- Soát bởi agent `reviewer` riêng.
- Duyệt từng việc với chủ quán:
  - chạy migration `0131` lên máy chủ thật;
  - đẩy code.
- **Thứ tự lên máy chủ:** migration chạy trước rồi mới đẩy code. Migration chỉ thêm cột, thêm hàm và thêm một nhóm, không đổi kiểu trả về của hàm nào, nên code cũ vẫn chạy bình thường.
- **Máy bán hàng:** không đọc bảng nào trong ba bảng này, nên không có nguy cơ ngừng nhận đơn.

## Ảnh hưởng chéo

- **Đợt soát cơ sở dữ liệu 6d** đang chạy song song và có thể đề xuất đổi `cash_entries` hoặc `asset_disposals`. Ghép vào sau, không chặn việc này.
- **Màn hình sửa một dòng sổ thu chi:** đã kiểm, không làm mất liên kết. Xem mục 3 ở "Sửa sau phản biện".
