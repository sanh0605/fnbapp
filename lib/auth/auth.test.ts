import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  return { session: vi.fn(), maybeSingle, eq: vi.fn(() => ({ maybeSingle })) };
});

vi.mock("next-auth/next", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }),
}));

const SAVED = { ...process.env };

describe("resolveActor", () => {
  beforeEach(() => {
    mocks.session.mockReset();
    mocks.maybeSingle.mockReset();
    delete process.env.CLI_MODE;
    delete process.env.NEXT_RUNTIME;
  });
  afterEach(() => {
    process.env = { ...SAVED };
  });

  it("E4: uses the role in the Users row, not the one in the session token", async () => {
    const { resolveActor } = await import("./auth");
    mocks.session.mockResolvedValue({ user: { id: "U1", name: "a", role: "ADMIN" } });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "U1", role: "STAFF", status: "ACTIVE" }, error: null });
    const r = await resolveActor();
    expect(r.ok && r.actor.role).toBe("STAFF");
  });

  it("E4: fails when the user row is missing or not ACTIVE", async () => {
    const { resolveActor } = await import("./auth");
    mocks.session.mockResolvedValue({ user: { id: "U1", name: "a", role: "ADMIN" } });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await resolveActor()).toEqual({ ok: false, error: "Yêu cầu đăng nhập" });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "U1", role: "ADMIN", status: "INACTIVE" }, error: null });
    expect(await resolveActor()).toEqual({ ok: false, error: "Yêu cầu đăng nhập" });
  });

  it("E7: CLI_MODE is honoured only outside the web runtime", async () => {
    const { resolveActor } = await import("./auth");
    process.env.CLI_MODE = "true";
    expect((await resolveActor()).ok).toBe(true);
    process.env.NEXT_RUNTIME = "nodejs";
    mocks.session.mockResolvedValue(null);
    expect(await resolveActor()).toEqual({ ok: false, error: "Yêu cầu đăng nhập" });
  });

  it("E10: a failed login does not log the typed username", async () => {
    const { authOptions } = await import("./auth");
    const provider: any = authOptions.providers[0];
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await provider.options.authorize({ username: "typed-secret-name", password: "pw" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("typed-secret-name");
    spy.mockRestore();
  });
});
