import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  // BR-ACCESS-003: deleteAssetBand now calls requireOwner(), not requireAdmin().
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  replaceAssetBands: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  update: mocks.update,
  insert: mocks.insert,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("@/lib/assets/asset-bands-transaction", () => ({ replaceAssetBands: mocks.replaceAssetBands }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { getAssetBands, saveAssetBands } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getAssetBands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
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


// 2026-10-14 audit A4: the whole table is saved in one go.
describe("saveAssetBands", () => {
  const FORBIDDEN = { ok: false, error: "Chỉ chủ quán mới được xoá" };
  const save = (bands: unknown) => saveAssetBands(formData({ bands: JSON.stringify(bands) }));
  const same = [
    { id: "KH-001", min_unit_price: 0, term_months: 12 },
    { id: "KH-002", min_unit_price: 200_000, term_months: 24 },
    { id: "KH-003", min_unit_price: 500_000, term_months: 36 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue(SEEDED);
    mocks.replaceAssetBands.mockResolvedValue(["KH-004", "KH-001", "KH-002", "KH-003"]);
  });

  it("the plan example: add a 0-50.000 band at 6 months in front of the old three", async () => {
    const bands = [
      { id: null, min_unit_price: 0, term_months: 6 },
      { id: "KH-001", min_unit_price: 50_000, term_months: 12 },
      { id: "KH-002", min_unit_price: 200_000, term_months: 24 },
      { id: "KH-003", min_unit_price: 500_000, term_months: 36 },
    ];
    const res = await save(bands);

    expect(res.error).toBeUndefined();
    expect(res.ids).toEqual(["KH-004", "KH-001", "KH-002", "KH-003"]);
    expect(mocks.replaceAssetBands).toHaveBeenCalledWith(bands);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/asset-bands");
  });

  it("sorts by min before checking, so the typed order does not matter", async () => {
    const res = await save([same[2], same[0], same[1]]);
    expect(res.error).toBeUndefined();
    expect(mocks.replaceAssetBands).toHaveBeenCalled();
  });

  it("a manager changing only months is allowed (requireAdmin, not requireOwner)", async () => {
    mocks.requireOwner.mockResolvedValue(FORBIDDEN);
    const res = await save([{ ...same[0], term_months: 18 }, same[1], same[2]]);

    expect(res.error).toBeUndefined();
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(mocks.replaceAssetBands).toHaveBeenCalled();
  });

  it("a manager removing a band is refused and nothing is written", async () => {
    mocks.requireOwner.mockResolvedValue(FORBIDDEN);
    const res = await save([same[0], same[2]]);

    expect(res.error).toBeTruthy();
    expect(mocks.replaceAssetBands).not.toHaveBeenCalled();
  });

  it("the owner may remove a band", async () => {
    const res = await save([same[0], { id: "KH-003", min_unit_price: 200_000, term_months: 36 }]);

    expect(res.error).toBeUndefined();
    expect(mocks.requireOwner).toHaveBeenCalled();
    expect(mocks.replaceAssetBands).toHaveBeenCalled();
  });

  it.each([
    ["first row not 0", [{ id: "KH-001", min_unit_price: 1000, term_months: 12 }]],
    ["duplicate min", [same[0], { id: "KH-002", min_unit_price: 0, term_months: 24 }]],
    ["negative min", [{ id: null, min_unit_price: -5, term_months: 12 }, same[0]]],
    ["fractional min", [same[0], { id: "KH-002", min_unit_price: 200_000.5, term_months: 24 }]],
    ["fractional months", [{ ...same[0], term_months: 12.5 }, same[1], same[2]]],
    ["zero months", [{ ...same[0], term_months: 0 }, same[1], same[2]]],
    ["empty list", []],
    ["same id twice", [same[0], { ...same[1], id: "KH-001" }]],
    ["missing min", [same[0], { id: "KH-002", term_months: 24 }]],
  ])("refuses %s before the rpc is called", async (_name, bands) => {
    const res = await save(bands);

    expect(res.error).toBeTruthy();
    expect(mocks.replaceAssetBands).not.toHaveBeenCalled();
  });

  it("refuses an id that is not in the table", async () => {
    const res = await save([same[0], { id: "KH-999", min_unit_price: 200_000, term_months: 24 }, same[2]]);

    expect(res.error).toBeTruthy();
    expect(mocks.replaceAssetBands).not.toHaveBeenCalled();
  });

  it("refuses text that is not JSON", async () => {
    const res = await saveAssetBands(formData({ bands: "not json" }));
    expect(res.error).toBeTruthy();
    expect(mocks.replaceAssetBands).not.toHaveBeenCalled();
  });

  it("relays a database refusal as a Vietnamese error", async () => {
    mocks.replaceAssetBands.mockRejectedValue(new Error("Khung đầu tiên phải bắt đầu từ 0đ"));
    const res = await save(same);
    expect(res.error).toContain("Khung đầu tiên");
  });
});
