import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  update: mocks.update,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateAssetBand } from "./actions";

const SEEDED = [
  { id: "KH-001", min_unit_price: 0, max_unit_price: 199_999, term_months: 12, status: "ACTIVE" },
  { id: "KH-002", min_unit_price: 200_000, max_unit_price: 500_000, term_months: 24, status: "ACTIVE" },
  { id: "KH-003", min_unit_price: 500_001, max_unit_price: null, term_months: 36, status: "ACTIVE" },
];

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("updateAssetBand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue(SEEDED);
  });

  it("accepts a term_months-only edit that keeps the boundaries intact", async () => {
    const res = await updateAssetBand(
      formData({ id: "KH-002", min_unit_price: "200000", max_unit_price: "500000", term_months: "30" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "asset_depreciation_bands",
      "KH-002",
      { min_unit_price: 200_000, max_unit_price: 500_000, term_months: 30 },
    );
  });

  it("accepts moving a boundary when the whole table stays gapless (owner also edits the neighbour)", async () => {
    // Widen KH-001 to 250.000 -- this alone would overlap KH-002 unless
    // KH-002 is edited too. Simulate that: this call edits KH-001 with
    // KH-002 already having been moved to start at 250.001.
    mocks.findAll.mockResolvedValue([
      SEEDED[0],
      { ...SEEDED[1], min_unit_price: 250_001 },
      SEEDED[2],
    ]);

    const res = await updateAssetBand(
      formData({ id: "KH-001", min_unit_price: "0", max_unit_price: "250000", term_months: "12" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalled();
  });

  it("refuses an edit that opens a gap, and does not write anything", async () => {
    const res = await updateAssetBand(
      formData({ id: "KH-001", min_unit_price: "0", max_unit_price: "150000", term_months: "12" }), // leaves 150.001-199.999 uncovered
    );

    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses an edit that creates an overlap, and does not write anything", async () => {
    const res = await updateAssetBand(
      formData({ id: "KH-001", min_unit_price: "0", max_unit_price: "250000", term_months: "12" }), // overlaps KH-002 unless KH-002 also moved
    );

    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a non-positive term_months before even checking the band table", async () => {
    const res = await updateAssetBand(
      formData({ id: "KH-001", min_unit_price: "0", max_unit_price: "199999", term_months: "0" }),
    );

    expect(res.error).toBeTruthy();
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("accepts an empty max_unit_price as 'no upper bound' only for the last band", async () => {
    const res = await updateAssetBand(
      formData({ id: "KH-003", min_unit_price: "500001", max_unit_price: "", term_months: "48" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "asset_depreciation_bands",
      "KH-003",
      { min_unit_price: 500_001, max_unit_price: null, term_months: 48 },
    );
  });
});
