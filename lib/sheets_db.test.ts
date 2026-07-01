// Claude code — Supabase migration Phase B: rewritten mock from googleapis to @supabase/supabase-js.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  supabaseSelect: vi.fn(),
  supabaseUpdate: vi.fn(),
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
    from: () => ({
      select: () => ({
        range: () => mocks.supabaseSelect(),
      }),
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

import { findAllNoCache, updateMany } from "./sheets_db";

describe("findAllNoCache legacy compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

describe("updateMany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
