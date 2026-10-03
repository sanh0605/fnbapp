import { describe, it, expect, vi, beforeEach } from "vitest";
import DisposeAssetPage from "./page";
import type { AssetItemDetail, AssetLotView } from "@/lib/assets/asset-items";

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
  usePathname: () => "/admin/inventory/assets/SPM-COC/dispose",
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

// Real figures from the plan: Cốc đong 100ml
// TS-025: 27/03/2026, remaining 0 (fully disposed on 02/07)
// TS-030: 08/04/2026, remaining 2 (oldest lot with stock)
// TS-057: 01/07/2026, remaining 4
const LOT_TS025: AssetLotView = {
  id: "TS-025",
  name: "Cốc đong 100ml",
  nameSnapshot: "Cốc đong 100ml",
  purchaseOrderId: "PO-001",
  acquiredDate: "2026-03-27",
  unitCost: 12500,
  totalCost: 25000,
  quantity: 2,
  remainingQuantity: 0,
  termMonths: 12,
  remainingValue: 0,
  bucket: "DISPOSED",
};

const LOT_TS030: AssetLotView = {
  id: "TS-030",
  name: "Cốc đong 100ml",
  nameSnapshot: "Cốc đong 100ml",
  purchaseOrderId: "PO-003",
  acquiredDate: "2026-04-08",
  unitCost: 17500,
  totalCost: 35000,
  quantity: 2,
  remainingQuantity: 2,
  termMonths: 12,
  remainingValue: 20000,
  bucket: "IN_USE",
};

const LOT_TS057: AssetLotView = {
  id: "TS-057",
  name: "Cốc đong 100ml",
  nameSnapshot: "Cốc đong 100ml",
  purchaseOrderId: "PO-007",
  acquiredDate: "2026-07-01",
  unitCost: 13785,
  totalCost: 55140,
  quantity: 4,
  remainingQuantity: 4,
  termMonths: 12,
  remainingValue: 45000,
  bucket: "IN_USE",
};

const COC_DONG_DETAIL: AssetItemDetail = {
  item: {
    itemId: "SPM-COC",
    name: "Cốc đong 100ml",
    quantity: 8,
    remainingQuantity: 6,
    disposedQuantity: 2,
    remainingValue: 65000,
    latestAcquiredDate: "2026-07-01",
    fullyDisposed: false,
    totalCost: 115140,
    chargedToDate: 50140,
  },
  lots: [LOT_TS025, LOT_TS030, LOT_TS057],
  disposals: [
    {
      id: "TL-001",
      assetId: "TS-025",
      lotAcquiredDate: "2026-03-27",
      quantity: 2,
      disposedDate: "2026-07-02",
      reason: "Rơi vỡ",
      charge: 14583.33,
    },
  ],
  months: [],
};

const FULLY_DISPOSED_DETAIL: AssetItemDetail = {
  item: {
    itemId: "SPM-CU",
    name: "Khay inox cũ",
    quantity: 2,
    remainingQuantity: 0,
    disposedQuantity: 2,
    remainingValue: 0,
    latestAcquiredDate: "2026-01-10",
    fullyDisposed: true,
    totalCost: 50000,
    chargedToDate: 50000,
  },
  lots: [LOT_TS025],
  disposals: [],
  months: [],
};

function findFormProps(element: any): any {
  if (!element || !element.props) return null;
  if (element.props.lots !== undefined) return element.props;
  if (Array.isArray(element.props.children)) {
    for (const child of element.props.children) {
      const found = findFormProps(child);
      if (found) return found;
    }
  } else if (element.props.children) {
    return findFormProps(element.props.children);
  }
  return null;
}

function checkNoFunctionProps(element: any) {
  if (!element || !element.props) return;
  expect(Object.values(element.props).every((v) => typeof v !== "function")).toBe(true);
  if (Array.isArray(element.props.children)) {
    element.props.children.forEach(checkNoFunctionProps);
  } else if (element.props.children) {
    checkNoFunctionProps(element.props.children);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DisposeAssetPage", () => {
  it("does not pass function props to Client Component", async () => {
    mockGetAssetItemDetail.mockResolvedValue(COC_DONG_DETAIL);

    const element = await DisposeAssetPage({
      params: { id: "SPM-COC" },
      searchParams: { returnTo: "/admin/inventory/assets/SPM-COC" },
    });

    expect(element).toBeDefined();
    checkNoFunctionProps(element);
  });

  it("redirects /TS-.../dispose to /[itemId]/dispose?lot=TS-..., preserving returnTo", async () => {
    mockFindItemIdForAsset.mockResolvedValue("SPM-COC");

    await expect(
      DisposeAssetPage({
        params: { id: "TS-030" },
        searchParams: { returnTo: "/admin/inventory/assets" },
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockFindItemIdForAsset).toHaveBeenCalledWith("TS-030");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/inventory\/assets\/SPM-COC\/dispose\?.*lot=TS-030/),
    );
  });

  it("preselects the lot specified in ?lot=TS-030 when it has remaining stock", async () => {
    mockGetAssetItemDetail.mockResolvedValue(COC_DONG_DETAIL);

    const element = await DisposeAssetPage({
      params: { id: "SPM-COC" },
      searchParams: { lot: "TS-030" },
    });

    const formProps = findFormProps(element);
    expect(formProps).not.toBeNull();
    expect(formProps.initialLotId).toBe("TS-030");
    expect(formProps.lots.map((l: any) => l.id)).toEqual(["TS-030", "TS-057"]);
  });

  it("falls back to the oldest lot with stock when ?lot=TS-025 has no stock left", async () => {
    mockGetAssetItemDetail.mockResolvedValue(COC_DONG_DETAIL);

    const element = await DisposeAssetPage({
      params: { id: "SPM-COC" },
      searchParams: { lot: "TS-025" }, // TS-025 has remainingQuantity === 0
    });

    const formProps = findFormProps(element);
    expect(formProps).not.toBeNull();
    // TS-030 is the oldest lot with stock
    expect(formProps.initialLotId).toBe("TS-030");
  });

  it("defaults to the oldest lot with stock when no lot param is provided", async () => {
    mockGetAssetItemDetail.mockResolvedValue(COC_DONG_DETAIL);

    const element = await DisposeAssetPage({
      params: { id: "SPM-COC" },
      searchParams: {},
    });

    const formProps = findFormProps(element);
    expect(formProps).not.toBeNull();
    expect(formProps.initialLotId).toBe("TS-030");
  });

  it("calls notFound when item does not exist or has no active lots", async () => {
    mockGetAssetItemDetail.mockResolvedValue(null);

    await expect(
      DisposeAssetPage({
        params: { id: "SPM-UNKNOWN" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when item is fully disposed (remainingQuantity === 0)", async () => {
    mockGetAssetItemDetail.mockResolvedValue(FULLY_DISPOSED_DETAIL);

    await expect(
      DisposeAssetPage({
        params: { id: "SPM-CU" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
