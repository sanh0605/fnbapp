import { describe, it, expect, vi, beforeEach } from "vitest";
import AssetDetailPage from "./page";
import type { AssetItemDetail } from "@/lib/assets/asset-items";

const { mockGetAssetItemDetail, mockFindItemIdForAsset, mockNotFound, mockRedirect } = vi.hoisted(() => ({
  mockGetAssetItemDetail: vi.fn(),
  mockFindItemIdForAsset: vi.fn(),
  mockNotFound: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("../actions", () => ({
  getAssetItemDetail: mockGetAssetItemDetail,
  findItemIdForAsset: mockFindItemIdForAsset,
}));

vi.mock("@/app/admin/inventory/assets/actions", () => ({
  getAssetItemDetail: mockGetAssetItemDetail,
  findItemIdForAsset: mockFindItemIdForAsset,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/assets/SPM-BINH",
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

const MOCK_DETAIL: AssetItemDetail = {
  item: {
    itemId: "SPM-BINH",
    name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
    quantity: 2,
    remainingQuantity: 1,
    disposedQuantity: 1,
    remainingValue: 145860,
    latestAcquiredDate: "2026-04-04",
    fullyDisposed: false,
    totalCost: 411840,
    chargedToDate: 265980,
  },
  lots: [
    {
      id: "TS-004",
      name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
      nameSnapshot: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
      purchaseOrderId: "PO-009",
      acquiredDate: "2026-04-04",
      unitCost: 205920,
      totalCost: 411840,
      quantity: 2,
      remainingQuantity: 1,
      termMonths: 24,
      remainingValue: 145860,
      bucket: "IN_USE",
    },
  ],
  disposals: [
    {
      id: "TL-002",
      assetId: "TS-004",
      lotAcquiredDate: "2026-04-04",
      quantity: 1,
      disposedDate: "2026-07-02",
      reason: "",
      charge: 171600,
    },
  ],
  months: [
    { month: "2026-07", unitsHeld: 1, charge: 188760, disposalCharge: 171600 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssetDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    mockGetAssetItemDetail.mockResolvedValue(MOCK_DETAIL);

    const element = await AssetDetailPage({
      params: { id: "SPM-BINH" },
      searchParams: { returnTo: "/admin/inventory/assets" },
    });

    const props = element.props;
    expect(props).toBeDefined();
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
    expect(props.detail).toEqual(MOCK_DETAIL);
  });

  it("redirects TS-004 param to the item page, preserving returnTo", async () => {
    mockFindItemIdForAsset.mockResolvedValue("SPM-BINH");

    await expect(
      AssetDetailPage({
        params: { id: "TS-004" },
        searchParams: { returnTo: "/admin/inventory/assets" },
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockFindItemIdForAsset).toHaveBeenCalledWith("TS-004");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/inventory\/assets\/SPM-BINH\?returnTo=/),
    );
  });

  it("calls notFound when findItemIdForAsset returns null for an unknown or inactive TS- code", async () => {
    mockFindItemIdForAsset.mockResolvedValue(null);

    await expect(
      AssetDetailPage({
        params: { id: "TS-999" },
        searchParams: { returnTo: "/admin/inventory/assets" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when item detail is null for an unknown item code", async () => {
    mockGetAssetItemDetail.mockResolvedValue(null);

    await expect(
      AssetDetailPage({
        params: { id: "SPM-UNKNOWN" },
        searchParams: { returnTo: "/admin/inventory/assets" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
