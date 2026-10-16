import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-018 (chosen on the owner's 2026-10-16 delegation, spec
// docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md section 3.1):
// phone lists draw PhoneRow through DataList's phoneRow prop. OWED_CARDS lists
// screens still on renderCard; it may only shrink.

const root = process.cwd();
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}
const files = sources(join(root, "app", "admin"))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: readFileSync(f, "utf8") }))
  .filter(f => /<DataList\b/.test(f.src));

const OWED_CARDS: string[] = [
  "app/admin/brands/components/BrandsClient.tsx",
  "app/admin/finance/bank-accounts/components/BankAccountsClient.tsx",
  "app/admin/finance/categories/components/CategoriesClient.tsx",
  "app/admin/finance/components/CashBookClient.tsx",
  "app/admin/finance/monthly-items/components/MonthlyItemsClient.tsx",
  "app/admin/inventory/asset-bands/components/BandsClient.tsx",
  "app/admin/inventory/assets/components/AssetsClient.tsx",
  "app/admin/inventory/categories/components/CategoriesClient.tsx",
  "app/admin/inventory/conversions/components/ConversionsClient.tsx",
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx",
  "app/admin/inventory/items/components/ItemsClient.tsx",
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx",
  "app/admin/inventory/stock/components/StockOnHandClient.tsx",
  "app/admin/inventory/stocktake/components/StocktakeList.tsx",
  "app/admin/inventory/units/components/UnitsClient.tsx",
  "app/admin/orders/OrderTable.tsx",
  "app/admin/outlets/components/OutletsClient.tsx",
  "app/admin/products/ProductsClient.tsx",
  "app/admin/products/categories/components/CategoriesClient.tsx",
  "app/admin/products/modifier-groups/components/ModifierGroupsClient.tsx",
  "app/admin/products/modifiers/components/ModifiersClient.tsx",
  "app/admin/products/types/components/ProductTypesClient.tsx",
  "app/admin/promotions/components/PromotionsClient.tsx",
  "app/admin/suppliers/components/SuppliersClient.tsx",
  "app/admin/users/components/UsersClient.tsx",
];

describe("BR-UI-018 phone lists use PhoneRow", () => {
  it("finds the list screens", () => expect(files.length).toBeGreaterThanOrEqual(25));
  it("every list passes phoneRow or is still owed", () => {
    const off = files.filter(f => !/phoneRow=/.test(f.src) && !OWED_CARDS.includes(f.path)).map(f => f.path);
    expect(off).toEqual([]);
  });
  it("owed entries still use renderCard (the list only shrinks)", () => {
    const paid = OWED_CARDS.filter(p => !files.find(f => f.path === p && /renderCard=/.test(f.src)));
    expect(paid).toEqual([]);
  });
});
