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
  { id: "PROD-003", name: "Trà đào", category_id: "CAT-002", status: "ACTIVE" },
];

vi.mock("@/app/admin/products/categories/actions", () => ({
  getCategoriesWithCounts: vi.fn().mockResolvedValue({
    categories: mockCategories,
    counts: { "CAT-001": 1, "CAT-002": 1 },
  }),
  deleteCategory: vi.fn(),
}));

const resolveActorMock = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  resolveActor: () => resolveActorMock(),
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
    resolveActorMock.mockResolvedValue({ ok: true, actor: { role: "ADMIN" } });
  });

  it("calls notFound when category id is unknown", async () => {
    await expect(
      ProductCategoryDetailPage({ params: Promise.resolve({ id: "UNKNOWN" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes only the dishes of this group to the view", async () => {
    const element = await ProductCategoryDetailPage({
      params: Promise.resolve({ id: "CAT-001" }),
      searchParams: Promise.resolve({}),
    });

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(element).toBeDefined();
    expect(element.props.dishes).toHaveLength(1);
    expect(element.props.dishes[0].id).toBe("PROD-001");
    expect(element.props.dishes.some((d: any) => d.id === "PROD-003")).toBe(false);
  });

  it("does not pass function props to Client Component", async () => {
    const element = await ProductCategoryDetailPage({
      params: Promise.resolve({ id: "CAT-001" }),
      searchParams: Promise.resolve({ returnTo: "/admin/products/categories?q=ca" }),
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  it("passes canDelete true for ADMIN", async () => {
    const element = await ProductCategoryDetailPage({
      params: Promise.resolve({ id: "CAT-001" }),
      searchParams: Promise.resolve({}),
    });
    expect(element.props.canDelete).toBe(true);
  });

  it("passes canDelete false for non-ADMIN", async () => {
    resolveActorMock.mockResolvedValue({ ok: true, actor: { role: "STAFF" } });
    const element = await ProductCategoryDetailPage({
      params: Promise.resolve({ id: "CAT-001" }),
      searchParams: Promise.resolve({}),
    });
    expect(element.props.canDelete).toBe(false);
  });
});
