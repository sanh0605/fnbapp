import { describe, it, expect, vi, beforeEach } from "vitest";
import ModifierDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockModifiers } = vi.hoisted(() => ({
  mockModifiers: [
    {
      id: "MOD-001",
      name: "Trân châu đen",
      group_name: "Thêm Topping",
      price: "5000",
      status: "ACTIVE",
      product_id: "PROD-035",
    },
    {
      id: "MOD-002",
      name: "Size L",
      group_name: "Chọn Size",
      price: "10000",
      status: "ACTIVE",
      product_id: null,
    },
  ],
}));

const mockProducts = [
  { id: "PROD-035", name: "Trân châu đen", status: "ACTIVE" },
];

vi.mock("@/app/admin/products/modifiers/actions", () => ({
  getModifiersData: vi.fn().mockResolvedValue({
    modifiers: mockModifiers,
  }),
  deleteModifierAction: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockImplementation((table: string) => {
    if (table === "Products") return Promise.resolve(mockProducts);
    return Promise.resolve([]);
  }),
}));

describe("ModifierDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when modifier id is unknown", async () => {
    await expect(
      ModifierDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes plain linked product and does not pass function props to Client Component", async () => {
    const element = await ModifierDetailPage({
      params: { id: "MOD-001" },
      searchParams: { returnTo: "/admin/products/modifiers?q=tran" },
    });

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(element).toBeDefined();
    expect(element.props.product).toEqual({
      id: "PROD-035",
      name: "Trân châu đen",
      status: "ACTIVE",
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  it("passes null product for unlinked modifier and no function props", async () => {
    const element = await ModifierDetailPage({
      params: { id: "MOD-002" },
      searchParams: {},
    });

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(element).toBeDefined();
    expect(element.props.product).toBeNull();

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
