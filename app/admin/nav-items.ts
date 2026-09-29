import {
  LayoutDashboard, ShoppingBag, Truck, Package, Wallet, TrendingUp, Settings, type LucideIcon,
} from "lucide-react";

// The admin menu, owner decision 2026-09-28 (spec
// docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md section 2).
// Read by the desktop sidebar, the phone bar and "Thêm" sheet in
// app/admin/layout.tsx, and by app/admin/nav-guard.test.ts -- keep every
// href a plain double-quoted "/admin..." literal, the guard reads this file
// as text.
export interface NavLink { name: string; href: string }
export interface NavGroup { name: string; icon: LucideIcon; href?: string; children?: NavLink[] }

export const NAV_GROUPS: NavGroup[] = [
  { name: "Tổng quan", icon: LayoutDashboard, href: "/admin" },
  {
    name: "Bán hàng", icon: ShoppingBag, children: [
      { name: "Đơn hàng", href: "/admin/orders" },
      { name: "Món", href: "/admin/products" },
      { name: "Nhóm món", href: "/admin/products/categories" },
      { name: "Topping & tuỳ chọn", href: "/admin/products/modifiers" },
      { name: "Khuyến mãi", href: "/admin/promotions" },
      { name: "Thương hiệu", href: "/admin/brands" },
      { name: "Điểm bán", href: "/admin/outlets" },
    ],
  },
  {
    name: "Nhập hàng", icon: Truck, children: [
      { name: "Phiếu nhập", href: "/admin/inventory/purchase-orders" },
      { name: "Nhà cung cấp", href: "/admin/suppliers" },
    ],
  },
  {
    name: "Kho", icon: Package, children: [
      { name: "Phiếu xuất", href: "/admin/inventory/issue-slips" },
      { name: "Kiểm kê", href: "/admin/inventory/stocktake" },
      { name: "Hàng hoá", href: "/admin/inventory/items" },
      { name: "Tài sản", href: "/admin/inventory/assets" },
      { name: "Thời hạn khấu hao", href: "/admin/inventory/asset-bands" },
      { name: "Đơn vị tính", href: "/admin/inventory/units" },
      { name: "Phân loại hàng", href: "/admin/inventory/categories" },
    ],
  },
  {
    name: "Thu chi", icon: Wallet, children: [
      { name: "Sổ thu chi", href: "/admin/finance" },
      { name: "Nhóm thu chi", href: "/admin/finance/categories" },
      { name: "Tài khoản ngân hàng", href: "/admin/finance/bank-accounts" },
    ],
  },
  {
    name: "Báo cáo", icon: TrendingUp, children: [
      { name: "Tổng kết ngày", href: "/admin/reports/daily" },
      { name: "Doanh số", href: "/admin/reports/sales" },
      { name: "Hàng đã xuất", href: "/admin/reports/issued" },
      { name: "Lãi lỗ", href: "/admin/reports/pnl" },
    ],
  },
  {
    name: "Cài đặt", icon: Settings, children: [
      { name: "Nhân viên & quyền", href: "/admin/users" },
      { name: "Nhật ký hoạt động", href: "/admin/activity-log" },
    ],
  },
];

export const PHONE_BAR_HREFS: readonly string[] = [
  "/admin",
  "/admin/inventory/purchase-orders",
  "/admin/inventory/issue-slips",
];
