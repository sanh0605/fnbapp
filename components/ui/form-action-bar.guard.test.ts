import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-015 (chosen on the owner's 2026-10-15 delegation, spec
// docs/superpowers/specs/2026-10-15-khuon-chung-design.md section 2.1): every
// create and edit page ends its form with the shared FormActionBar. The form a
// page renders is the component it imports whose name ends in Form or Client.
// OWED lists the forms not moved yet; it may only shrink, each area empties
// its own share when it is audited.

const root = process.cwd();

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" && /[\\/](new|edit)$/.test(dir) ? [full] : [];
  });
}

const toRepoPath = (abs: string) => relative(root, abs).split(sep).join("/");

function formsOf(page: string): string[] {
  const src = readFileSync(page, "utf8");
  return [...src.matchAll(/import\s+(?:\{[^}]*\}|\w+)\s+from\s+"([^"]+)"/g)]
    .map(m => m[1])
    .filter(spec => /(Form|Client)$/.test(spec))
    .map(spec => (spec.startsWith("@/") ? join(root, spec.slice(2)) : join(dirname(page), spec)) + ".tsx")
    .filter(existsSync)
    .map(toRepoPath);
}

const forms = [...new Set(pages(join(root, "app", "admin")).flatMap(formsOf))].sort();
const usesBar = (path: string) => /from "@\/components\/ui\/FormActionBar"/.test(readFileSync(join(root, path), "utf8"));

const OWED = [
  "app/admin/brands/components/BrandForm.tsx",
  "app/admin/inventory/asset-bands/edit/components/EditBandsForm.tsx",
  "app/admin/inventory/components/CategoryForm.tsx",
  "app/admin/inventory/conversions/components/ConversionForm.tsx",
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx",
  "app/admin/inventory/items/components/PurchasedItemForm.tsx",
  "app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx",
  "app/admin/inventory/stocktake/[id]/edit/components/StocktakeEditForm.tsx",
  "app/admin/inventory/units/UnitForm.tsx",
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx",
  "app/admin/outlets/components/OutletForm.tsx",
  "app/admin/products/categories/components/ProductCategoryForm.tsx",
  "app/admin/products/modifier-groups/components/ModifierGroupForm.tsx",
  "app/admin/products/modifiers/components/ModifierForm.tsx",
  "app/admin/products/types/components/ProductTypeForm.tsx",
  "app/admin/promotions/components/PromotionForm.tsx",
  "app/admin/suppliers/components/SupplierForm.tsx",
  "app/admin/users/components/EditUserForm.tsx",
  "app/admin/users/components/UserForm.tsx",
];

describe("BR-UI-015 create and edit forms end with FormActionBar", () => {
  it("finds the forms behind the create and edit pages", () => {
    expect(forms.length).toBeGreaterThanOrEqual(25);
    expect(forms).toContain("app/admin/products/components/ProductForm.tsx");
  });

  it("every form not on the owed list uses FormActionBar", () => {
    expect(forms.filter(f => !OWED.includes(f) && !usesBar(f))).toEqual([]);
  });

  it("the owed list only names forms that still need moving", () => {
    expect(OWED.filter(f => !forms.includes(f) || usesBar(f))).toEqual([]);
  });
});
