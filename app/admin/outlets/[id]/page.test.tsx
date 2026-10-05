import { describe, it, expect, vi, beforeEach } from "vitest";
import OutletDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockOutlets, mockBrands } = vi.hoisted(() => {
  const mockOutlets = [
    { id: "OUT-001", name: "Điểm bán 1", brand_id: "BR-001", status: "ACTIVE" },
  ];

  const mockBrands = [
    { id: "BR-001", name: "Phin Đi" },
  ];
  return { mockOutlets, mockBrands };
});

vi.mock("@/app/admin/outlets/actions", () => ({
  getOutlets: vi.fn().mockResolvedValue(mockOutlets),
  retireOutlet: vi.fn(),
}));

vi.mock("@/app/admin/brands/actions", () => ({
  getBrands: vi.fn().mockResolvedValue(mockBrands),
}));

describe("OutletDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when outlet id is unknown", async () => {
    await expect(
      OutletDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await OutletDetailPage({
      params: { id: "OUT-001" },
      searchParams: { returnTo: "/admin/outlets" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
