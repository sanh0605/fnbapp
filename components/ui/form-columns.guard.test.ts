import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-012 / BR-UI-014 (owner 2026-10-11, kept 2026-10-14 "Làm theo em
// khuyến nghị và tiếp tục"): a form now fills the 1,280 px frame, so its boxes
// go two to a row on a computer instead of one box stretched across the page.
// A phone keeps one box per row. Labels follow BR-UI-013: a capital only on
// the first word, the red star comes from Field's `required`, not the text.

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

// The className of the element carrying a given data-testid.
function classOf(source: string, testId: string): string | null {
  const m = source.match(new RegExp(`data-testid="${testId}"[^>]*?className="([^"]+)"`))
    ?? source.match(new RegExp(`className="([^"]+)"[^>]*?data-testid="${testId}"`));
  return m ? m[1] : null;
}

const SHORT_FORMS = [
  "app/admin/brands/components/BrandForm.tsx",
  "app/admin/finance/bank-accounts/components/BankAccountForm.tsx",
  "app/admin/finance/categories/components/CategoryForm.tsx",
  "app/admin/finance/components/CashEntryForm.tsx",
  "app/admin/finance/transfers/components/CashTransferForm.tsx",
  "app/admin/products/categories/components/ProductCategoryForm.tsx",
  "app/admin/products/modifiers/components/ModifierForm.tsx",
  "app/admin/users/components/EditUserForm.tsx",
  "app/admin/users/components/UserForm.tsx",
  "app/admin/promotions/components/PromotionForm.tsx",
];

describe("short forms put two boxes to a row on a computer", () => {
  it.each(SHORT_FORMS)("%s", path => {
    const cls = classOf(read(path), "form-fields");
    expect(cls, "no data-testid=\"form-fields\" grid").not.toBeNull();
    expect(cls).toContain("grid-cols-1");
    expect(cls).toContain("md:grid-cols-2");
  });
});

describe("Tạo món / Sửa món: basic info and sizes side by side on a computer", () => {
  it("the two blocks sit in a two-column grid that stacks on a phone", () => {
    const cls = classOf(read("app/admin/products/components/ProductForm.tsx"), "form-layout");
    expect(cls).not.toBeNull();
    expect(cls).toContain("grid-cols-1");
    expect(cls).toContain("lg:grid-cols-2");
  });
});

// Words that are names and keep their capital.
const NAMES = new Set(["Topping", "Voucher"]);

describe("BR-UI-013 labels: a capital only on the first word", () => {
  const files = [...SHORT_FORMS, "app/admin/products/components/ProductForm.tsx"];
  const labels = files.flatMap(path =>
    Array.from(read(path).matchAll(/\blabel="([^"]+)"/g), m => ({ path, label: m[1] })),
  );

  it("finds the labels", () => {
    expect(labels.length).toBeGreaterThan(30);
  });

  it("no label capitalises a later word, carries its own star or says (Tuỳ chọn)", () => {
    const bad = labels.filter(({ label }) => {
      const later = label.split(/[\s/()]+/).filter(Boolean).slice(1);
      const capital = later.some(w => /^\p{Lu}/u.test(w) && !NAMES.has(w));
      return capital || /\*\s*$/.test(label) || /tu[ỳỳ] chọn\)/i.test(label);
    });
    expect(bad).toEqual([]);
  });

  it("button texts in Tạo món say size in lower case", () => {
    const source = read("app/admin/products/components/ProductForm.tsx");
    expect(source).not.toMatch(/Thêm Size|Xoá Size/);
  });
});

describe("Hàng đã xuất: a table on a computer, cards on a phone", () => {
  const source = read("app/admin/reports/issued/page.tsx");

  it("uses the shared table", () => {
    expect(source).toContain('from "@/components/ui/Table"');
  });

  it("keeps the cards for a phone only", () => {
    expect(source).toMatch(/md:hidden/);
    expect(source).toMatch(/hidden md:block/);
  });
});
