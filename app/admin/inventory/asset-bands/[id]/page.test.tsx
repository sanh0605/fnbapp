import { describe, it, expect, vi, beforeEach } from "vitest";
import BandDetailPage from "./page";
import type { DBAssetDepreciationBand } from "@/types/db";

const { mockGetAssetBands, mockNotFound, mockResolveActor } = vi.hoisted(() => ({
  mockGetAssetBands: vi.fn(),
  mockNotFound: vi.fn(),
  mockResolveActor: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("../actions", () => ({
  getAssetBands: mockGetAssetBands,
}));

vi.mock("@/app/admin/inventory/asset-bands/actions", () => ({
  getAssetBands: mockGetAssetBands,
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: mockResolveActor,
}));

const SAMPLE_BANDS: DBAssetDepreciationBand[] = [
  {
    id: "KH-001",
    min_unit_price: 0,
    max_unit_price: 200000,
    term_months: 12,
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-002",
    min_unit_price: 200000,
    max_unit_price: 500000,
    term_months: 24,
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-003",
    min_unit_price: 500000,
    max_unit_price: null,
    term_months: 36,
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BandDetailPage", () => {
  it("returns notFound for unknown id", async () => {
    mockGetAssetBands.mockResolvedValue(SAMPLE_BANDS);
    mockResolveActor.mockResolvedValue({
      ok: true,
      actor: { role: "ADMIN" },
    });

    await expect(
      BandDetailPage({
        params: { id: "KH-NONEXISTENT" },
        searchParams: { returnTo: "/admin/inventory/asset-bands" },
      }),
    ).rejects.toThrow();

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("passes no function props to BandDetailView", async () => {
    mockGetAssetBands.mockResolvedValue(SAMPLE_BANDS);
    mockResolveActor.mockResolvedValue({
      ok: true,
      actor: { role: "ADMIN" },
    });

    const element = await BandDetailPage({
      params: { id: "KH-001" },
      searchParams: { returnTo: "/admin/inventory/asset-bands" },
    });

    const props = element.props;
    expect(props).toBeDefined();
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  it("sets canDelete to false for non-ADMIN", async () => {
    mockGetAssetBands.mockResolvedValue(SAMPLE_BANDS);
    mockResolveActor.mockResolvedValue({
      ok: true,
      actor: { role: "STAFF" },
    });

    const element = await BandDetailPage({
      params: { id: "KH-001" },
      searchParams: { returnTo: "/admin/inventory/asset-bands" },
    });

    expect(element.props.canDelete).toBe(false);
  });

  it("sets canDelete to true for ADMIN", async () => {
    mockGetAssetBands.mockResolvedValue(SAMPLE_BANDS);
    mockResolveActor.mockResolvedValue({
      ok: true,
      actor: { role: "ADMIN" },
    });

    const element = await BandDetailPage({
      params: { id: "KH-001" },
      searchParams: { returnTo: "/admin/inventory/asset-bands" },
    });

    expect(element.props.canDelete).toBe(true);
  });
});
