import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/superpowers/plans/2026-08-26-outlet-done-properly.md section 3: a
// draft belongs to the till it was started at, not whatever brand happened
// to be stamped at that moment. These tests prove getPOSDrafts filters by
// outlet_id and that a draft created at one outlet is not listed at
// another -- the plan's own section 5 requirement.

const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ resolveActor: mocks.resolveActor }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: vi.fn(),
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: vi.fn(),
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
}));

import { getPOSDrafts, savePOSDraft } from "./actions";

const AUTHENTICATED = { ok: true as const, actor: { id: "staff-1", name: "Thu ngân" } };

describe("getPOSDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue(AUTHENTICATED);
  });

  it("a draft created at one outlet is not listed at another", async () => {
    mocks.findAllNoCache.mockResolvedValue([
      { id: "drf-1", outlet_id: "OUT-001", brand_id: "BR-001", name: "Ca sáng" },
      { id: "drf-2", outlet_id: "OUT-002", brand_id: "BR-001", name: "Ca chiều" },
    ]);

    const result = await getPOSDrafts("OUT-001");

    expect(result).toEqual([{ id: "drf-1", outlet_id: "OUT-001", brand_id: "BR-001", name: "Ca sáng" }]);
  });

  it("returns nothing for an outlet with no drafts", async () => {
    mocks.findAllNoCache.mockResolvedValue([
      { id: "drf-1", outlet_id: "OUT-001", brand_id: "BR-001", name: "Ca sáng" },
    ]);

    const result = await getPOSDrafts("OUT-999");

    expect(result).toEqual([]);
  });
});

describe("savePOSDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue(AUTHENTICATED);
  });

  it("writes outlet_id alongside brand_id -- the sale-time fact, kept as-is", async () => {
    mocks.insert.mockResolvedValue(undefined);

    const res = await savePOSDraft({
      name: "Ca sáng",
      cart_json: "[]",
      brand_id: "BR-001",
      outlet_id: "OUT-001",
    });

    expect(res.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(
      "POS_Drafts",
      expect.objectContaining({ brand_id: "BR-001", outlet_id: "OUT-001" }),
    );
  });
});
