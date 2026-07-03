// Claude code — Supabase migration Phase B: rewritten mock from googleapis to @supabase/supabase-js.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  supabaseSelect: vi.fn(),
  supabaseUpdate: vi.fn(),
  queryCalls: [] as Array<{ method: string; args: any[] }>,
}));

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
});

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (fn: any) => fn,
}));

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    from: (tableName: string) => ({
      select: () => {
        const query: any = {};
        for (const method of ["gte", "lte", "eq", "in", "order", "limit"]) {
          query[method] = (...args: any[]) => {
            mocks.queryCalls.push({ method, args });
            return query;
          };
        }
        query.range = (...args: any[]) => {
          mocks.queryCalls.push({ method: "range", args });
          return mocks.supabaseSelect(tableName, ...args);
        };
        return query;
      },
      update: (payload: any) => ({
        eq: (_column: string, _value: any) => ({
          select: () => ({
            single: () => mocks.supabaseUpdate(payload),
          }),
        }),
      }),
    }),
  }),
}));

import { findAllNoCache, findAllWhere, updateMany } from "./sheets_db";

describe("findAllNoCache legacy compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseSelect.mockReset();
    mocks.queryCalls.length = 0;
  });

  it("serializes Postgres booleans as legacy Sheets TRUE/FALSE strings", async () => {
    mocks.supabaseSelect.mockResolvedValue({
      data: [
        { id: "ING-001", is_non_inventory: true },
        { id: "ING-002", is_non_inventory: false },
      ],
      error: null,
    });

    const rows = await findAllNoCache("Base_Ingredients");

    expect(rows).toEqual([
      { id: "ING-001", is_non_inventory: "TRUE" },
      { id: "ING-002", is_non_inventory: "FALSE" },
    ]);
  });

  it("continues after the Supabase 1000-row response cap", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `ORD-${index}` }));
    mocks.supabaseSelect
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ id: "ORD-1000" }], error: null });

    const rows = await findAllNoCache("Orders_V2");

    expect(rows).toHaveLength(1001);
    expect(mocks.queryCalls.filter(call => call.method === "range")).toEqual([
      { method: "range", args: [0, 999] },
      { method: "range", args: [1000, 1999] },
    ]);
  });
});

describe("findAllWhere", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseSelect.mockReset();
    mocks.queryCalls.length = 0;
  });

  it("chains filters, normalizes Dates, orders, and returns matching rows", async () => {
    mocks.supabaseSelect.mockResolvedValue({
      data: [{ id: "ORD-1", status: "COMPLETED" }],
      error: null,
    });
    const start = new Date("2026-07-01T00:00:00.000Z");
    const end = new Date("2026-07-02T00:00:00.000Z");

    const rows = await findAllWhere("Orders_V2", {
      gte: { created_at: start },
      lte: { created_at: end },
      eq: { status: "COMPLETED", version: 1 },
      in: { brand_id: ["BR-001", "BR-002"] },
      order: { column: "created_at", ascending: false },
    });

    expect(rows).toEqual([{ id: "ORD-1", status: "COMPLETED" }]);
    expect(mocks.queryCalls).toEqual([
      { method: "gte", args: ["created_at", start.toISOString()] },
      { method: "lte", args: ["created_at", end.toISOString()] },
      { method: "eq", args: ["status", "COMPLETED"] },
      { method: "eq", args: ["version", 1] },
      { method: "in", args: ["brand_id", ["BR-001", "BR-002"]] },
      { method: "order", args: ["created_at", { ascending: false }] },
      { method: "limit", args: [1000] },
      { method: "range", args: [0, 999] },
    ]);
  });

  it("paginates filtered results beyond the Supabase 1000-row response cap", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `ORD-${index}` }));
    mocks.supabaseSelect
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ id: "ORD-1000" }], error: null });

    const rows = await findAllWhere("Orders_V2", { eq: { status: "COMPLETED" } });

    expect(rows).toHaveLength(1001);
    expect(mocks.queryCalls.filter(call => call.method === "limit")).toEqual([
      { method: "limit", args: [1000] },
      { method: "limit", args: [1000] },
    ]);
    expect(mocks.queryCalls.filter(call => call.method === "range")).toEqual([
      { method: "range", args: [0, 999] },
      { method: "range", args: [1000, 1999] },
    ]);
  });

  it("treats limit as a total cap across pages", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `ORD-${index}` }));
    mocks.supabaseSelect
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ id: "ORD-1000" }], error: null });

    const rows = await findAllWhere("Orders_V2", { limit: 1001 });

    expect(rows).toHaveLength(1001);
    expect(mocks.queryCalls.filter(call => call.method === "limit")).toEqual([
      { method: "limit", args: [1000] },
      { method: "limit", args: [1] },
    ]);
    expect(mocks.queryCalls.filter(call => call.method === "range")).toEqual([
      { method: "range", args: [0, 999] },
      { method: "range", args: [1000, 1000] },
    ]);
  });

  it("uses the same JSON serialization as findAllNoCache", async () => {
    mocks.supabaseSelect.mockResolvedValue({
      data: [{
        id: "ORD-1",
        applied_promotion_snapshot_json: { id: "PROMO-1" },
        pos_snapshot_json: {},
      }],
      error: null,
    });

    const rows = await findAllWhere("Orders_V2", { eq: { status: "COMPLETED" } });

    expect(rows).toEqual([{
      id: "ORD-1",
      applied_promotion_snapshot_json: '{"id":"PROMO-1"}',
      pos_snapshot_json: "",
    }]);
  });

  it("uses the same boolean serialization as findAllNoCache", async () => {
    mocks.supabaseSelect.mockResolvedValue({
      data: [{ id: "ING-1", is_non_inventory: true }],
      error: null,
    });

    const rows = await findAllWhere("Base_Ingredients", { eq: { id: "ING-1" } });

    expect(rows).toEqual([{ id: "ING-1", is_non_inventory: "TRUE" }]);
  });

  it("throws a contextual error when the filtered query fails", async () => {
    mocks.supabaseSelect.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    await expect(findAllWhere("Orders_V2", {
      eq: { status: "COMPLETED" },
    })).rejects.toThrow("findAllWhere(Orders_V2): database unavailable");
  });
});

describe("updateMany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseUpdate.mockReset();
  });

  it("updates multiple records via parallel Supabase update calls", async () => {
    // Mock: each update returns the merged row (mimics Postgres UPDATE ... RETURNING *).
    mocks.supabaseUpdate.mockImplementation((payload: any) => ({
      data: { id: payload.__testId, ...payload, __testId: undefined },
      error: null,
    }));

    const result = await updateMany("Purchase_Order_Lines", [
      { id: "POL-001", unit: "gram" },
      { id: "POL-002", name: "New two", unit: "gram" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "POL-001", unit: "gram" });
    expect(result[1]).toMatchObject({ id: "POL-002", name: "New two", unit: "gram" });
    expect(mocks.supabaseUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Purchase_Order_Lines");
  });

  it("returns empty array for empty input without calling Supabase", async () => {
    const result = await updateMany("Purchase_Order_Lines", []);
    expect(result).toEqual([]);
    expect(mocks.supabaseUpdate).not.toHaveBeenCalled();
  });

  it("throws on missing id", async () => {
    await expect(
      updateMany("Purchase_Order_Lines", [{ unit: "gram" }])
    ).rejects.toThrow(/missing id/);
  });

  it("deserializes legacy TRUE/FALSE strings for Postgres boolean columns", async () => {
    mocks.supabaseUpdate.mockImplementation((payload: any) => ({
      data: payload,
      error: null,
    }));

    await updateMany("Base_Ingredients", [
      { id: "ING-001", is_non_inventory: "TRUE" },
      { id: "ING-002", is_non_inventory: "FALSE" },
    ]);

    expect(mocks.supabaseUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ is_non_inventory: true }),
    );
    expect(mocks.supabaseUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ is_non_inventory: false }),
    );
  });
});
