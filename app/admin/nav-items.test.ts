import { describe, expect, it } from "vitest";
import { NAV_GROUPS, PHONE_BAR_HREFS } from "./nav-items";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 2 (owner, 2026-09-28).
const EXPECTED: [string, [string, string][]][] = [
  ["Tổng quan", []],
  ["Bán hàng", [
    ["Đơn hàng", "/admin/orders"], ["Món", "/admin/products"], ["Nhóm món", "/admin/products/categories"],
    ["Topping & tuỳ chọn", "/admin/products/modifiers"], ["Khuyến mãi", "/admin/promotions"],
    ["Thương hiệu", "/admin/brands"], ["Điểm bán", "/admin/outlets"],
  ]],
  ["Nhập hàng", [["Phiếu nhập", "/admin/inventory/purchase-orders"], ["Nhà cung cấp", "/admin/suppliers"]]],
  ["Kho", [
    ["Phiếu xuất", "/admin/inventory/issue-slips"], ["Kiểm kê", "/admin/inventory/stocktake"],
    ["Hàng hoá", "/admin/inventory/items"], ["Tài sản", "/admin/inventory/assets"],
    ["Thời hạn khấu hao", "/admin/inventory/asset-bands"], ["Đơn vị tính", "/admin/inventory/units"],
    ["Phân loại hàng", "/admin/inventory/categories"],
  ]],
  ["Thu chi", [["Sổ thu chi", "/admin/finance"], ["Nhóm thu chi", "/admin/finance/categories"], ["Tài khoản ngân hàng", "/admin/finance/bank-accounts"]]],
  ["Báo cáo", [
    ["Tổng kết ngày", "/admin/reports/daily"], ["Doanh số", "/admin/reports/sales"],
    ["Hàng đã xuất", "/admin/reports/issued"], ["Lãi lỗ", "/admin/reports/pnl"],
  ]],
  ["Cài đặt", [["Nhân viên & quyền", "/admin/users"], ["Nhật ký hoạt động", "/admin/activity-log"]]],
];

describe("admin menu (7 groups)", () => {
  it("has exactly the settled groups, items, names and order", () => {
    const actual = NAV_GROUPS.map(g => [g.name, (g.children ?? []).map(c => [c.name, c.href])]);
    expect(actual).toEqual(EXPECTED);
  });
  it("Tổng quan is a direct link to /admin", () => {
    expect(NAV_GROUPS[0].href).toBe("/admin");
  });
  it("the phone bar links Tổng quan, Phiếu nhập, Phiếu xuất in that order", () => {
    expect(PHONE_BAR_HREFS).toEqual(["/admin", "/admin/inventory/purchase-orders", "/admin/inventory/issue-slips"]);
  });
});
