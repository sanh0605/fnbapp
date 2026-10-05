import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductCategoryDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockCategories } = vi.hoisted(() => ({
  mockCategories: [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE" },
  { id: "CAT-002", name: "Trà sữa", status: "ACTIVE" },
],
}));

const mockProducts = [
  { id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001", status: "ACTIVE" },
  { id: "PROD-002", name: "Cà phê sữa", category_id: "CAT-001", status: "DELETED" },
  { id: "PROD-003", name: "Trà đào", category_id: "CAT-002", status: "ACTIVE" },
];

vi.mock("@/app/admin/products/categories/actions", () => ({
  getCategoriesWithCounts: vi.fn().mockResolvedValue({
    categories: mockCategories,
    counts: { "CAT-001": 1, "CAT-002": 1 },
  }),
  deleteCategory: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockImplementation((table: string) => {
    if (table === "Products") return Promise.resolve(mockProducts);
    return Promise.resolve([]);
  }),
}));

describe("ProductCategoryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when category id is unknown", async () => {
    await expect(
      ProductCategoryDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("excludes DELETED dishes from the dishes passed to view", async () => {
    const element = await ProductCategoryDetailPage({
      params: { id: "CAT-001" },
      searchParams: {},
    });

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(element).toBeDefined();
    expect(element.props.dishes).toHaveLength(1);
    expect(element.props.dishes[0].id).toBe("PROD-001");
    expect(element.props.dishes.some((d: any) => d.id === "PROD-002")).toBe(false);
  });

  it("does not pass function props to Client Component", async () => {
    const element = await ProductCategoryDetailPage({
      params: { id: "CAT-001" },
      searchParams: { returnTo: "/admin/products/categories?q=ca" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
