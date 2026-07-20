import { beforeEach, describe, expect, it, vi } from "vitest";

const recomputeEventApplyMock = vi.fn();
const recomputeRecipeEventApplyMock = vi.fn();
const requireAdminMock = vi.fn();
const rpcMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/backdated-ledger/recompute-event", () => ({
  recomputeEventApply: recomputeEventApplyMock,
}));

vi.mock("@/lib/backdated-recipe-events/recompute-event", () => ({
  recomputeRecipeEventApply: recomputeRecipeEventApplyMock,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: rpcMock, from: fromMock }),
}));

/** Configures findEventKind's lookup: ledger table returns a row for
 * `ledgerHit`, recipe table returns a row for `recipeHit`, otherwise
 * neither table finds the event. */
function setupEventKindLookup(options: { ledgerHit?: boolean; recipeHit?: boolean }) {
  maybeSingleMock.mockImplementation(() => {
    const table = fromMock.mock.calls[fromMock.mock.calls.length - 1][0];
    if (table === "backdated_ledger_events") {
      return Promise.resolve({ data: options.ledgerHit ? { id: "found" } : null });
    }
    return Promise.resolve({ data: options.recipeHit ? { id: "found" } : null });
  });
  eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  selectMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ select: selectMock });
}

describe("backdated-ledger review action authorization", () => {
  beforeEach(() => {
    recomputeEventApplyMock.mockReset();
    recomputeRecipeEventApplyMock.mockReset();
    requireAdminMock.mockReset();
    rpcMock.mockReset();
    maybeSingleMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    fromMock.mockReset();
  });

  it("rejects an unauthenticated recompute before applying changes", async () => {
    const { approveAndRecomputeAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    const result = await approveAndRecomputeAction("EVENT-1", "spoofed-reviewer");

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(recomputeEventApplyMock).not.toHaveBeenCalled();
    expect(recomputeRecipeEventApplyMock).not.toHaveBeenCalled();
  });

  it("records the authenticated admin instead of the supplied recompute reviewer, for a ledger event", async () => {
    setupEventKindLookup({ ledgerHit: true });
    const { approveAndRecomputeAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-1", name: "session-owner", role: "ADMIN" },
    });
    recomputeEventApplyMock.mockResolvedValue({ run_id: "RUN-1" });

    const result = await approveAndRecomputeAction("EVENT-2", "spoofed-reviewer");

    expect(result.success).toBe(true);
    expect(recomputeEventApplyMock).toHaveBeenCalledWith("EVENT-2", "session-owner");
    expect(recomputeRecipeEventApplyMock).not.toHaveBeenCalled();
  });

  it("routes a recipe event to recomputeRecipeEventApply instead of the ledger path", async () => {
    setupEventKindLookup({ recipeHit: true });
    const { approveAndRecomputeAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-1", name: "session-owner", role: "ADMIN" },
    });
    recomputeRecipeEventApplyMock.mockResolvedValue({ run_id: "RUN-RECIPE-1" });

    const result = await approveAndRecomputeAction("EVENT-RECIPE-1", "spoofed-reviewer");

    expect(result.success).toBe(true);
    expect(recomputeRecipeEventApplyMock).toHaveBeenCalledWith("EVENT-RECIPE-1", "session-owner");
    expect(recomputeEventApplyMock).not.toHaveBeenCalled();
  });

  it("fails cleanly when the event id matches neither table", async () => {
    setupEventKindLookup({});
    const { approveAndRecomputeAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-1", name: "session-owner", role: "ADMIN" },
    });

    const result = await approveAndRecomputeAction("EVENT-MISSING", "spoofed-reviewer");

    expect(result).toEqual({ success: false, error: "Event not found" });
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

  it("records the authenticated admin instead of the supplied rejection reviewer, for a ledger event", async () => {
    setupEventKindLookup({ ledgerHit: true });
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

  it("calls reject_backdated_recipe_event for a recipe event", async () => {
    setupEventKindLookup({ recipeHit: true });
    const { rejectEventAction } = await import("./actions");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-2", name: "session-admin", role: "ADMIN" },
    });
    rpcMock.mockResolvedValue({ error: null });

    const result = await rejectEventAction("EVENT-RECIPE-2", "spoofed-reviewer", "duplicate");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("reject_backdated_recipe_event", {
      p_event_id: "EVENT-RECIPE-2",
      p_reviewer: "session-admin",
      p_reason: "duplicate",
    });
  });
});
