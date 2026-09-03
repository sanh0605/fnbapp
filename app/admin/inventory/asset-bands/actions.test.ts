import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  update: mocks.update,
  insert: mocks.insert,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateAssetBand, createAssetBand, deleteAssetBand, getAssetBands } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getAssetBands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty list", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getAssetBands()).rejects.toThrow("db down");
  });

  it("a genuinely empty asset-bands table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getAssetBands()).resolves.toEqual([]);
  });
});

// 2026-08-23 fix: half-open bounds (max_unit_price exclusive). Only
// KH-001/KH-003's numbers actually changed from the original seed.
const SEEDED = [
  { id: "KH-001", min_unit_price: 0, max_unit_price: 200_000, term_months: 12, status: "ACTIVE" },
  { id: "KH-002", min_unit_price: 200_000, max_unit_price: 500_000, term_months: 24, status: "ACTIVE" },
  { id: "KH-003", min_unit_price: 500_000, max_unit_price: null, term_months: 36, status: "ACTIVE" },
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
    // KH-002 already having been moved to start at 250.000.
    mocks.findAll.mockResolvedValue([
      SEEDED[0],
      { ...SEEDED[1], min_unit_price: 250_000 },
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
      formData({ id: "KH-001", min_unit_price: "0", max_unit_price: "150000", term_months: "12" }), // leaves 150.000-200.000 uncovered
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
      formData({ id: "KH-001", min_unit_price: "0", max_unit_price: "200000", term_months: "0" }),
    );

    expect(res.error).toBeTruthy();
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("accepts an empty max_unit_price as 'no upper bound' only for the last band", async () => {
    const res = await updateAssetBand(
      formData({ id: "KH-003", min_unit_price: "500000", max_unit_price: "", term_months: "48" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "asset_depreciation_bands",
      "KH-003",
      { min_unit_price: 500_000, max_unit_price: null, term_months: 48 },
    );
  });
});

// 2026-08-23, section 2: "Add create and delete, both running validateBands
// against the resulting set and refusing with the existing Vietnamese
// messages."
describe("createAssetBand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("KH-999");
  });

  it("accepts a new band that exactly fills a hole in the table (owner splits KH-002 in two)", async () => {
    // Split 200.000-500.000 into 200.000-350.000 and 350.000-500.000 --
    // requires the create AND an edit of KH-002 together; simulate KH-002
    // already narrowed, then create the new band that fills the rest.
    mocks.findAll.mockResolvedValue([
      SEEDED[0],
      { ...SEEDED[1], max_unit_price: 350_000 },
      SEEDED[2],
    ]);

    const res = await createAssetBand(
      formData({ min_unit_price: "350000", max_unit_price: "500000", term_months: "18" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "asset_depreciation_bands",
      { id: "KH-999", min_unit_price: 350_000, max_unit_price: 500_000, term_months: 18 },
    );
  });

  it("refuses a new band that overlaps an existing one, writing nothing", async () => {
    mocks.findAll.mockResolvedValue(SEEDED);

    const res = await createAssetBand(
      formData({ min_unit_price: "300000", max_unit_price: "400000", term_months: "18" }), // already inside KH-002
    );

    expect(res.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses a new band that would leave a gap against the existing table", async () => {
    mocks.findAll.mockResolvedValue(SEEDED);

    // A band starting past 500.000 with a finite ceiling leaves everything
    // above its own ceiling uncovered, on top of not being adjacent to
    // KH-003 at all.
    const res = await createAssetBand(
      formData({ min_unit_price: "600000", max_unit_price: "700000", term_months: "18" }),
    );

    expect(res.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("deleteAssetBand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("refuses to delete the middle band of the three seeded bands -- it would open a gap", async () => {
    mocks.findAll.mockResolvedValue(SEEDED);

    const res = await deleteAssetBand(formData({ id: "KH-002" }));

    expect(res.error).toBeTruthy();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  // 2026-08-23 addition, beyond section 2's literal ask: deleting the FIRST
  // or LAST band does not create a gap BETWEEN remaining bands -- it
  // leaves a hole at one edge of the price line, which validateBands' own
  // 2026-08-23 coverage requirement catches.
  it("refuses to delete the first band -- it would leave the low end uncovered", async () => {
    mocks.findAll.mockResolvedValue(SEEDED);

    const res = await deleteAssetBand(formData({ id: "KH-001" }));

    expect(res.error).toBeTruthy();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("refuses to delete the last (unbounded) band -- it would leave the high end uncovered", async () => {
    mocks.findAll.mockResolvedValue(SEEDED);

    const res = await deleteAssetBand(formData({ id: "KH-003" }));

    expect(res.error).toBeTruthy();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes a band whose neighbour has already absorbed its range", async () => {
    // KH-001 widened to cover 0-500.000 (absorbing what KH-002 used to
    // cover) -- KH-002 is now fully redundant and can be deleted cleanly.
    mocks.findAll.mockResolvedValue([
      { ...SEEDED[0], max_unit_price: 500_000 },
      SEEDED[1],
      SEEDED[2],
    ]);

    const res = await deleteAssetBand(formData({ id: "KH-002" }));

    expect(res.error).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith("asset_depreciation_bands", "KH-002");
  });

  it("refuses a missing id before touching the database", async () => {
    const res = await deleteAssetBand(formData({}));

    expect(res.error).toBeTruthy();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});
