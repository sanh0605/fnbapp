import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditActionExports } from "@/lib/admin-auth-guard-audit";

const adminReadsByFile: Record<string, string[]> = {
  "app/admin/brands/actions.ts": ["getBrands"],
  "app/admin/inventory/actions.ts": ["getRealtimeStock"],
  "app/admin/inventory/base-ingredients/actions.ts": ["getBaseIngredientsData"],
  "app/admin/inventory/conversions/actions.ts": ["getConversionsData"],
  "app/admin/inventory/items/actions.ts": ["getItemsData"],
  "app/admin/inventory/purchase-orders/actions.ts": ["getPurchaseOrdersData"],
  "app/admin/orders/actions.ts": ["getOrdersV2", "getOrderDetailV2"],
  "app/admin/production/actions.ts": ["getProductionData"],
  "app/admin/products/categories/actions.ts": ["getCategoriesWithCounts"],
  "app/admin/products/modifiers/actions.ts": ["getModifiersData"],
  "app/admin/promotions/actions.ts": ["getPromotionsData"],
  "app/admin/reports/actions.ts": [
    "getPnLDataV2",
    "getSalesDataV2",
    "getHourlyHeatmapV2",
    "getPromotionPerformanceV2",
  ],
  "app/admin/semi-products/actions.ts": ["getSemiProductsData"],
  "app/admin/suppliers/actions.ts": ["getSuppliers"],
  "app/admin/users/actions.ts": ["getUsers", "getUserById"],
};

describe("Gate 2 admin read guards", () => {
  it("requires an enforced ADMIN guard on every Wave 2 read action", () => {
    for (const [relativePath, actionNames] of Object.entries(adminReadsByFile)) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      const audits = new Map(auditActionExports(source).map((row) => [row.name, row]));

      for (const actionName of actionNames) {
        expect(audits.get(actionName), `${relativePath} :: ${actionName}`).toMatchObject({
          isMutation: false,
          guardKind: "ADMIN",
          guardEnforced: true,
        });
      }
    }
  });
});
