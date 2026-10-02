import { describe, it, expect, vi, beforeEach } from "vitest";
import AssetDetailPage from "./page";
import type { AssetDetail } from "../actions";

const { mockGetAssetDetail, mockNotFound } = vi.hoisted(() => ({
  mockGetAssetDetail: vi.fn(),
  mockNotFound: vi.fn(),
}));

vi.mock("../actions", () => ({
  getAssetDetail: mockGetAssetDetail,
}));

vi.mock("@/app/admin/inventory/assets/actions", () => ({
  getAssetDetail: mockGetAssetDetail,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { role: "ADMIN" },
  }),
  requireAdmin: vi.fn().mockResolvedValue({
    ok: true,
    actor: { role: "ADMIN" },
  }),
}));

const MOCK_DETAIL: AssetDetail = {
  asset: {
    id: "TS-004",
    name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
    quantity: 2,
    remainingQuantity: 1,
    acquiredDate: "2026-04-04",
    unitCost: 205920,
    totalCost: 411840,
    termMonths: 24,
    remainingValue: 145860,
    bucket: "IN_USE",
  },
  schedule: [
    { month: "2026-04", unitsHeld: 2, charge: 17160 },
  ],
  disposals: [
    { id: "TL-002", quantity: 1, disposedDate: "2026-07-02", reason: "" },
  ],
  chargedToDate: 265980,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssetDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    mockGetAssetDetail.mockResolvedValue(MOCK_DETAIL);

    const element = await AssetDetailPage({
      params: { id: "TS-004" },
      searchParams: { returnTo: "/admin/inventory/assets" },
    });

    const props = element.props;
    expect(props).toBeDefined();
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  it("calls notFound when asset detail is null", async () => {
    mockGetAssetDetail.mockResolvedValue(null);

    await expect(
      AssetDetailPage({
        params: { id: "NON_EXISTENT" },
        searchParams: { returnTo: "/admin/inventory/assets" },
      }),
    ).rejects.toThrow();

    expect(mockNotFound).toHaveBeenCalled();
  });
});
