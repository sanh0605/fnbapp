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
  recomputeRecipeEventApply,
  recomputeRecipeEventDryRun,
} from "./recompute-event";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const migration0029 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0029_backdated_recipe_event_recompute.sql"),
  "utf8",
).toLowerCase();

function setupSupabaseEvent(): void {
  mocks.single.mockResolvedValue({
    data: {
      id: EVENT_ID,
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      effective_timestamp: "2026-07-04T10:00:00.000Z",
      visibility_timestamp: "2026-07-04T11:00:00.000Z",
      status: "PENDING",
    },
    error: null,
  });
  mocks.eq.mockReturnValue({ single: mocks.single });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
}

function setupRows(storedCost = 100): void {
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
      product_id: "PROD-BTP",
      qty: 1,
      cost_at_sale: storedCost,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-BTP",
          ingredients: [{
            ingredient_id: "BTP-001",
            ingredient_type: "SEMI_PRODUCT",
            quantity: 20,
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
        quantity_change: 1000,
        unit_cost: 10,
        created_at: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "yield-1",
        reference_id: "PROD-1",
        item_reference: "BTP-001",
        transaction_type: "PRODUCTION_YIELD",
        quantity_change: 100,
        unit_cost: 0,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "sale-1",
        reference_id: "order-1",
        item_reference: "BTP-001",
        transaction_type: "SALES_CONSUME",
        quantity_change: -20,
        created_at: "2026-07-04T10:30:00.000Z",
      },
    ],
    Recipes: [{
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      status: "ACTIVE",
      ingredients_json: JSON.stringify([{
        ingredient_id: "ING-001",
        ingredient_type: "BASE_INGREDIENT",
        quantity: 30,
        unit_id: "UNT-001",
      }]),
    }],
    Semi_Products: [{ id: "BTP-001", batch_yield: 100 }],
  };

  mocks.findAllNoCache.mockImplementation((sheetName: string) => Promise.resolve(rowsBySheet[sheetName] || []));
}

describe("backdated recipe event recompute pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseEvent();
    setupRows();
  });

  it("dry-run produces a plan with affected lines, a correctly recomputed cost, and a stable source hash", async () => {
    const plan = await recomputeRecipeEventDryRun(EVENT_ID);

    expect(plan).toMatchObject({
      event_id: EVENT_ID,
      run_id: `backdated-recipe-${EVENT_ID}`,
      affected_lines: [{
        line_id: "line-1",
        product_id: "PROD-BTP",
        qty: 1,
      }],
      // BTP-001 recipe fallback: ING-001 30/100 per unit, MAC(ING-001) = 10
      // (single PO_RECEIPT) => BTP-001 unit cost = 30/100*10 = 3; 20 units
      // sold = 60. Stored cost_at_sale was 100 (setupRows default), so this
      // is a real, non-trivial recomputed change, not a no-op.
      changes: [{ line_id: "line-1", order_id: "order-1", old_cost_at_sale: 100, new_cost_at_sale: 60 }],
    });
    expect(plan.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("apply calls the atomic recovery RPC and then marks the event recomputed", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_applied: false, change_count: 1 }, error: null })
      .mockResolvedValueOnce({ data: { marked_recomputed: true }, error: null });

    const result = await recomputeRecipeEventApply(EVENT_ID, "Claude");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "apply_backdated_recipe_event_recovery", {
      p_event_id: EVENT_ID,
      p_reviewer: "Claude",
      p_changes: result.changes,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "mark_backdated_recipe_event_recomputed", {
      p_event_id: EVENT_ID,
      p_reviewer: "Claude",
      p_run_id: `backdated-recipe-${EVENT_ID}`,
      p_change_count: result.changes.length,
    });
  });

  it("uses the idempotent run result and preserves the recomputed lifecycle result", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_applied: true, change_count: 0 }, error: null })
      .mockResolvedValueOnce({ data: { already_recomputed: true }, error: null });

    const result = await recomputeRecipeEventApply(EVENT_ID, "Claude");

    expect(result.apply_result).toEqual({ already_applied: true, change_count: 0 });
    expect(result.mark_result).toEqual({ already_recomputed: true });
  });

  it("migration reuses the existing data_recovery_changes audit table and verifies old cost under lock", () => {
    expect(migration0029).toContain("for update");
    expect(migration0029).toContain("v_actual_order_id <> v_order_id or v_actual_cost <> v_old_cost");
    expect(migration0029).toContain("insert into public.data_recovery_changes");
    expect(migration0029).toContain("set search_path = public, extensions");
    expect(migration0029).toContain("create or replace function public.reject_backdated_recipe_event");
  });
});
