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
  update: vi.fn(),
}));

vi.mock("../supabase", () => ({
  getSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

vi.mock("../sheets_db", () => ({
  findAllNoCache: mocks.findAllNoCache,
  update: mocks.update,
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

// Hole 3 (2026-07-30 plan, Task 5 Step 4): detection previously repaired
// cost_at_sale but left the stale recipe_snapshot_json in place. These
// cases add variant_id to the affected line and a PRODUCT_VARIANT recipe
// whose ingredients differ from what the line's own snapshot says, so the
// snapshot itself -- not just the semi-product's cost -- needs repair.
function setupRowsWithStaleVariantSnapshot(): void {
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
      variant_id: "VAR-BTP",
      qty: 1,
      cost_at_sale: 100,
      // Stale: 20 units of BTP-001. The effective PRODUCT_VARIANT recipe
      // below (registered after this sale's snapshot was frozen) says 25.
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
        id: "receipt-1", reference_id: "PO-001", item_reference: "ING-001",
        transaction_type: "PO_RECEIPT", quantity_change: 1000, unit_cost: 10,
        created_at: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "yield-1", reference_id: "PROD-1", item_reference: "BTP-001",
        transaction_type: "PRODUCTION_YIELD", quantity_change: 100, unit_cost: 0,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "sale-1", reference_id: "order-1", item_reference: "BTP-001",
        transaction_type: "SALES_CONSUME", quantity_change: -20,
        created_at: "2026-07-04T10:30:00.000Z",
      },
    ],
    Recipes: [
      {
        target_type: "SEMI_PRODUCT", target_id: "BTP-001", status: "ACTIVE",
        ingredients_json: JSON.stringify([{ ingredient_id: "ING-001", ingredient_type: "BASE_INGREDIENT", quantity: 30, unit_id: "UNT-001" }]),
      },
      {
        target_type: "PRODUCT_VARIANT", target_id: "VAR-BTP", status: "ACTIVE",
        start_date: null, created_at: "2026-06-15T00:00:00.000Z", end_date: null,
        ingredients_json: JSON.stringify([{ ingredient_id: "BTP-001", ingredient_type: "SEMI_PRODUCT", quantity: 25, unit_id: "UNT-001" }]),
      },
    ],
    Semi_Products: [{ id: "BTP-001", batch_yield: 100 }],
  };

  mocks.findAllNoCache.mockImplementation((sheetName: string) => Promise.resolve(rowsBySheet[sheetName] || []));
}

describe("backdated recipe event recompute pipeline repairs the snapshot, not only cost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseEvent();
    setupRowsWithStaleVariantSnapshot();
    mocks.update.mockResolvedValue({ id: "line-1" });
  });

  it("dry-run computes cost against the repaired snapshot and reports the snapshot repair", async () => {
    const plan = await recomputeRecipeEventDryRun(EVENT_ID);

    // Repaired: 25 units of BTP-001 (unit cost 3) = 75, not the stale
    // snapshot's 20 units = 60.
    expect(plan.changes).toEqual([
      { line_id: "line-1", order_id: "order-1", old_cost_at_sale: 100, new_cost_at_sale: 75 },
    ]);
    expect(plan.snapshot_repairs).toHaveLength(1);
    expect(plan.snapshot_repairs[0].line_id).toBe("line-1");
    expect(JSON.parse(plan.snapshot_repairs[0].new_recipe_snapshot_json).variant.ingredients).toEqual([
      { ingredient_id: "BTP-001", ingredient_type: "SEMI_PRODUCT", quantity: 25, unit_id: "UNT-001" },
    ]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("apply writes the repaired snapshot before calling the cost recovery RPC", async () => {
    const callOrder: string[] = [];
    mocks.update.mockImplementation(async () => { callOrder.push("update"); return { id: "line-1" }; });
    mocks.rpc.mockImplementation(async (fn: string) => {
      callOrder.push(fn);
      if (fn === "apply_backdated_recipe_event_recovery") return { data: { already_applied: false, change_count: 1 }, error: null };
      return { data: { marked_recomputed: true }, error: null };
    });

    await recomputeRecipeEventApply(EVENT_ID, "Claude");

    expect(mocks.update).toHaveBeenCalledWith(
      "Order_Lines_V2",
      "line-1",
      { recipe_snapshot_json: expect.stringContaining('"quantity":25') },
    );
    expect(callOrder).toEqual(["update", "apply_backdated_recipe_event_recovery", "mark_backdated_recipe_event_recomputed"]);
  });
});
