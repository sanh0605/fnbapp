import { beforeEach, describe, expect, it, vi } from "vitest";

// BR-UI-004: getOrdersV2 returns the money total of every order the filter
// matches, not just the 20 on the page. The fake below answers the same
// Supabase query-builder calls the loader makes, over an in-memory table.

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  table: [] as any[],
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
  findAllWhere: vi.fn().mockResolvedValue([]),
  findAllWhereInBatches: vi.fn().mockResolvedValue([]),
  findById: vi.fn(),
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sales/void-order-transaction", () => ({ voidOrderAtomic: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({ from: () => makeQuery() }),
}));

function makeQuery() {
  let rows = mocks.table.slice();
  let from = 0;
  let to = Infinity;
  const q: any = {
    select: () => q,
    eq: (col: string, v: any) => { rows = rows.filter(r => r[col] === v); return q; },
    neq: (col: string, v: any) => { rows = rows.filter(r => r[col] !== v); return q; },
    gte: (col: string, v: any) => { rows = rows.filter(r => r[col] >= v); return q; },
    lte: (col: string, v: any) => { rows = rows.filter(r => r[col] <= v); return q; },
    ilike: (col: string, v: string) => {
      const needle = v.replace(/%/g, "").toLowerCase();
      rows = rows.filter(r => String(r[col]).toLowerCase().includes(needle));
      return q;
    },
    or: () => { rows = rows.filter(r => !r.superseded_by); return q; },
    order: (col: string, o: { ascending: boolean }) => {
      rows.sort((a, b) => (a[col] < b[col] ? 1 : -1) * (o.ascending ? -1 : 1));
      return q;
    },
    range: (a: number, b: number) => { from = a; to = b; return q; },
    then: (resolve: any) => resolve({
      data: rows.slice(from, to === Infinity ? undefined : to + 1),
      count: rows.length,
      error: null,
    }),
  };
  return q;
}

import { getOrdersV2 } from "./actions";

const order = (n: number, over: Record<string, any> = {}) => ({
  id: `ord-${n}`, order_no: `#${n}`, brand_id: "BR-1", status: "COMPLETED", version: 1,
  superseded_by: "", payment_method: "CASH", net_total: 1000 * n,
  created_at: `2026-10-${String((n % 28) + 1).padStart(2, "0")}T05:00:00Z`, ...over,
});

describe("getOrdersV2 totals (BR-UI-004)", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { name: "admin", role: "ADMIN" } });
    // 21 completed orders (20 on page 1, 1 beyond) + voided, an old superseded version, a draft.
    mocks.table = [
      ...Array.from({ length: 21 }, (_, i) => order(i + 1)),
      order(100, { status: "VOIDED", net_total: 777777 }),
      order(101, { superseded_by: "ord-1", net_total: 555555 }),
      order(102, { status: "DRAFT", net_total: 333333 }),
    ];
  });

  it("totals every counted order the filter matches, not only the page on screen", async () => {
    const r = await getOrdersV2({});
    expect(r.orders).toHaveLength(20);
    expect(r.totalCount).toBe(21);
    expect(r.totals).toEqual({ count: 21, netTotal: 1000 * (21 * 22) / 2 });
  });

  it("uses the same filter as the rows", async () => {
    const r = await getOrdersV2({ q: "#1" }); // #1, #10..#19 -> 11 orders
    expect(r.totals.count).toBe(r.totalCount);
    const expected = 1000 * (1 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19);
    expect(r.totals).toEqual({ count: 11, netTotal: expected });
  });
});
