import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSupabaseClient: vi.fn(),
  findAllWhereInBatches: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock("@/lib/db/tables", () => ({
  findAllWhereInBatches: mocks.findAllWhereInBatches,
}));

import { getActivityLogEvents } from "./actions";

function query(result: unknown) {
  const builder: Record<string, any> = {};
  for (const method of ["select", "eq", "in", "gte", "lte", "ilike", "limit", "or", "not", "order", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe("getActivityLogEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
    mocks.findAllWhereInBatches.mockResolvedValue([
      { id: "order-1", order_no: "PHD001001" },
    ]);
  });

  it("rejects before querying when the caller is not an administrator", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Forbidden" });

    await expect(getActivityLogEvents()).rejects.toThrow("Forbidden");
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it("sanitizes text search, filters in PostgREST, paginates, and enriches only the returned page", async () => {
    const orderSearch = query({ data: [{ id: "order-1" }], error: null });
    const events = query({
      data: [{
        id: "event-1",
        order_id: "order-1",
        event_type: "VOIDED",
        event_at: "2026-07-24T10:00:00.000Z",
        actor_id: "u1",
        actor_name: "admin",
        delta_json: { voided: true },
      }],
      count: 41,
      error: null,
    });
    // B5 (2026-10-14 audit): the picker comes from the Users table, id and
    // name only, not from a capped, unordered scan of the log.
    const actors = query({
      data: [
        { id: "u2", username: "cashier", name: "Cashier" },
        { id: "u1", username: "admin", name: "Admin" },
        { id: "u3", username: "admin2", name: "Admin" },
        { id: "u4", username: "ghost", name: null },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "orders_v2") return orderSearch;
      if (table === "order_events") return events;
      if (table === "users") return actors;
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.getSupabaseClient.mockReturnValue({ from });

    const result = await getActivityLogEvents({
      page: 2,
      q: "PHD(001),",
      type: "VOIDED",
      actor: "Admin (admin2)",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
    });

    expect(orderSearch.ilike).toHaveBeenCalledWith("order_no", "%PHD001%");
    expect(events.eq).toHaveBeenCalledWith("event_type", "VOIDED");
    // The picker shows labels, the log stores logins: the label of two same-named people picks only one login.
    expect(events.in).toHaveBeenCalledWith("actor_name", ["admin2"]);
    expect(events.gte).toHaveBeenCalledWith("event_at", "2026-07-01T00:00:00.000Z");
    expect(events.lte).toHaveBeenCalledWith("event_at", "2026-07-31T23:59:59.999Z");
    expect(events.or).toHaveBeenCalledWith(
      "id.ilike.%PHD001%,reason.ilike.%PHD001%,actor_name.ilike.%PHD001%,order_id.in.(order-1)",
    );
    expect(events.order).toHaveBeenCalledWith("event_at", { ascending: false });
    expect(events.range).toHaveBeenCalledWith(20, 39);
    expect(mocks.findAllWhereInBatches).toHaveBeenCalledWith(
      "Orders_V2",
      "id",
      ["order-1"],
    );
    expect(result.events).toEqual([expect.objectContaining({
      id: "event-1",
      order_no: "PHD001001",
      actor_name: "Admin",
      delta_json: JSON.stringify({ voided: true }),
    })]);
    expect(result.totalCount).toBe(41);
    expect(result.itemsPerPage).toBe(20);
    expect(result.actors).toEqual(["Admin (admin)", "Admin (admin2)", "Cashier", "ghost"]);
    expect(actors.select).toHaveBeenCalledWith("id, username, name");
  });

  it("text search also finds events by the staff name, through the logins stored on the log", async () => {
    const events = query({ data: [], count: 0, error: null });
    const users = query({
      data: [
        { id: "u1", username: "tuyen2612", name: "Tài Chí Tuyền" },
        { id: "u2", username: "lan", name: "Lan" },
      ],
      error: null,
    });
    mocks.getSupabaseClient.mockReturnValue({
      from: (table: string) => (table === "order_events" ? events : table === "users" ? users : query({ data: [], error: null })),
    });

    await getActivityLogEvents({ q: "tài chí" });

    expect(events.or).toHaveBeenCalledWith(
      'id.ilike.%tài chí%,reason.ilike.%tài chí%,actor_name.ilike.%tài chí%,actor_name.in.("tuyen2612")',
    );
  });

  describe("the person filter maps a picker value back to the stored logins", () => {
    const mockUsers = (users: { id: string; username: string; name: string | null }[]) => {
      const events = query({ data: [], count: 0, error: null });
      const usersQuery = query({ data: users, error: null });
      mocks.getSupabaseClient.mockReturnValue({
        from: (table: string) => (table === "order_events" ? events : table === "users" ? usersQuery : query({ data: [], error: null })),
      });
      return events;
    };
    const actorLogins = async (users: { id: string; username: string; name: string | null }[], actor: string) => {
      const events = mockUsers(users);
      await getActivityLogEvents({ actor });
      return events.in.mock.calls[0][1];
    };
    const actorLabel = async (users: { id: string; username: string; name: string | null }[], actor?: string) => {
      mockUsers(users);
      return (await getActivityLogEvents({ actor })).actorLabel;
    };

    it("a label equal to another person's login picks only the person who owns that label", async () => {
      // B's label is "lan", which is also A's login.
      const users = [{ id: "u1", username: "lan", name: "Lan Anh" }, { id: "u2", username: "b2", name: "lan" }];
      expect(await actorLogins(users, "lan")).toEqual(["b2"]);
    });

    it("an old plain-name link finds every staff who shares that name", async () => {
      const users = [{ id: "u1", username: "admin", name: "Admin" }, { id: "u2", username: "admin2", name: "Admin" }];
      expect(await actorLogins(users, "Admin")).toEqual(["admin", "admin2"]);
    });

    it("an actor that matches no user (a system actor) filters by exactly that stored text", async () => {
      const users = [{ id: "u1", username: "admin", name: "Admin" }];
      expect(await actorLogins(users, "Hệ thống")).toEqual(["Hệ thống"]);
    });

    it("actorLabel is the picker label of the one person an old login link points at", async () => {
      const users = [{ id: "u1", username: "admin", name: "Admin" }, { id: "u2", username: "cashier", name: "Cashier" }];
      expect(await actorLabel(users, "admin")).toBe("Admin");
    });

    it("actorLabel is null for no actor, an unknown actor, and a plain name shared by two staff", async () => {
      const twins = [{ id: "u1", username: "admin", name: "Admin" }, { id: "u2", username: "admin2", name: "Admin" }];
      expect(await actorLabel(twins)).toBeNull();
      expect(await actorLabel(twins, "Hệ thống")).toBeNull();
      expect(await actorLabel(twins, "Admin")).toBeNull();
    });
  });
});
