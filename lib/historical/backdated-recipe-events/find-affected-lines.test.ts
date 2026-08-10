import { describe, expect, it } from "vitest";
import { findAffectedRecipeLines, type FindAffectedRecipeLinesInput } from "./find-affected-lines";

const event = {
  id: "event-1",
  target_type: "SEMI_PRODUCT",
  target_id: "BTP-001",
  effective_timestamp: "2026-07-04T10:00:00.000Z",
  visibility_timestamp: "2026-07-04T11:00:00.000Z",
};

function baseInput(overrides: Partial<FindAffectedRecipeLinesInput> = {}): FindAffectedRecipeLinesInput {
  return {
    event,
    orders: [],
    lines: [],
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

describe("findAffectedRecipeLines", () => {
  it("returns a line whose variant recipe references the changed semi-product", () => {
    const result = findAffectedRecipeLines(baseInput({
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
        qty: 2,
        cost_at_sale: 100,
        recipe_snapshot_json: recipe("BTP-001", "SEMI_PRODUCT", 20),
      }],
    }));

    expect(result).toEqual([{
      line_id: "line-1",
      order_id: "order-1",
      order_no: "PHD000001",
      sale_time: "2026-07-04T10:30:00.000Z",
      stored_cost_at_sale: 100,
      product_id: "PROD-001",
      qty: 2,
    }]);
  });

  it("returns a line referencing the semi-product only through a modifier recipe", () => {
    const result = findAffectedRecipeLines(baseInput({
      orders: [{
        id: "order-1",
        order_no: "PHD000002",
        status: "COMPLETED",
        created_at: "2026-07-04T10:30:00.000Z",
      }],
      lines: [{
        id: "line-1",
        order_id: "order-1",
        product_id: "PROD-002",
        qty: 1,
        cost_at_sale: 50,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-002",
            ingredients: [{ ingredient_id: "ING-999", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "UNT-001" }],
          },
          modifiers: [{
            modifier_id: "MOD-001",
            modifier_name: "Extra",
            modifier_qty: 1,
            recipe: {
              target_type: "MODIFIER",
              target_id: "MOD-001",
              ingredients: [{ ingredient_id: "BTP-001", ingredient_type: "SEMI_PRODUCT", quantity: 10, unit_id: "UNT-001" }],
            },
          }],
        }),
      }],
    }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line_id: "line-1", product_id: "PROD-002" });
  });

  it("returns empty when no line's recipe references the event's semi-product", () => {
    const result = findAffectedRecipeLines(baseInput({
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
        recipe_snapshot_json: recipe("BTP-999", "SEMI_PRODUCT", 20),
      }],
    }));

    expect(result).toEqual([]);
  });

  it("does not flag a line where the target id appears as a BASE_INGREDIENT, not a SEMI_PRODUCT", () => {
    const result = findAffectedRecipeLines(baseInput({
      orders: [{
        id: "order-1",
        order_no: "PHD000004",
        status: "COMPLETED",
        created_at: "2026-07-04T10:30:00.000Z",
      }],
      lines: [{
        id: "line-1",
        order_id: "order-1",
        product_id: "PROD-001",
        qty: 1,
        recipe_snapshot_json: recipe("BTP-001", "BASE_INGREDIENT", 20),
      }],
    }));

    expect(result).toEqual([]);
  });

  it("excludes sales outside the effective-to-visibility window", () => {
    const result = findAffectedRecipeLines(baseInput({
      orders: [
        { id: "order-before", order_no: "PHD000005", status: "COMPLETED", created_at: "2026-07-04T09:59:59.000Z" },
        { id: "order-after", order_no: "PHD000006", status: "COMPLETED", created_at: "2026-07-04T11:00:01.000Z" },
      ],
      lines: [
        { id: "line-before", order_id: "order-before", product_id: "PROD-001", qty: 1, recipe_snapshot_json: recipe("BTP-001", "SEMI_PRODUCT", 20) },
        { id: "line-after", order_id: "order-after", product_id: "PROD-001", qty: 1, recipe_snapshot_json: recipe("BTP-001", "SEMI_PRODUCT", 20) },
      ],
    }));

    expect(result).toEqual([]);
  });

  it("returns all matching sales in the event window sorted by sale time", () => {
    const result = findAffectedRecipeLines(baseInput({
      orders: [
        { id: "order-2", order_no: "PHD000008", status: "COMPLETED", created_at: "2026-07-04T10:45:00.000Z" },
        { id: "order-1", order_no: "PHD000007", status: "COMPLETED", created_at: "2026-07-04T10:15:00.000Z" },
      ],
      lines: [
        { id: "line-2", order_id: "order-2", product_id: "PROD-002", qty: 2, recipe_snapshot_json: recipe("BTP-001", "SEMI_PRODUCT", 20) },
        { id: "line-1", order_id: "order-1", product_id: "PROD-001", qty: 1, recipe_snapshot_json: recipe("BTP-001", "SEMI_PRODUCT", 20) },
      ],
    }));

    expect(result.map(line => line.line_id)).toEqual(["line-1", "line-2"]);
  });
});
