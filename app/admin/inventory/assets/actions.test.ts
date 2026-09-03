import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { getAssetsData, previewDisposalCharge, disposeAsset } from "./actions";

const ASSET = {
  id: "TS-001",
  purchased_item_id: "SPM-200",
  purchase_order_line_id: "POL-002",
  name_snapshot: "Bình nhựa có bơm 1000ml",
  acquired_date: "2026-01-01",
  unit_cost: 95_150,
  total_cost: 761_200,
  quantity: 8,
  term_months: 12,
  status: "ACTIVE",
};

// Batch 3, worked example 2's asset, for the disposal-preview and
// disposeAsset tests below.
const CA_DONG = {
  id: "TS-002",
  purchased_item_id: "SPM-201",
  purchase_order_line_id: "POL-003",
  name_snapshot: "Ca đong",
  acquired_date: "2026-03-01",
  unit_cost: 45_000,
  total_cost: 45_000,
  quantity: 1,
  term_months: 12,
  status: "ACTIVE",
};

function findAllMockFor(assets: any[], disposals: any[] = []) {
  return (sheet: string) => {
    if (sheet === "assets") return Promise.resolve(assets);
    if (sheet === "asset_disposals") return Promise.resolve(disposals);
    return Promise.resolve([]);
  };
}

describe("getAssetsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  // section 5: both required tests. The second guards against the fix
  // becoming "throw on empty" -- a different bug wearing the same diff.
  it("propagates the failure instead of returning a fabricated empty list", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getAssetsData()).rejects.toThrow("db down");
  });

  it("a genuinely empty assets table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([]));

    await expect(getAssetsData()).resolves.toEqual([]);
  });

  it("excludes an INACTIVE (administratively retired) asset row", async () => {
    mocks.findAll.mockImplementation(
      findAllMockFor([ASSET, { ...CA_DONG, id: "TS-999", status: "INACTIVE" }]),
    );

    const result = await getAssetsData();

    expect(result.map(a => a.id)).toEqual(["TS-001"]);
  });

  it("carries the disposal into the derived remaining quantity and bucket", async () => {
    mocks.findAll.mockImplementation(
      findAllMockFor(
        [ASSET],
        [{ id: "TL-001", asset_id: "TS-001", quantity: 8, disposed_date: "2026-02-01" }],
      ),
    );

    const result = await getAssetsData();

    expect(result[0].bucket).toBe("DISPOSED");
    expect(result[0].remainingQuantity).toBe(0);
  });
});

describe("previewDisposalCharge -- section 5.2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("matches worked example 2 exactly: disposing the ca đong in its third month charges 37.500d", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], []));

    const result = await previewDisposalCharge("TS-002", 1, "2026-05-15");

    expect(result).toEqual({ charge: 37_500 });
  });

  it("refuses a quantity greater than what remains", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], []));

    const result = await previewDisposalCharge("TS-002", 2, "2026-05-15");

    expect("error" in result).toBe(true);
  });

  // section 3.3: the preview endpoint gets the same server-side date check
  // as the real submit -- it is called on every keystroke
  // (DisposeAssetForm's onChange), so a clear refusal here is what the
  // owner actually sees while filling the form, not just at final submit.
  it("refuses a future disposal date, naming the valid range", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], []));

    const result = await previewDisposalCharge("TS-002", 1, "2099-01-01");

    expect("error" in result).toBe(true);
    if (!("error" in result)) throw new Error("expected refusal");
    expect(result.error).toContain("tương lai");
  });

  it("refuses a disposal date before the asset's own acquired_date, naming the valid range", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], [])); // acquired 2026-03-01

    const result = await previewDisposalCharge("TS-002", 1, "2026-01-15");

    expect("error" in result).toBe(true);
    if (!("error" in result)) throw new Error("expected refusal");
    expect(result.error).toContain("trước ngày mua");
  });
});

describe("disposeAsset -- section 3.3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("TL-100");
  });

  function fd(fields: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  }

  it("inserts a disposal row, never touching assets.quantity", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], []));

    const res = await disposeAsset(
      fd({ asset_id: "TS-002", quantity: "1", disposed_date: "2026-05-15", reason: "Vỡ" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "asset_disposals",
      expect.objectContaining({ asset_id: "TS-002", quantity: 1, disposed_date: "2026-05-15", reason: "Vỡ" }),
    );
  });

  it("refuses a disposal exceeding the remaining quantity, naming the number remaining", async () => {
    mocks.findAll.mockImplementation(
      findAllMockFor(
        [{ ...ASSET, quantity: 8 }],
        [{ id: "TL-001", asset_id: "TS-001", quantity: 5, disposed_date: "2026-02-01" }],
      ),
    );

    const res = await disposeAsset(fd({ asset_id: "TS-001", quantity: "4", disposed_date: "2026-03-01" }));

    expect(res.error).toContain("3"); // only 3 remain (8 - 5)
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses a non-positive quantity before touching the database", async () => {
    const res = await disposeAsset(fd({ asset_id: "TS-001", quantity: "0", disposed_date: "2026-03-01" }));

    expect(res.error).toBeTruthy();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it("refuses a missing date", async () => {
    const res = await disposeAsset(fd({ asset_id: "TS-001", quantity: "1", disposed_date: "" }));

    expect(res.error).toBeTruthy();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  // section 3.3/4. Today (pre-fix), buildAssetSchedule silently clamps a
  // future date to the term's last month and writes the row anyway -- this
  // is a wrong VALUE (the insert happens, res.error is undefined), not a
  // missing check, since disposeAsset already validated other fields.
  it("refuses a future disposal date before ever writing a row", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], []));

    const res = await disposeAsset(fd({ asset_id: "TS-002", quantity: "1", disposed_date: "2099-01-01" }));

    expect(res.error).toContain("tương lai");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  // Today (pre-fix), a same-month-earlier-day case slips past the existing
  // month-level guard inside buildAssetSchedule entirely (it only compares
  // year/month, not day) and writes the row -- the gap this plan's
  // critique found that the plan itself did not name.
  it("refuses a disposal dated earlier in the same month as acquisition", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([{ ...CA_DONG, acquired_date: "2026-03-20" }], []));

    const res = await disposeAsset(fd({ asset_id: "TS-002", quantity: "1", disposed_date: "2026-03-05" }));

    expect(res.error).toContain("trước ngày mua");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  // The load-bearing case (section 3.3): a real backdate, months before
  // today and after acquisition, must be ACCEPTED and written -- this is
  // what the owner actually does. A guard that refused this would be
  // worse than no guard.
  it("accepts and writes a valid backdate, months before today", async () => {
    mocks.findAll.mockImplementation(findAllMockFor([CA_DONG], [])); // acquired 2026-03-01

    const res = await disposeAsset(
      fd({ asset_id: "TS-002", quantity: "1", disposed_date: "2026-05-15", reason: "Vỡ hôm trước, ghi trễ" }),
    );

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "asset_disposals",
      expect.objectContaining({ asset_id: "TS-002", disposed_date: "2026-05-15" }),
    );
  });
});
