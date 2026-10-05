import { describe, it, expect, vi, beforeEach } from "vitest";
import BrandDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const mockBrands = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", status: "ACTIVE" },
  { id: "BR-003", name: "Thương hiệu đã xóa", code: "DEL", status: "DELETED" },
];

const mockOutlets = [
  { id: "OUT-001", name: "Điểm bán 1", brand_id: "BR-001", status: "ACTIVE" },
];

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockImplementation((table: string) => {
    if (table === "Brands") return Promise.resolve(mockBrands);
    if (table === "Outlets") return Promise.resolve(mockOutlets);
    return Promise.resolve([]);
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "USR-001", role: "ADMIN" },
  }),
}));

describe("BrandDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when brand id is unknown", async () => {
    await expect(
      BrandDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("calls notFound when brand status is DELETED", async () => {
    await expect(
      BrandDetailPage({ params: { id: "BR-003" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await BrandDetailPage({
      params: { id: "BR-001" },
      searchParams: { returnTo: "/admin/brands" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
