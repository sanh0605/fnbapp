import { beforeEach, describe, expect, it, vi } from "vitest";

const recomputeEventApplyMock = vi.fn();
const requireAdminMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/backdated-ledger/recompute-event", () => ({
  recomputeEventApply: recomputeEventApplyMock,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

describe("backdated-ledger review action authorization", () => {
  beforeEach(() => {
    recomputeEventApplyMock.mockReset();
    requireAdminMock.mockReset();
    rpcMock.mockReset();
  });

  it("rejects an unauthenticated recompute before applying changes", async () => {
    const { approveAndRecomputeAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    const result = await approveAndRecomputeAction("EVENT-1", "spoofed-reviewer");

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(recomputeEventApplyMock).not.toHaveBeenCalled();
  });

  it("records the authenticated admin instead of the supplied recompute reviewer", async () => {
    const { approveAndRecomputeAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-1", name: "session-owner", role: "ADMIN" },
    });
    recomputeEventApplyMock.mockResolvedValue({ run_id: "RUN-1" });

    const result = await approveAndRecomputeAction("EVENT-2", "spoofed-reviewer");

    expect(result.success).toBe(true);
    expect(recomputeEventApplyMock).toHaveBeenCalledWith("EVENT-2", "session-owner");
  });

  it("rejects a wrong-role event rejection before calling the RPC", async () => {
    const { rejectEventAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: false,
      error: "Chỉ ADMIN mới có quyền thực hiện thao tác này",
    });

    const result = await rejectEventAction("EVENT-3", "spoofed-reviewer", "invalid");

    expect(result).toEqual({
      success: false,
      error: "Chỉ ADMIN mới có quyền thực hiện thao tác này",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("records the authenticated admin instead of the supplied rejection reviewer", async () => {
    const { rejectEventAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-2", name: "session-admin", role: "ADMIN" },
    });
    rpcMock.mockResolvedValue({ error: null });

    const result = await rejectEventAction("EVENT-4", "spoofed-reviewer", "duplicate");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("reject_backdated_event", {
      p_event_id: "EVENT-4",
      p_reviewer: "session-admin",
      p_reason: "duplicate",
    });
  });
});
