// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@/node_modules/@testing-library/react";
import React from "react";
import ActivityLogLoading from "@/app/admin/activity-log/loading";
import BrandsLoading from "@/app/admin/brands/loading";
import InventoryCategoriesLoading from "@/app/admin/inventory/categories/loading";
import InventoryConversionsLoading from "@/app/admin/inventory/conversions/loading";
import InventoryIssueSlipsLoading from "@/app/admin/inventory/issue-slips/loading";
import InventoryItemsLoading from "@/app/admin/inventory/items/loading";
import InventoryPurchaseOrdersLoading from "@/app/admin/inventory/purchase-orders/loading";
import InventoryUnitsLoading from "@/app/admin/inventory/units/loading";
import OrdersLoading from "@/app/admin/orders/loading";
import ProductsCategoriesLoading from "@/app/admin/products/categories/loading";
import ProductsLoading from "@/app/admin/products/loading";
import ProductsModifierGroupsLoading from "@/app/admin/products/modifier-groups/loading";
import ProductsModifiersLoading from "@/app/admin/products/modifiers/loading";
import ProductsTypesLoading from "@/app/admin/products/types/loading";
import PromotionsLoading from "@/app/admin/promotions/loading";
import SuppliersLoading from "@/app/admin/suppliers/loading";
import UsersLoading from "@/app/admin/users/loading";

afterEach(cleanup);

const cases = [
  { name: "activity-log", Component: ActivityLogLoading, group: "Cài đặt", title: "Nhật ký hoạt động" },
  { name: "brands", Component: BrandsLoading, group: "Bán hàng", title: "Thương hiệu" },
  { name: "inventory/categories", Component: InventoryCategoriesLoading, group: "Kho", title: "Phân loại hàng" },
  { name: "inventory/conversions", Component: InventoryConversionsLoading, group: "Kho", title: "Bảng quy đổi" },
  { name: "inventory/issue-slips", Component: InventoryIssueSlipsLoading, group: "Kho", title: "Phiếu xuất" },
  { name: "inventory/items", Component: InventoryItemsLoading, group: "Kho", title: "Hàng hoá" },
  { name: "inventory/purchase-orders", Component: InventoryPurchaseOrdersLoading, group: "Nhập hàng", title: "Phiếu nhập" },
  { name: "inventory/units", Component: InventoryUnitsLoading, group: "Kho", title: "Đơn vị tính" },
  { name: "orders", Component: OrdersLoading, group: "Bán hàng", title: "Đơn hàng" },
  { name: "products/categories", Component: ProductsCategoriesLoading, group: "Bán hàng", title: "Nhóm món" },
  { name: "products", Component: ProductsLoading, group: "Bán hàng", title: "Món" },
  { name: "products/modifier-groups", Component: ProductsModifierGroupsLoading, group: "Bán hàng", title: "Nhóm tuỳ chọn" },
  { name: "products/modifiers", Component: ProductsModifiersLoading, group: "Bán hàng", title: "Topping & tuỳ chọn" },
  { name: "products/types", Component: ProductsTypesLoading, group: "Bán hàng", title: "Loại món" },
  { name: "promotions", Component: PromotionsLoading, group: "Bán hàng", title: "Khuyến mãi" },
  { name: "suppliers", Component: SuppliersLoading, group: "Nhập hàng", title: "Nhà cung cấp" },
  { name: "users", Component: UsersLoading, group: "Cài đặt", title: "Nhân viên & quyền" },
];

describe("loading headers match list page headers", () => {
  it.each(cases)(
    "renders $group / $title for $name loading screen with no subtitle",
    ({ Component, group, title }) => {
      render(<Component />);
      // The group label sits above the title, as on the list page (not a subtitle under it).
      const heading = screen.getByRole("heading", { level: 1, name: title });
      expect(heading.previousElementSibling?.textContent).toBe(group);
      expect(heading.nextElementSibling).toBeNull(); // no subtitle under the title
    }
  );
});
