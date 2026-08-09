import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test for the 2026-08-09 production outage: getLastConfirmedStocktakeSession
 * called findAllWhere with order.column = "confirmed_at", a column findAllWhere
 * does not support (lib/sheets_db.ts:240 only allows 'id' or 'created_at') --
 * every load of /admin/inventory/stocktake threw. actions.test.ts mocks
 * @/lib/sheets_db entirely, so that test suite could not have caught this: the
 * mock accepts any argument the real function would reject. This file
 * deliberately does NOT mock @/lib/sheets_db -- only @/lib/supabase, with a
 * fake query builder faithful enough to drive findAllWhere's real code path,
 * including its own order-column validation.
 */

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn(), requireAdmin: vi.fn() }));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { getLastConfirmedStocktakeSession } from "./actions";

function fakeSupabaseClient(rowsByStatus: Record<string, any[]>) {
  return {
    from: (tableName: string) => ({
      select: () => {
        const calls: Array<{ method: string; args: any[] }> = [];
        const query: any = {};
        for (const method of ["eq", "order", "limit", "gt", "lt", "gte", "lte", "in", "or"]) {
          query[method] = (...args: any[]) => {
            calls.push({ method, args });
            return query;
          };
        }
        const resolve = () => {
          expect(tableName).toBe("stocktake_sessions");
          const statusCall = calls.find(c => c.method === "eq" && c.args[0] === "status");
          const status = statusCall?.args[1];
          return Promise.resolve({ data: rowsByStatus[status] ?? [], error: null });
        };
        query.then = (onFulfilled: any, onRejected: any) => resolve().then(onFulfilled, onRejected);
        query.catch = (onRejected: any) => resolve().catch(onRejected);
        query.finally = (onFinally: any) => resolve().finally(onFinally);
        return query;
      },
    }),
  };
}

describe("getLastConfirmedStocktakeSession, findAllWhere not stubbed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("does not throw against the real findAllWhere -- the exact bug that broke production", async () => {
    mocks.getSupabaseClient.mockReturnValue(
      fakeSupabaseClient({
        CONFIRMED: [{
          id: "STK-004",
          status: "CONFIRMED",
          confirmed_by_name: "Admin",
          confirmed_at: "2026-08-09T10:00:00Z",
          notes: "",
        }],
        OPEN: [],
      }),
    );

    await expect(getLastConfirmedStocktakeSession()).resolves.toEqual({
      id: "STK-004",
      confirmedByName: "Admin",
      confirmedAt: "2026-08-09T10:00:00Z",
      notes: "",
      hasOpenSessionBlocking: false,
    });
  });

  it("returns null when there is no confirmed session, still without throwing", async () => {
    mocks.getSupabaseClient.mockReturnValue(fakeSupabaseClient({ CONFIRMED: [], OPEN: [] }));

    await expect(getLastConfirmedStocktakeSession()).resolves.toBeNull();
  });
});
