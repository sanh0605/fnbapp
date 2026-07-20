import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recomputeEventDryRun: vi.fn(),
  recomputeEventApply: vi.fn(),
  recomputeRecipeEventDryRun: vi.fn(),
  recomputeRecipeEventApply: vi.fn(),
  updateEq: vi.fn(),
  update: vi.fn(),
  selectEq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/backdated-ledger/recompute-event", () => ({
  recomputeEventDryRun: mocks.recomputeEventDryRun,
  recomputeEventApply: mocks.recomputeEventApply,
}));
vi.mock("@/lib/backdated-recipe-events/recompute-event", () => ({
  recomputeRecipeEventDryRun: mocks.recomputeRecipeEventDryRun,
  recomputeRecipeEventApply: mocks.recomputeRecipeEventApply,
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mocks.from }),
}));

import { GET } from "./route";

function request(secret: string | null): Request {
  const headers: Record<string, string> = {};
  if (secret !== null) headers.authorization = `Bearer ${secret}`;
  return new Request("https://fnb.example/api/cron/apply-backdated-corrections", { headers });
}

describe("GET /api/cron/apply-backdated-corrections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";

    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.updateEq });
    mocks.selectEq.mockResolvedValue({ data: [], error: null });
    mocks.select.mockReturnValue({ eq: mocks.selectEq });
    mocks.from.mockReturnValue({ select: mocks.select, update: mocks.update });
  });

  it("rejects requests without the correct cron secret", async () => {
    const response = await GET(request("wrong-secret"));
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects requests with no authorization header at all", async () => {
    const response = await GET(request(null));
    expect(response.status).toBe(401);
  });

  it("auto-applies a routine ledger event with no anomaly", async () => {
    mocks.selectEq.mockImplementation(() => {
      const table = mocks.from.mock.calls[mocks.from.mock.calls.length - 1][0];
      if (table === "backdated_ledger_events") {
        return Promise.resolve({ data: [{ id: "event-1" }], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    mocks.recomputeEventDryRun.mockResolvedValue({
      changes: [{ line_id: "line-1", old_cost_at_sale: 4591, new_cost_at_sale: 4640 }],
    });
    mocks.recomputeEventApply.mockResolvedValue({});

    const response = await GET(request("test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.recomputeEventApply).toHaveBeenCalledWith("event-1", "system-auto");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(body).toMatchObject({ total_events: 1, applied: 1, flagged: 0 });
  });

  it("flags an anomalous recipe event instead of applying it", async () => {
    mocks.selectEq.mockImplementation(() => {
      const table = mocks.from.mock.calls[mocks.from.mock.calls.length - 1][0];
      if (table === "backdated_recipe_events") {
        return Promise.resolve({ data: [{ id: "event-2" }], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    mocks.recomputeRecipeEventDryRun.mockResolvedValue({
      changes: [{ line_id: "line-1", old_cost_at_sale: 10000, new_cost_at_sale: 40000 }],
    });

    const response = await GET(request("test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.recomputeRecipeEventApply).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ is_anomalous: true }));
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "event-2");
    expect(body).toMatchObject({ total_events: 1, applied: 0, flagged: 1 });
  });

  it("records a no_change outcome without applying or flagging when the plan has no changes", async () => {
    mocks.selectEq.mockImplementation(() => {
      const table = mocks.from.mock.calls[mocks.from.mock.calls.length - 1][0];
      if (table === "backdated_ledger_events") {
        return Promise.resolve({ data: [{ id: "event-3" }], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    mocks.recomputeEventDryRun.mockResolvedValue({ changes: [] });

    const response = await GET(request("test-secret"));
    const body = await response.json();

    expect(mocks.recomputeEventApply).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(body).toMatchObject({ total_events: 1, applied: 0, flagged: 0, no_change: 1 });
  });
});
