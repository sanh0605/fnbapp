import { describe, expect, it } from "vitest";
import { findAffectedLines, type FindAffectedLinesInput } from "./find-affected-lines";

const event = {
  id: "event-1",
  effective_timestamp: "2026-07-04T10:00:00.000Z",
  visibility_timestamp: "2026-07-04T11:00:00.000Z",
  item_reference: "ING-001",
};

function baseInput(overrides: Partial<FindAffectedLinesInput> = {}): FindAffectedLinesInput {
  return {
    event,
    orders: [],
    lines: [],
    ledger: [],
    recipes: [],
    semiProducts: [],
    ...overrides,
  };
}

function recipe(ingredientId: string, ingredientType: "BASE_INGREDIENT" | "SEMI_PRODUCT", quantity: number): string {
  return JSON.stringify({
    variant: {
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-001",
      ingredients: [{
        ingredient_id: ingredientId,
        ingredient_type: ingredientType,
        quantity,
        unit_id: "UNT-001",
      }],
    },
    modifiers: [],
  });
}

describe("findAffectedLines", () => {
  it("returns direct ingredient consumption with product_id and qty populated", () => {
    const result = findAffectedLines(baseInput({
      orders: [{
        id: "order-1",
        order_no: "PHD000001",
        status: "COMPLETED",
        created_at: "2026-07-04T10:30:00.000Z",
      }],
      lines: [{
        id: "line-1",
        order_id: "order-1",
        product_id: "PROD-001",
        qty: 3,
        cost_at_sale: 100,
        recipe_snapshot_json: recipe("ING-001", "BASE_INGREDIENT", 2),
      }],
      ledger: [{
        id: "sale-1",
        reference_id: "order-1",
        item_reference: "ING-001",
        transaction_type: "SALES_CONSUME",
        quantity_change: -6,
        created_at: "2026-07-04T10:30:00.000Z",
      }],
    }));

    expect(result).toEqual([{
      line_id: "line-1",
      order_id: "order-1",
      order_no: "PHD000001",
      sale_time: "2026-07-04T10:30:00.000Z",
      stored_cost_at_sale: 100,
      product_id: "PROD-001",
      qty: 3,
    }]);
  });

  it("returns BTP shortfall consumption when the event item is consumed through a semi-product recipe", () => {
    const result = findAffectedLines(baseInput({
      event: { ...event, item_reference: "ING-RAW" },
      orders: [{
        id: "order-1",
        order_no: "PHD000002",
        status: "COMPLETED",
        created_at: "2026-07-04T10:30:00.000Z",
      }],
      lines: [{
        id: "line-1",
        order_id: "order-1",
        product_id: "PROD-BTP",
        qty: 1,
        cost_at_sale: 100,
        recipe_snapshot_json: recipe("BTP-001", "SEMI_PRODUCT", 5),
      }],
      ledger: [{
        id: "sale-1",
        reference_id: "order-1",
        item_reference: "ING-RAW",
        transaction_type: "SALES_CONSUME",
        quantity_change: -10,
        created_at: "2026-07-04T10:30:00.000Z",
      }],
      recipes: [{
        target_type: "SEMI_PRODUCT",
        target_id: "BTP-001",
        status: "ACTIVE",
        ingredients_json: JSON.stringify([{
          ingredient_id: "ING-RAW",
          ingredient_type: "BASE_INGREDIENT",
          quantity: 20,
          unit_id: "UNT-001",
        }]),
      }],
      semiProducts: [{ id: "BTP-001", batch_yield: 10 }],
    }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      line_id: "line-1",
      product_id: "PROD-BTP",
      qty: 1,
    });
  });

  it("returns empty when the event item was not consumed by any sold product", () => {
    const result = findAffectedLines(baseInput({
      event: { ...event, item_reference: "ING-NOT-SOLD" },
      orders: [{
        id: "order-1",
        order_no: "PHD000003",
        status: "COMPLETED",
        created_at: "2026-07-04T10:30:00.000Z",
      }],
      lines: [{
        id: "line-1",
        order_id: "order-1",
        product_id: "PROD-001",
        qty: 1,
        recipe_snapshot_json: recipe("ING-001", "BASE_INGREDIENT", 1),
      }],
      ledger: [{
        id: "sale-1",
        reference_id: "order-1",
        item_reference: "ING-001",
        transaction_type: "SALES_CONSUME",
        quantity_change: -1,
        created_at: "2026-07-04T10:30:00.000Z",
      }],
    }));

    expect(result).toEqual([]);
  });

  it("returns all matching sales in the event window sorted by sale time", () => {
    const result = findAffectedLines(baseInput({
      orders: [
        { id: "order-2", order_no: "PHD000005", status: "COMPLETED", created_at: "2026-07-04T10:45:00.000Z" },
        { id: "order-1", order_no: "PHD000004", status: "COMPLETED", created_at: "2026-07-04T10:15:00.000Z" },
      ],
      lines: [
        { id: "line-2", order_id: "order-2", product_id: "PROD-002", qty: 2, recipe_snapshot_json: recipe("ING-001", "BASE_INGREDIENT", 1) },
        { id: "line-1", order_id: "order-1", product_id: "PROD-001", qty: 1, recipe_snapshot_json: recipe("ING-001", "BASE_INGREDIENT", 1) },
      ],
      ledger: [
        { id: "sale-2", reference_id: "order-2", item_reference: "ING-001", transaction_type: "SALES_CONSUME", quantity_change: -2, created_at: "2026-07-04T10:45:00.000Z" },
        { id: "sale-1", reference_id: "order-1", item_reference: "ING-001", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: "2026-07-04T10:15:00.000Z" },
      ],
    }));

    expect(result.map(line => line.line_id)).toEqual(["line-1", "line-2"]);
  });

  it("excludes sales outside the effective-to-visibility window", () => {
    const result = findAffectedLines(baseInput({
      orders: [
        { id: "order-before", order_no: "PHD000006", status: "COMPLETED", created_at: "2026-07-04T09:59:59.000Z" },
        { id: "order-after", order_no: "PHD000007", status: "COMPLETED", created_at: "2026-07-04T11:00:01.000Z" },
      ],
      lines: [
        { id: "line-before", order_id: "order-before", product_id: "PROD-001", qty: 1, recipe_snapshot_json: recipe("ING-001", "BASE_INGREDIENT", 1) },
        { id: "line-after", order_id: "order-after", product_id: "PROD-001", qty: 1, recipe_snapshot_json: recipe("ING-001", "BASE_INGREDIENT", 1) },
      ],
      ledger: [
        { id: "sale-before", reference_id: "order-before", item_reference: "ING-001", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: "2026-07-04T09:59:59.000Z" },
        { id: "sale-after", reference_id: "order-after", item_reference: "ING-001", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: "2026-07-04T11:00:01.000Z" },
      ],
    }));

    expect(result).toEqual([]);
  });
});
