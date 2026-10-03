import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 2026-10-02-khuon-danh-sach-chi-tiet-design.md (owner 2026-10-02):
// a record is edited only from its own detail page. So outside a detail
// folder ([id]), no admin screen may link straight to an edit page.
//
// PENDING lists the screens not yet moved to the list/detail template.
// Each wave removes its screens; a file that no longer links to an edit
// page but is still listed also turns this red, so the list cannot rot.
const PENDING: string[] = [
  "app/admin/brands/page.tsx",
  "app/admin/finance/bank-accounts/components/BankAccountsList.tsx",
  "app/admin/finance/categories/components/CategoriesList.tsx",
  "app/admin/finance/components/CashEntriesList.tsx",
  "app/admin/outlets/components/OutletsList.tsx",
  
  
  
  "app/admin/promotions/components/PromotionsClient.tsx",
  "app/admin/users/components/UsersClient.tsx",
];

const EDIT_LINK = /\/edit[?`"'/]/;

function adminSources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return adminSources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

const root = process.cwd();
const files = adminSources(join(root, "app", "admin")).map(f => ({
  path: relative(root, f).split(sep).join("/"),
  src: readFileSync(f, "utf8"),
}));

describe("list/detail template: edit only from the detail page", () => {
  it("only screens still waiting for their wave link straight to an edit page (chủ quán chốt 02/10/2026)", () => {
    const linking = files
      .filter(f => !f.path.includes("/[id]/") && EDIT_LINK.test(f.src))
      .map(f => f.path)
      .sort();
    expect(linking).toEqual([...PENDING].sort());
  });
});
