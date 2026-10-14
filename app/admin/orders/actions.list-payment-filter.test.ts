import { beforeEach, describe, expect, it, vi } from "vitest";

// B1 (2026-10-14 audit): the orders list filters by payment method through the
// one rule in lib/sales/payment-method.ts -- an empty method is cash, and an
// order paid two ways (order_payments rows) shows under both filters.
// The fake answers the Supabase builder calls the loader makes over in-memory
// tables, including the payment clause of .or().

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  orders: [] as any[],
  payments: [] as any[],
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
  getSupabaseClient: () => ({ from: (t: string) => makeQuery(t) }),
}));

// One predicate per clause of a PostgREST .or() string. Only the shapes the
// loader writes are understood; anything else throws so a typo fails loudly.
function clausePredicate(clause: string): (r: any) => boolean {
  const idIn = clause.match(/^id\.in\.\((.*)\)$/);
  if (idIn) { const ids = idIn[1].split(","); return r => ids.includes(r.id); }
  const m = clause.match(/^payment_method\.(eq|neq|is)\.(.*)$/);
  if (!m) throw new Error(`unexpected or-clause ${clause}`);
  const [, op, v] = m;
  if (op === "is") return r => r.payment_method === null;
  if (op === "eq") return r => r.payment_method === v;
  return r => r.payment_method !== null && r.payment_method !== v;
}

function makeQuery(table: string) {
  let rows = (table === "order_payments" ? mocks.payments : mocks.orders).slice();
  const q: any = {
    select: () => q,
    eq: (col: string, v: any) => { rows = rows.filter(r => r[col] === v); return q; },
    in: (col: string, vs: any[]) => { rows = rows.filter(r => vs.includes(r[col])); return q; },
    neq: (col: string, v: any) => { rows = rows.filter(r => r[col] !== v); return q; },
    gte: () => q,
    lte: () => q,
    ilike: () => q,
    or: (expr: string) => {
      if (expr.startsWith("superseded_by")) rows = rows.filter(r => !r.superseded_by);
      else {
        const preds = expr.split(/,(?=payment_method\.|id\.in\.)/).map(clausePredicate);
        rows = rows.filter(r => preds.some(p => p(r)));
      }
      return q;
    },
    order: () => q,
    range: () => q,
    then: (resolve: any) => resolve({ data: rows, count: rows.length, error: null }),
  };
  return q;
}

import { getOrdersV2 } from "./actions";

const order = (id: string, payment_method: string | null, net_total: number) => ({
  id, order_no: `#${id}`, brand_id: "BR-1", status: "COMPLETED", version: 1,
  superseded_by: "", payment_method, net_total, created_at: "2026-10-10T05:00:00Z",
});

describe("getOrdersV2 payment filter", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { name: "admin", role: "ADMIN" } });
    mocks.orders = [
      order("cash", "CASH", 10000),
      order("bank", "BANK_TRANSFER", 20000),
      order("empty", "", 30000),
      // Paid two ways: primary method is the first row's (CASH).
      order("split", "CASH", 40000),
    ];
    mocks.payments = [
      { order_id: "split", method: "CASH", amount: 15000 },
      { order_id: "split", method: "BANK_TRANSFER", amount: 25000 },
    ];
  });

  it("Tien mat: cash, an empty method, and the cash part of a split order -- not a pure bank order", async () => {
    const r = await getOrdersV2({ payment: "Tien mat" });
    expect(r.orders.map(o => o.id).sort()).toEqual(["cash", "empty", "split"]);
    expect(r.totals).toEqual({ count: 3, netTotal: 80000 });
  });

  it("Chuyen khoan: the bank order and the split order that has a bank part", async () => {
    const r = await getOrdersV2({ payment: "Chuyen khoan" });
    expect(r.orders.map(o => o.id).sort()).toEqual(["bank", "split"]);
    expect(r.totals).toEqual({ count: 2, netTotal: 60000 });
  });

  it("no payment filter still returns every order", async () => {
    const r = await getOrdersV2({});
    expect(r.orders).toHaveLength(4);
  });
});
