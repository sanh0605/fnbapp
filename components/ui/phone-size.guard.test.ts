import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-014 (chosen on the owner's 2026-10-16 delegation, spec
// docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md): on a phone a
// box or button is 48 px, label 14 px, hint and error 13 px, nothing under
// 12 px outside app/pos/. OWED_44 and OWED_TINY list files not moved yet; they
// may only shrink.

const root = process.cwd();
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "pos" ? [] : sources(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}
// Drawn only by the till (app/pos/components/ItemConfigModal.tsx), which keeps its own look (BR-UI-005).
const TILL_ONLY = ["components/ui/OptionGroupPicker.tsx"];
const files = ["app", "components"]
  .flatMap(d => sources(join(root, d)))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: readFileSync(f, "utf8") }))
  .filter(f => !TILL_ONLY.includes(f.path));
const read = (path: string) => readFileSync(join(root, path), "utf8");

const OLD_44 = "min-h-[44px]";
const NEW_48 = "min-h-[48px] md:min-h-[40px]";
const TINY = /text-\[(?:[1-9]|1[01])(?:\.\d+)?px\]/;

const OWED_44: string[] = [
  "app/admin/brands/components/BrandForm.tsx",
  "app/admin/dashboard-settings/components/DashboardSettingsForm.tsx",
  "app/admin/inventory/assets/[id]/components/AssetItemDetailView.tsx",
  "app/admin/inventory/assets/components/DisposeAssetForm.tsx",
  "app/admin/inventory/conversions/components/ConversionForm.tsx",
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx",
  "app/admin/inventory/items/[id]/components/ItemDetailView.tsx",
  "app/admin/inventory/items/components/PurchasedItemForm.tsx",
  "app/admin/inventory/purchase-orders/[id]/cancel/page.tsx",
  "app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx",
  "app/admin/inventory/purchase-orders/components/PurchaseOrderLines.tsx",
  "app/admin/inventory/purchase-orders/components/PurchaseOrderTotals.tsx",
  "app/admin/inventory/stocktake/[id]/components/StocktakeCountView.tsx",
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx",
  "app/admin/orders/[id]/void/components/VoidOrderForm.tsx",
  "app/admin/outlets/components/OutletForm.tsx",
  "app/admin/products/ProductsClient.tsx",
  "app/admin/products/categories/[id]/components/ProductCategoryDetailView.tsx",
  "app/admin/products/components/ProductForm.tsx",
  "app/admin/products/modifier-groups/components/ModifierGroupForm.tsx",
  "app/admin/products/modifiers/components/ModifierForm.tsx",
  "app/admin/products/types/components/ProductTypeForm.tsx",
  "app/admin/promotions/components/PromotionsClient.tsx",
  "app/admin/reports/pnl/components/PnlMonthCards.tsx",
  "app/admin/reports/sales/page.tsx",
  "app/admin/suppliers/[id]/components/SupplierDetailView.tsx",
  "app/error.tsx",
  "app/global-error.tsx",
];

const OWED_TINY: string[] = [
  "app/admin/activity-log/components/ActivityLogClient.tsx",
  "app/admin/brands/components/BrandsClient.tsx",
  "app/admin/finance/bank-accounts/components/BankAccountsClient.tsx",
  "app/admin/finance/categories/components/CategoriesClient.tsx",
  "app/admin/finance/monthly-items/components/MonthlyItemsClient.tsx",
  "app/admin/inventory/categories/components/CategoriesClient.tsx",
  "app/admin/inventory/conversions/components/ConversionForm.tsx",
  "app/admin/inventory/items/components/ItemsClient.tsx",
  "app/admin/orders/OrderTable.tsx",
  "app/admin/orders/[id]/components/OrderDetailView.tsx",
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx",
  "app/admin/outlets/components/OutletsClient.tsx",
  "app/admin/products/ProductsClient.tsx",
  "app/admin/products/modifier-groups/[id]/components/ModifierGroupDetailView.tsx",
  "app/admin/products/modifiers/components/ModifiersClient.tsx",
  "app/admin/promotions/components/PromotionForm.tsx",
  "app/admin/promotions/components/PromotionsClient.tsx",
  "app/admin/reports/components/SalesCharts.tsx",
  "app/admin/reports/issued/EventCard.tsx",
  "app/admin/reports/issued/page.tsx",
  "app/admin/reports/pnl/components/pnl-display.tsx",
  "app/admin/reports/pnl/components/PnlMonthCards.tsx",
  "app/admin/reports/pnl/components/PnlTableView.tsx",
  "app/admin/reports/sales/page.tsx",
  "app/admin/users/components/RoleBadge.tsx",
  "app/admin/users/components/UsersClient.tsx",
];

describe("BR-UI-014 phone control size", () => {
  it("the five shared controls are 48 px on a phone", () => {
    const off = ["Button", "TextInput", "Select", "NumberInput", "SearchableSelect"]
      .map(n => `components/ui/${n}.tsx`)
      .filter(p => !read(p).includes(NEW_48));
    // SearchableSelect needs the class on the trigger and on each option
    if (read("components/ui/SearchableSelect.tsx").split(NEW_48).length < 3) off.push("SearchableSelect needs 2");
    expect(off).toEqual([]);
  });

  it("Field label is text-sm, hint and error are text-[13px]", () => {
    const src = read("components/ui/Field.tsx");
    expect(src).toMatch(/<label[^>]*\btext-sm\b/);
    expect(src.match(/<p[^>]*\btext-\[13px\]/g) ?? []).toHaveLength(2);
  });

  it("no file outside OWED_44 keeps the 44 px box", () => {
    expect(files.filter(f => f.src.includes(OLD_44) && !OWED_44.includes(f.path)).map(f => f.path)).toEqual([]);
  });
  it("OWED_44 files still hold the 44 px box (the list only shrinks)", () => {
    expect(OWED_44.filter(p => !read(p).includes(OLD_44))).toEqual([]);
  });

  it("no file outside OWED_TINY has text under 12 px", () => {
    expect(files.filter(f => TINY.test(f.src) && !OWED_TINY.includes(f.path)).map(f => f.path)).toEqual([]);
  });
  it("OWED_TINY files still hold tiny text (the list only shrinks)", () => {
    expect(OWED_TINY.filter(p => !TINY.test(read(p)))).toEqual([]);
  });
});
