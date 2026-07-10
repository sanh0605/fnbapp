import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  findAllNoCache: vi.fn(),
}));

vi.mock("../supabase", () => ({
  getSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

vi.mock("../sheets_db", () => ({
  findAllNoCache: mocks.findAllNoCache,
}));

import {
  recomputeEventApply,
  recomputeEventDryRun,
} from "./recompute-event";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const migration0015 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0015_backdated_event_recompute.sql"),
  "utf8",
).toLowerCase();

function setupSupabaseEvent(): void {
  mocks.single.mockResolvedValue({
    data: {
      id: EVENT_ID,
      effective_timestamp: "2026-07-04T10:00:00.000Z",
      visibility_timestamp: "2026-07-04T11:00:00.000Z",
      item_reference: "ING-001",
      status: "PENDING",
    },
    error: null,
  });
  mocks.eq.mockReturnValue({ single: mocks.single });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
}

function setupRows(storedCost = 10): void {
  const rowsBySheet: Record<string, unknown[]> = {
    Orders_V2: [{
      id: "order-1",
      order_no: "PHD000001",
      status: "COMPLETED",
      created_at: "2026-07-04T10:30:00.000Z",
    }],
    Order_Lines_V2: [{
      id: "line-1",
      order_id: "order-1",
      product_id: "PROD-001",
      qty: 2,
      cost_at_sale: storedCost,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          ingredients: [{
            ingredient_id: "ING-001",
            ingredient_type: "BASE_INGREDIENT",
            quantity: 1,
            unit_id: "UNT-001",
          }],
        },
        modifiers: [],
      }),
    }],
    Stock_Ledger: [
      {
        id: "receipt-1",
        reference_id: "PO-001",
        item_reference: "ING-001",
        transaction_type: "PO_RECEIPT",
        quantity_change: 10,
        unit_cost: 7,
        created_at: "2026-07-04T10:05:00.000Z",
      },
      {
        id: "sale-1",
        reference_id: "order-1",
        item_reference: "ING-001",
        transaction_type: "SALES_CONSUME",
        quantity_change: -2,
        created_at: "2026-07-04T10:30:00.000Z",
      },
    ],
    Recipes: [],
    Semi_Products: [],
  };

  mocks.findAllNoCache.mockImplementation((sheetName: string) => Promise.resolve(rowsBySheet[sheetName] || []));
}

describe("backdated event recompute pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseEvent();
    setupRows();
  });

  it("dry-run produces a plan with affected lines and a stable source hash", async () => {
    const plan = await recomputeEventDryRun(EVENT_ID);

    expect(plan).toMatchObject({
      event_id: EVENT_ID,
      run_id: `backdated-${EVENT_ID}`,
      affected_lines: [{
        line_id: "line-1",
        product_id: "PROD-001",
        qty: 2,
      }],
      changes: [{
        line_id: "line-1",
        order_id: "order-1",
        old_cost_at_sale: 10,
        new_cost_at_sale: 14,
      }],
    });
    expect(plan.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("apply calls the atomic recovery RPC and then marks the event recomputed", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_applied: false, change_count: 1 }, error: null })
      .mockResolvedValueOnce({ data: { marked_recomputed: true }, error: null });

    const result = await recomputeEventApply(EVENT_ID, "Codex");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "apply_backdated_event_recovery", {
      p_event_id: EVENT_ID,
      p_reviewer: "Codex",
      p_changes: result.changes,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "mark_backdated_event_recomputed", {
      p_event_id: EVENT_ID,
      p_reviewer: "Codex",
      p_run_id: `backdated-${EVENT_ID}`,
      p_change_count: 1,
    });
  });

  it("uses the idempotent run result and preserves the recomputed lifecycle result", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_applied: true, change_count: 0 }, error: null })
      .mockResolvedValueOnce({ data: { already_recomputed: true }, error: null });

    const result = await recomputeEventApply(EVENT_ID, "Codex");

    expect(result.apply_result).toEqual({ already_applied: true, change_count: 0 });
    expect(result.mark_result).toEqual({ already_recomputed: true });
  });

  it("sale-time replay includes the backdated effective receipt when recomputing cost", async () => {
    setupRows(10);

    const plan = await recomputeEventDryRun(EVENT_ID);

    expect(plan.changes[0]).toMatchObject({
      old_cost_at_sale: 10,
      new_cost_at_sale: 14,
    });
  });

  it("migration verifies old cost under lock before updating so mismatches roll back atomically", () => {
    expect(migration0015).toContain("for update");
    expect(migration0015).toContain("v_actual_order_id <> v_order_id or v_actual_cost <> v_old_cost");
    expect(migration0015.indexOf("raise exception 'order line % changed after planning'"))
      .toBeLessThan(migration0015.indexOf("update public.order_lines_v2"));
  });
});
