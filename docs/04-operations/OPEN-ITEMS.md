# Việc đang làm (sinh tự động từ it.todo — đừng sửa tay)

- Trang thanh lý ghi số tiền thu được (bỏ đi thì 0đ), tự ghi một dòng thu vào sổ thu chi nhóm "Thu thanh lý tài sản", lãi lỗ hiện dòng riêng (chủ quán chốt 08/10/2026) (app/admin/inventory/assets/components/DisposeAssetForm.test.tsx)
- Ô Nhóm tuỳ chọn lấy từ trang riêng Nhóm tuỳ chọn chủ quán tự thêm, sửa, ngừng và xếp thứ tự hiện trên máy bán (chủ quán chốt 14/10/2026) (app/admin/products/modifiers/components/ModifierForm.test.tsx)
- Giảm % cả đơn tính trên tổng sau giảm từng món, máy chủ ra đúng số máy bán hiện (chủ quán chốt 14/10/2026) (app/pos/actions.test.ts)
- Khuyến mãi giảm cả hoá đơn áp trước, giảm tay cả đơn áp sau, máy chủ ra đúng số máy bán hiện (chủ quán chốt 14/10/2026) (app/pos/actions.test.ts)
- Khuyến mãi không mã tự áp khi đủ điều kiện; hai khuyến mãi chỉ cộng khi cả hai đặt Dùng chung, không thì thu ngân chọn một; máy chủ không tự áp loại cần mã (chủ quán chốt 14/10/2026) (app/pos/actions.test.ts)
- Máy bán gửi tổng tiền đang hiện; máy chủ tính lại theo giá đang áp dụng lúc nhận đơn, lệch thì từ chối và báo tải lại trang (chủ quán chốt 14/10/2026) (app/pos/actions.test.ts)
