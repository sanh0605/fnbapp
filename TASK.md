# Phin Đi - Business Growth Roadmap (Task List)
# Last Updated: 2026-04-29

## PHASE 1: THE FOUNDATION (Setup)
*Goal: Create the structure without touching the live shop.*
- [ ] **1.1 Site Setup:** Create `/v2` folder and install Next.js 14+.
- [ ] **1.2 Design Setup:** Install Tailwind CSS and shadcn/ui components.
- [ ] **1.3 Ledger Connection:** Configure Supabase environment variables.
- [ ] **1.4 Login Gate:** Create `v2/login` page with Vietnamese labels (Số điện thoại/Mật khẩu).
- [ ] **1.5 Role Verification:** Build the logic that checks if a user is Staff or Owner.

## PHASE 2: THE STANDARD MANUAL (Logic)
*Goal: Centralize all math to prevent errors.*
- [ ] **2.1 Price Logic:** Write the code to calculate Item Price + Toppings.
- [ ] **2.2 Discount Logic:** Write rules for % discounts and fixed VND discounts.
- [ ] **2.3 Data Match Test:** Run 100 historical orders through the new manual to ensure totals are identical.
- [x] **2.1 Price Logic:** Write the code to calculate Item Price + Toppings.
- [x] **2.2 Discount Logic:** Write rules for % discounts and fixed VND discounts.
- [x] **2.3 Data Match Test:** Run 100 historical orders through the new manual to ensure totals are identical.

## PHASE 3: THE DIGITAL LOGBOOK (Owner Dashboard)
*Goal: Give you clear visibility of the business.*
- [x] **3.1 Daily Stats:** Build cards for "Doanh thu," "Số đơn," and "Số ly."
- [x] **3.2 Best-Sellers:** Build a bar chart for "Món bán chạy nhất."
- [x] **3.3 Rush Hour:** Build a line chart showing busy times (6am - 10am).
- [x] **1. POS Brand Selection**
  - [x] Update `AdminLayout.tsx` to include a Brand selection popup when clicking "Mở máy POS".
  - [x] Pass `brandId` to the POS route (e.g. `?brandId=BR-001`).
  - [x] Update `POSScreen.tsx` to accept `brandId` and pass it to `submitOrder`.
- [x] **1. Nâng cấp hàm getPnLData (Server Action)**
  - [x] Thêm tham số `filters` (startDate, endDate, brandId, staffName, categoryId).
  - [x] Lọc danh sách `completedOrders` theo bộ lọc.
  - [x] Lọc danh sách `consumes` (Sales_Consume) theo các order thoả mãn.
  - [x] Đọc `Order_Lines` của các order hợp lệ.
  - [x] Tính Unit COGS (Giá vốn đơn vị) cho từng Variant và Modifier bằng cách quy ngược Công thức (Recipes) ra Giá bình quân (MAC).
  - [x] Tính Doanh thu, Tổng Giá Vốn, Lợi nhuận gộp, Margin cho từng sản phẩm bán ra.
- [x] **2. Nâng cấp Giao diện P&L (`app/admin/reports/pnl/page.tsx`)**
  - [x] Đọc `searchParams` từ URL.
  - [x] Tái sử dụng `SalesFilter` để cho phép chọn ngày, thương hiệu, nhân viên, nhóm sản phẩm.
  - [x] Hiển thị Bảng phân tích lợi nhuận từng món (Tên món, Số lượng, Doanh thu, COGS, Lợi nhuận gộp, % Margin).
  - [x] Bảng cần sắp xếp giảm dần theo Lợi Nhuận Gộp.
- [x] **1. Cập nhật POS Server Action**
  - [x] Sử dụng `getServerSession` trong `submitOrder` (file `app/actions/pos.ts`) để lấy tên user hiện tại.
  - [x] Ghi đè trường `staff_name` vào bảng `Orders`.
- [x] **2. Cập nhật Dữ liệu Đơn cũ (Data Backfill)**
  - [x] Chạy script Node.js để cập nhật tất cả các đơn cũ bị trống trường `staff_name` thành "Tài Chí Tuyền".
- [x] **3. Nâng cấp Sales Filter UI (`components/SalesFilter.tsx`)**
  - [x] Nhận props `brands`, `users`, `categories`.
  - [x] Thêm 3 Dropdown (Select) cho Thương hiệu, Nhân viên, Nhóm sản phẩm.
  - [x] Truyền các giá trị này vào URL `searchParams`.
- [x] **4. Nâng cấp Báo cáo Bán hàng (`app/admin/reports/sales/page.tsx`)**
  - [x] Fetch thêm `Brands`, `Users`, `Product_Categories`.
  - [x] Đọc các biến lọc từ URL (`brandId`, `staffName`, `categoryId`).
  - [x] Cập nhật mảng lọc `completedOrders` (Lọc theo Brand, Staff).
  - [x] Cập nhật mảng lọc `orderLines` (Lọc theo Category).
  - [x] Tính toán tỷ trọng doanh thu theo Nhóm sản phẩm (Category).
- [x] **5. Nâng cấp Sales Charts (`components/SalesCharts.tsx`)**
  - [x] Nhận thêm data `salesByCategory`.
  - [x] Vẽ thêm một biểu đồ (Pie hoặc Bar nằm ngang) thể hiện doanh thu theo nhóm sản phẩm.
- [x] **2. Hệ thống Cơ sở dữ liệu Cân Bằng Kho**
  - [x] Tạo bảng mới `Stock_Adjustments` trên Google Sheets để lưu trữ các yêu cầu cân bằng kho.
  - [x] Viết Server Actions (`app/actions/inventory.ts` hoặc tạo `stock.ts`) để tính tồn kho lý thuyết (Group by `item_reference` từ `Stock_Ledger`).
- [x] **3. Giao diện Tồn Kho (`app/admin/inventory/stock`)**
  - [x] Tạo route `/admin/inventory/stock/page.tsx`.
  - [x] Liệt kê danh sách Nguyên liệu và Bán thành phẩm kèm **Tồn kho hiện tại** (Real-time).
  - [x] Nút "Cân bằng kho" mở ra Modal nhập số lượng thực tế đếm được trong kho.
- [x] **4. Quy trình Duyệt Cân Bằng Kho (Approval Workflow)**
  - [x] Lấy Session Role của người dùng hiện tại (Admin / Manager).
  - [x] Nếu là Manager -> Tạo yêu cầu trạng thái `PENDING`.
  - [x] Nếu là Admin -> Cho phép trực tiếp duyệt thành `APPROVED` và tự động sinh ra transaction bù trừ trong `Stock_Ledger`.
  - [x] Hiển thị danh sách các phiếu điều chỉnh chờ duyệt ở đầu trang Tồn kho.
- [x] **3. Accurate COGS for Semi-Products**
  - [x] Update `app/actions/reports.ts` `getPnLData`.
  - [x] Iterate through `Semi_Products` and `Recipes`.
  - [x] Compute MAC for Semi-Products based on ingredient MACs and `batch_yield`.
  - [x] Merge Semi-Product MACs into `macMap` so `SALES_CONSUME` uses them for COGS calculation.
- [x] **4. Verification**
  - [x] Test creating an order and check if the order number is `PHDxxxxxx`.
  - [x] Check the Reports page to verify COGS calculation includes "Cốt cà phê".

## PHASE 4: THE SALES COUNTER (Modern POS)
*Goal: Speed and reliability for staff.*
- [x] **4.1 Category Menu:** Buttons for "Cà phê," "Trà," "Topping."
- [x] **4.2 Responsive Cart:** Layout that works on both vertical and horizontal screens.
- [x] **4.3 Offline Storage:** Code to save orders to the phone memory.
- [x] **4.4 Auto-Sync:** Code to send orders to the ledger once internet returns.

## PHASE 5: THE GRAND OPENING (Delivery)
*Goal: Safe transition.*
- [x] **5.1 Staff Training:** Verify staff can use the new UI.
- [x] **5.2 Financial Audit:** Final check that V1 and V2 totals match.
- [x] **5.3 Domain Swap:** Point the main URL to the new `/v2` building.
