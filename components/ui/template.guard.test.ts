import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-005 (owner 2026-10-07, spec docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md
// section 3): screens use the shared templates in components/ui instead of
// styling their own buttons, number boxes and tables. Each rule below keeps a
// list of the files still off-template. The list may only shrink: a new file
// that breaks a rule turns this red, and so does a fixed file left on the
// list. Waves K3-K6 move the screens and empty the lists.
//
// Scanned: .tsx under app/admin, app/settings and components, except
// components/ui (the templates themselves) and tests. The POS (app/pos), the
// login page and the error pages keep their own look and are not scanned.
// The number-format rule lives in lib/shared/format.guard.test.ts.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

// Comments are not screens: drop block comments and line comments (but not
// the "//" inside a URL string such as "https://").
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const root = process.cwd();
const files = ["app/admin", "app/settings", "components"]
  .flatMap(dir => sources(join(root, dir)))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: stripComments(readFileSync(f, "utf8")) }))
  .filter(f => !f.path.startsWith("components/ui/"));

function offenders(pattern: RegExp, skip: (match: string) => boolean = () => false): string[] {
  return files
    .filter(f => [...f.src.matchAll(new RegExp(pattern.source, "g"))].some(m => !skip(m[0])))
    .map(f => f.path)
    .sort();
}

// The text of every opening tag named `tag`, read to its real end: a ">" inside
// {...} (an arrow function "=>", a comparison) or inside a quoted attribute does
// not end the tag. A plain [^>]* stopped at the "=>" of onClick={() => ...} and
// missed the className after it (K2 review).
function openingTags(src: string, tag: string): string[] {
  const tags: string[] = [];
  const start = new RegExp(`<${tag}\\b`, "g");
  for (const m of src.matchAll(start)) {
    let depth = 0;
    let quote = "";
    let i = m.index! + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth === 0 && (c === '"' || c === "'")) quote = c;
      else if (depth === 0 && c === ">") break;
    }
    tags.push(src.slice(m.index!, i + 1));
  }
  return tags;
}

function tagOffenders(tagNames: string[], pattern: RegExp): string[] {
  return files
    .filter(f => tagNames.some(t => openingTags(f.src, t).some(text => pattern.test(text))))
    .map(f => f.path)
    .sort();
}

// Waves (spec section 4): K3 Kho, K4 Bán hàng, K5 Tài chính và báo cáo, K6 còn lại.

const NUMBER_TYPE_DEBT = [
  "app/admin/inventory/assets/components/DisposeAssetForm.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx", // K3
  "app/admin/inventory/stocktake/components/StocktakeClient.tsx", // K3
  "app/admin/orders/components/DiscountEditor.tsx", // K4
  "app/admin/orders/components/LineItemEditor.tsx", // K4
  "app/admin/products/components/ProductForm.tsx", // K4
  "app/admin/products/modifiers/components/ModifierForm.tsx", // K4
  "app/admin/promotions/components/PromotionForm.tsx", // K4
];

const SOLID_BUTTON_DEBT = [
  "app/admin/activity-log/components/ActivityLogClient.tsx", // K6
  "app/admin/brands/[id]/components/BrandDetailView.tsx", // K6
  "app/admin/brands/components/BrandsClient.tsx", // K6
  "app/admin/components/PosOutletPicker.tsx", // K6
  "app/admin/finance/[id]/components/CashEntryDetailView.tsx", // K5
  "app/admin/finance/bank-accounts/[id]/components/BankAccountDetailView.tsx", // K5
  "app/admin/finance/bank-accounts/components/BankAccountsClient.tsx", // K5
  "app/admin/finance/categories/[id]/components/CategoryDetailView.tsx", // K5
  "app/admin/finance/categories/components/CategoriesClient.tsx", // K5
  "app/admin/finance/page.tsx", // K5
  "app/admin/finance/transfers/[id]/components/CashTransferDetailView.tsx", // K5
  "app/admin/inventory/assets/[id]/components/AssetItemDetailView.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/cancel/components/CancelPurchaseOrderForm.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx", // K3
  "app/admin/layout.tsx", // K6
  "app/admin/orders/OrderTable.tsx", // K4
  "app/admin/orders/[id]/components/OrderDetailView.tsx", // K4
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx", // K4
  "app/admin/outlets/[id]/components/OutletDetailView.tsx", // K6
  "app/admin/outlets/components/OutletsClient.tsx", // K6
  "app/admin/products/ProductsClient.tsx", // K4
  "app/admin/products/[id]/components/ProductDetailView.tsx", // K4
  "app/admin/products/categories/[id]/components/ProductCategoryDetailView.tsx", // K4
  "app/admin/products/categories/components/CategoriesClient.tsx", // K4
  "app/admin/products/modifiers/[id]/components/ModifierDetailView.tsx", // K4
  "app/admin/products/modifiers/components/ModifiersClient.tsx", // K4
  "app/admin/promotions/[id]/components/PromotionDetailView.tsx", // K4
  "app/admin/promotions/components/PromotionsClient.tsx", // K4
  "app/admin/reports/components/SalesFilter.tsx", // K5
  "app/admin/reports/issued/page.tsx", // K5
  "app/admin/users/[id]/components/UserDetailView.tsx", // K6
  "app/admin/users/components/UsersClient.tsx", // K6
  "app/settings/password/page.tsx", // K6
];

const TABLE_DEBT = [
  "app/admin/inventory/assets/[id]/components/AssetItemDetailView.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/cancel/components/CancelPurchaseOrderForm.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/page.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx", // K3
  "app/admin/inventory/stocktake/components/StocktakeClient.tsx", // K3
  "app/admin/orders/OrderTable.tsx", // K4
  "app/admin/pos-sync/PosSyncClient.tsx", // K6
  "app/admin/products/[id]/components/ProductDetailView.tsx", // K4
  "app/admin/products/categories/[id]/components/ProductCategoryDetailView.tsx", // K4
  "app/admin/products/components/ToppingsManager.tsx", // K4
  "app/admin/promotions/[id]/components/PromotionDetailView.tsx", // K4
  "app/admin/reports/components/ProductTable.tsx", // K5
  "app/admin/reports/daily/page.tsx", // K5
  "app/admin/reports/pnl/components/PnlTableView.tsx", // K5
  "app/admin/reports/sales/OutletBreakdownSection.tsx", // K5
  "app/admin/reports/sales/page.tsx", // K5
];

const BOLD_CELL_DEBT = [
  "app/admin/inventory/assets/[id]/components/AssetItemDetailView.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/cancel/components/CancelPurchaseOrderForm.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/page.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx", // K3
  "app/admin/inventory/stocktake/components/StocktakeClient.tsx", // K3
  "app/admin/orders/OrderTable.tsx", // K4
  "app/admin/products/[id]/components/ProductDetailView.tsx", // K4
  "app/admin/products/categories/[id]/components/ProductCategoryDetailView.tsx", // K4
  "app/admin/products/components/ToppingsManager.tsx", // K4
  "app/admin/promotions/[id]/components/PromotionDetailView.tsx", // K4
  "app/admin/reports/components/ProductTable.tsx", // K5
  "app/admin/reports/daily/page.tsx", // K5
  "app/admin/reports/pnl/components/PnlTableView.tsx", // K5
  "app/admin/reports/sales/OutletBreakdownSection.tsx", // K5
  "app/admin/reports/sales/page.tsx", // K5
];

const ENGLISH_BRACKET_DEBT = [
  "app/admin/clear-cache/loading.tsx", // K6
  "app/admin/clear-cache/page.tsx", // K6
];

const RAW_INPUT_DEBT = [
  "app/admin/activity-log/components/ActivityLogClient.tsx", // K6
  "app/admin/brands/components/BrandForm.tsx", // K6
  "app/admin/brands/components/BrandsClient.tsx", // K6
  "app/admin/finance/bank-accounts/components/BankAccountForm.tsx", // K5
  "app/admin/finance/bank-accounts/components/BankAccountsClient.tsx", // K5
  "app/admin/finance/categories/components/CategoriesClient.tsx", // K5
  "app/admin/finance/categories/components/CategoryForm.tsx", // K5
  "app/admin/finance/components/CashEntryForm.tsx", // K5
  "app/admin/finance/transfers/components/CashTransferForm.tsx", // K5
  "app/admin/inventory/assets/components/AssetsClient.tsx", // K3
  "app/admin/inventory/assets/components/DisposeAssetForm.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx", // K3
  "app/admin/inventory/stocktake/components/StocktakeClient.tsx", // K3
  "app/admin/orders/OrderTable.tsx", // K4
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx", // K4
  "app/admin/orders/components/DiscountEditor.tsx", // K4
  "app/admin/orders/components/LineItemEditor.tsx", // K4
  "app/admin/outlets/components/OutletForm.tsx", // K6
  "app/admin/outlets/components/OutletsClient.tsx", // K6
  "app/admin/products/ProductsClient.tsx", // K4
  "app/admin/products/categories/components/CategoriesClient.tsx", // K4
  "app/admin/products/categories/components/ProductCategoryForm.tsx", // K4
  "app/admin/products/components/ProductForm.tsx", // K4
  "app/admin/products/modifiers/components/ModifierForm.tsx", // K4
  "app/admin/products/modifiers/components/ModifiersClient.tsx", // K4
  "app/admin/promotions/components/PromotionForm.tsx", // K4
  "app/admin/promotions/components/PromotionsClient.tsx", // K4
  "app/admin/users/components/EditUserForm.tsx", // K6
  "app/admin/users/components/UserForm.tsx", // K6
  "app/admin/users/components/UsersClient.tsx", // K6
  "app/settings/password/page.tsx", // K6
];

const RAW_SELECT_DEBT = [
  "app/admin/activity-log/components/ActivityLogClient.tsx", // K6
  "app/admin/finance/bank-accounts/components/BankAccountsClient.tsx", // K5
  "app/admin/finance/categories/components/CategoriesClient.tsx", // K5
  "app/admin/finance/categories/components/CategoryForm.tsx", // K5
  "app/admin/finance/components/CashBookClient.tsx", // K5
  "app/admin/finance/components/CashEntryForm.tsx", // K5
  "app/admin/finance/transfers/components/CashTransferForm.tsx", // K5
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/components/PurchasePaymentBlock.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx", // K3
  "app/admin/orders/OrderTable.tsx", // K4
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx", // K4
  "app/admin/outlets/components/OutletForm.tsx", // K6
  "app/admin/outlets/components/OutletsClient.tsx", // K6
  "app/admin/products/ProductsClient.tsx", // K4
  "app/admin/products/components/ProductForm.tsx", // K4
  "app/admin/products/modifiers/components/ModifierForm.tsx", // K4
  "app/admin/promotions/components/PromotionForm.tsx", // K4
  "app/admin/promotions/components/PromotionsClient.tsx", // K4
  "app/admin/reports/components/SalesFilter.tsx", // K5
  "app/admin/reports/pnl/components/YearSelect.tsx", // K5
  "app/admin/users/components/EditUserForm.tsx", // K6
  "app/admin/users/components/UserForm.tsx", // K6
  "app/admin/users/components/UsersClient.tsx", // K6
];

const NUMERIC_INPUTMODE_DEBT = [
  "app/admin/finance/bank-accounts/components/BankAccountForm.tsx", // K5
  "app/admin/inventory/assets/components/DisposeAssetForm.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx", // K3
  "app/admin/inventory/stocktake/components/StocktakeClient.tsx", // K3
  "app/admin/products/components/ProductForm.tsx", // K4
  "app/admin/products/modifiers/components/ModifierForm.tsx", // K4
  "app/admin/promotions/components/PromotionForm.tsx", // K4
];

const RAW_H1_DEBT = [
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx", // K3
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx", // K3
  "app/admin/inventory/purchase-orders/[id]/page.tsx", // K3
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx", // K3
  "app/admin/inventory/purchase-orders/new/page.tsx", // K3
  "app/admin/orders/[id]/components/OrderDetailView.tsx", // K4
  "app/admin/orders/[id]/edit/components/OrderEditForm.tsx", // K4
  "app/admin/page.tsx", // K5
  "app/admin/pos-sync/page.tsx", // K6
  "app/admin/reports/issued/page.tsx", // K5
  "app/admin/reports/pnl/page.tsx", // K5
  "app/settings/password/page.tsx", // K6
];

// Names and units that are fine in brackets: brand names and abbreviations
// the owner keeps (spec 2.6), and units of measure.
const BRACKET_ALLOWED = new Set(["Topping", "MR.PHIN", "PO", "ml", "g", "kg"]);

describe("BR-UI-005 screens use the shared templates (lists may only shrink)", () => {
  it('no number box is type="number": use NumberInput or MoneyInput', () => {
    expect(offenders(/type=["{]?["']?number/)).toEqual([...NUMBER_TYPE_DEBT].sort());
  });

  it("no screen paints its own solid brown or red button or link: use Button", () => {
    expect(tagOffenders(["button", "Link", "a"], /\bbg-(primary|danger)(?![-\w/])/)).toEqual(
      [...SOLID_BUTTON_DEBT].sort(),
    );
  });

  it("no screen draws its own <table>: use the Table set or DataList", () => {
    expect(offenders(/<table\b/)).toEqual([...TABLE_DEBT].sort());
  });

  it("no table cell is bold: every row cell has the same weight (BR-UI-003)", () => {
    expect(tagOffenders(["td"], /\bfont-(bold|semibold|medium)\b/)).toEqual([...BOLD_CELL_DEBT].sort());
  });

  // spec 2.3: text boxes, selects and date boxes come from components/ui.
  it("no screen styles its own text box: use TextInput, NumberInput, DayInput or SaigonDateTimeInput", () => {
    expect(
      tagOffenders(["input"], /^(?![\s\S]*\btype=["{]?["'`]?(hidden|checkbox|radio|file)\b)/),
    ).toEqual([...RAW_INPUT_DEBT].sort());
  });

  it("no screen styles its own select: use Select or SearchableSelect", () => {
    expect(offenders(/<select\b/)).toEqual([...RAW_SELECT_DEBT].sort());
  });

  // spec 2.2: one number box. A hand-filtered inputMode box is a number box built by hand.
  it("no screen builds its own number box with inputMode: use NumberInput or MoneyInput", () => {
    expect(offenders(/\binputMode=["{]?["'`]?(numeric|decimal)/)).toEqual([...NUMERIC_INPUTMODE_DEBT].sort());
  });

  // spec 2.6: page titles come from ListPageHeader, DetailHeader or PageHeader.
  it("no screen writes its own <h1>: use ListPageHeader, DetailHeader or PageHeader", () => {
    expect(offenders(/<h1\b/)).toEqual([...RAW_H1_DEBT].sort());
  });

  it("no label puts English in brackets after Vietnamese (BR-UI-001)", () => {
    const found = offenders(/[À-ỹ][^"'`<>{}\n]*\(\s*[A-Za-z][A-Za-z. ]*[A-Za-z]\s*\)/, match => {
      const inner = match.slice(match.lastIndexOf("(") + 1, -1).trim();
      return BRACKET_ALLOWED.has(inner);
    });
    expect(found).toEqual([...ENGLISH_BRACKET_DEBT].sort());
  });
});
