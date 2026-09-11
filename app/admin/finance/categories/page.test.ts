import { beforeEach, describe, expect, it, vi } from "vitest";

// I3 -- the category's Thu/Chi side locks once any Cash_Entries row
// references it, cancelled rows included (still history). hasEntries is
// computed here, server-side, and threaded down to CategoryForm; the real
// guard is the server-side check in updateCashCategory.
const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  getCashCategories: vi.fn(),
  resolveActor: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
}));
vi.mock("./actions", () => ({
  getCashCategories: mocks.getCashCategories,
}));
vi.mock("@/lib/auth/auth", () => ({
  resolveActor: mocks.resolveActor,
}));
vi.mock("./components/CategoriesList", () => ({
  CategoriesList: (props: any) => ({ type: "CategoriesList", props }),
}));
vi.mock("./components/CategoryForm", () => ({
  CategoryForm: (props: any) => ({ type: "CategoryForm", props }),
}));

import CashCategoriesPage from "./page";

describe("CashCategoriesPage computes usedCategoryIds from every Cash_Entries row (I3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCashCategories.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
      { id: "CFC-002", name: "Marketing", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
    ]);
    mocks.resolveActor.mockResolvedValue({ ok: true, actor: { id: "u1", name: "Chủ quán", role: "ADMIN" } });
  });

  it("includes a category referenced only by a cancelled entry", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "CE-001", category_id: "CFC-001", status: "CANCELLED" },
    ]);

    const element: any = await CashCategoriesPage();
    const listProps = element.props.children[1].props;

    expect(listProps.usedCategoryIds).toContain("CFC-001");
    expect(listProps.usedCategoryIds).not.toContain("CFC-002");
  });

  it("is empty when no entry references any category", async () => {
    mocks.findAll.mockResolvedValue([]);

    const element: any = await CashCategoriesPage();
    const listProps = element.props.children[1].props;

    expect(listProps.usedCategoryIds).toEqual([]);
  });
});
