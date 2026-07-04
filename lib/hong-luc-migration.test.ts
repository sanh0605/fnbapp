import { describe, expect, it } from "vitest";
import {
  buildSnapshotMetadata,
  buildHongToLucMigrationPlan,
  parseHongToLucMigrationArgs,
  renderHongToLucDryRun,
} from "./hong-luc-migration";

describe("parseHongToLucMigrationArgs", () => {
  it("defaults to dry-run without a snapshot", () => {
    expect(parseHongToLucMigrationArgs([])).toEqual({
      snapshotId: null,
    });
  });

  it("refuses apply because this phase is dry-run only", () => {
    expect(() => parseHongToLucMigrationArgs(["--apply"])).toThrow(
      "Dry-run only",
    );
  });

  it("accepts an explicit recovery snapshot ID", () => {
    expect(parseHongToLucMigrationArgs([
      "--snapshot-id",
      "recovery-20260704T170000000Z",
    ])).toEqual({
      snapshotId: "recovery-20260704T170000000Z",
    });
  });
});

describe("buildHongToLucMigrationPlan", () => {
  it("replays the source ledger and projects target inventory and COGS", () => {
    const createdAt = "2026-06-29T00:00:00+07:00";
    const orderId = "order-1";
    const lineId = "line-1";
    const recipes = [
      {
        id: "recipe-hong-btp",
        target_type: "SEMI_PRODUCT",
        target_id: "BTP-HONG",
        ingredients_json: JSON.stringify([
          ingredient("ING-HONG", 10),
        ]),
        status: "ACTIVE",
        created_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "recipe-luc-btp",
        target_type: "SEMI_PRODUCT",
        target_id: "BTP-LUC",
        ingredients_json: JSON.stringify([
          ingredient("ING-LUC", 20),
        ]),
        status: "ACTIVE",
        created_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "REC-TARGET",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-LUC-700",
        ingredients_json: JSON.stringify([
          ingredient("BTP-LUC", 50, "SEMI_PRODUCT"),
          ingredient("ING-SUGAR", 10),
          ingredient("ING-LEMON", 1),
        ]),
        status: "ACTIVE",
        created_at: "2026-06-28T17:00:00Z",
      },
      {
        id: "REC-068",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-HONG-700",
        ingredients_json: JSON.stringify([
          ingredient("BTP-HONG", 50, "SEMI_PRODUCT"),
          ingredient("ING-SUGAR", 10),
        ]),
        status: "ACTIVE",
        created_at: "2026-06-20T00:00:00Z",
      },
    ];
    const stockLedger = [
      receipt("po-hong", "ING-HONG", 100, 2),
      receipt("po-luc", "ING-LUC", 100, 3),
      receipt("po-sugar", "ING-SUGAR", 100, 1),
      receipt("po-lemon", "ING-LEMON", 100, 4),
      {
        ...consume(orderId, "ING-HONG", 5, createdAt),
        source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-HONG",
      },
      consume(orderId, "ING-SUGAR", 10, createdAt),
    ];

    const plan = buildHongToLucMigrationPlan({
      cutoff: createdAt,
      migrationKey: "TEST-MIGRATION",
      sourceProductId: "PROD-HONG",
      targetProductId: "PROD-LUC",
      corruptRecipeId: "REC-068",
      expectedTargetRecipeId: "REC-TARGET",
      expectedOrderNumbers: ["ORDER-1"],
      products: [
        { id: "PROD-HONG", name: "Hồng trà chanh", status: "ACTIVE" },
        { id: "PROD-LUC", name: "Lục trà chanh", status: "ACTIVE" },
      ],
      variants: [
        {
          id: "VAR-HONG-700",
          product_id: "PROD-HONG",
          size_name: "700ml",
          price: 15_000,
          status: "ACTIVE",
        },
        {
          id: "VAR-LUC-700",
          product_id: "PROD-LUC",
          size_name: "700ml",
          price: 15_000,
          status: "ACTIVE",
        },
      ],
      recipes,
      semiProducts: [
        { id: "BTP-HONG", batch_yield: 100 },
        { id: "BTP-LUC", batch_yield: 100 },
      ],
      baseIngredients: [
        { id: "ING-HONG", name: "Lá hồng trà" },
        { id: "ING-LUC", name: "Lá trà xanh" },
        { id: "ING-SUGAR", name: "Nước đường" },
        { id: "ING-LEMON", name: "Trái chanh" },
      ],
      orders: [{
        id: orderId,
        order_no: "ORDER-1",
        status: "COMPLETED",
        superseded_by: "",
        created_at: createdAt,
      }],
      orderLines: [{
        id: lineId,
        order_id: orderId,
        line_no: 1,
        product_id: "PROD-HONG",
        product_snapshot_json: JSON.stringify({
          id: "PROD-HONG",
          name: "Hồng trà chanh",
        }),
        variant_id: "VAR-HONG-700",
        variant_snapshot_json: JSON.stringify({
          id: "VAR-HONG-700",
          size_name: "700ml",
          price: 15_000,
        }),
        qty: 1,
        unit_price: 15_000,
        gross_line_total: 15_000,
        net_line_total: 15_000,
        cost_at_sale: 20,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-HONG-700",
            ingredients: [
              ingredient("BTP-HONG", 50, "SEMI_PRODUCT"),
              ingredient("ING-SUGAR", 10),
            ],
          },
          modifiers: [],
        }),
      }],
      stockLedger,
    });

    expect(plan.summary).toMatchObject({
      affectedOrders: 1,
      affectedLines: 1,
      affectedUnits: 1,
      mappedUnits: 1,
      sourceLedgerRows: 2,
      sourceReplayMismatchItems: 0,
      storedCogs: 20,
      projectedCogs: 44,
      cogsDelta: 24,
    });
    expect(plan.lines[0]).toMatchObject({
      orderNo: "ORDER-1",
      lineId,
      sourceVariantId: "VAR-HONG-700",
      targetVariantId: "VAR-LUC-700",
      targetRecipeId: "REC-TARGET",
      sourceUnitPrice: 15_000,
      targetCatalogPrice: 15_000,
      priceUnchanged: true,
    });
    expect(plan.inventoryDeltas).toEqual([
      expect.objectContaining({ itemReference: "ING-HONG", quantity: 5 }),
      expect.objectContaining({ itemReference: "ING-LEMON", quantity: -1 }),
      expect.objectContaining({ itemReference: "ING-LUC", quantity: -10 }),
    ]);
    expect(plan.corruptRecipe).toMatchObject({
      id: "REC-068",
      directSnapshotReferences: 0,
    });
    expect(plan.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("selects normalized snapshot names but excludes drafts and pre-cutoff orders", () => {
    const cutoff = "2026-06-29T00:00:00+07:00";
    const plan = buildHongToLucMigrationPlan({
      cutoff,
      migrationKey: "TEST-MIGRATION",
      sourceProductId: "PROD-HONG",
      targetProductId: "PROD-LUC",
      corruptRecipeId: "REC-068",
      expectedTargetRecipeId: "REC-TARGET",
      expectedOrderNumbers: ["ORDER-NAME"],
      products: [
        { id: "PROD-HONG", name: "Hồng trà chanh", status: "ACTIVE" },
        { id: "PROD-LUC", name: "Lục trà chanh", status: "ACTIVE" },
      ],
      variants: [
        { id: "VAR-HONG", product_id: "PROD-HONG", size_name: "700ml", price: 15_000, status: "ACTIVE" },
        { id: "VAR-LUC", product_id: "PROD-LUC", size_name: "700ml", price: 15_000, status: "ACTIVE" },
      ],
      recipes: [{
        id: "REC-TARGET",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-LUC",
        ingredients_json: "[]",
        status: "ACTIVE",
        created_at: "2026-06-28T17:00:00Z",
      }, {
        id: "REC-068",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-HONG",
        ingredients_json: "[]",
        status: "ACTIVE",
        created_at: "2026-06-20T00:00:00Z",
      }],
      semiProducts: [],
      baseIngredients: [],
      orders: [
        order("order-name", "ORDER-NAME", "COMPLETED", cutoff),
        order("order-draft", "ORDER-DRAFT", "DRAFT", cutoff),
        order("order-old", "ORDER-OLD", "COMPLETED", "2026-06-28T16:59:59Z"),
      ],
      orderLines: [
        emptyLine("line-name", "order-name", "OTHER", "Hồng  trà chanh"),
        emptyLine("line-draft", "order-draft", "PROD-HONG", "Hồng trà chanh"),
        emptyLine("line-old", "order-old", "PROD-HONG", "Hồng trà chanh"),
      ],
      stockLedger: [],
    });

    expect(plan.summary).toMatchObject({
      affectedOrders: 1,
      affectedLines: 1,
      affectedUnits: 1,
    });
    expect(plan.lines.map(line => line.lineId)).toEqual(["line-name"]);
  });

  it("compares source ledger replay by item reference and source", () => {
    const input = minimalPlanInput();
    input.orderLines[0].recipe_snapshot_json = JSON.stringify({
      variant: {
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-HONG",
        ingredients: [ingredient("ING-X", 1)],
      },
      modifiers: [{
        modifier_id: "MOD-X",
        modifier_qty: 1,
        recipe: {
          ingredients: [ingredient("ING-X", 1)],
        },
      }],
    });
    input.stockLedger = [{
      ...consume("order-1", "ING-X", 2, input.cutoff),
      source: "VARIANT_RECIPE",
    }];

    expect(() => buildHongToLucMigrationPlan(input)).toThrow(
      "Source ledger replay has 2 mismatch",
    );
  });

  it("uses the semi-product recipe fallback when the consumed BTP has no direct MAC", () => {
    const input = minimalPlanInput();
    input.recipes.unshift({
      id: "REC-BTP-LUC",
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-LUC",
      ingredients_json: JSON.stringify([ingredient("ING-LUC", 20)]),
      status: "ACTIVE",
      created_at: "2026-06-01T00:00:00Z",
    });
    input.recipes[1].ingredients_json = JSON.stringify([
      ingredient("BTP-LUC", 50, "SEMI_PRODUCT"),
    ]);
    input.semiProducts = [{ id: "BTP-LUC", batch_yield: 100 }];
    input.baseIngredients = [{ id: "ING-LUC", name: "Lá trà xanh" }];
    input.stockLedger = [
      receipt("po-luc", "ING-LUC", 100, 3),
      {
        id: "yield-luc",
        item_reference: "BTP-LUC",
        transaction_type: "PRODUCTION_YIELD",
        quantity_change: 100,
        unit_cost: 0,
        reference_id: "production-luc",
        created_at: "2026-06-20T00:00:00Z",
      },
    ];

    const plan = buildHongToLucMigrationPlan(input);

    expect(plan.lines[0].projectedCogs).toBe(30);
  });

  it("rejects a target recipe outside the reviewed recipe ID", () => {
    const input = minimalPlanInput();
    input.expectedTargetRecipeId = "REC-098";

    expect(() => buildHongToLucMigrationPlan(input)).toThrow(
      "Expected target recipe REC-098",
    );
  });

  it("rejects a target recipe without an explicit effective timestamp", () => {
    const input = minimalPlanInput();
    delete input.recipes[0].created_at;

    expect(() => buildHongToLucMigrationPlan(input)).toThrow(
      "has no valid effective timestamp",
    );
  });
});

describe("dry-run output contract", () => {
  it("computes the manifest SHA-256 for an explicit verified snapshot", () => {
    const sourceHash = "a".repeat(64);
    const metadata = buildSnapshotMetadata(
      "recovery-20260704T170000000Z",
      `{"runId":"recovery-20260704T170000000Z","sourceHash":"${sourceHash}"}\n`,
      true,
      sourceHash,
    );

    expect(metadata).toEqual({
      id: "recovery-20260704T170000000Z",
      manifestSha256:
        "3c7a02860ee45ac8d7ebaad97d3e95b0f325d17faaa517a9a898ac21d936e1af",
      verified: true,
    });
  });

  it("rejects a verified snapshot captured from a different source plan", () => {
    expect(() => buildSnapshotMetadata(
      "recovery-20260704T170000000Z",
      `{"runId":"recovery-20260704T170000000Z","sourceHash":"${"b".repeat(64)}"}\n`,
      true,
      "a".repeat(64),
    )).toThrow("sourceHash");
  });

  it("renders the required migration gates and pending snapshot state", () => {
    const output = renderHongToLucDryRun({
      migrationKey: "HONG_TO_LUC_2026-06-29_V1",
      cutoff: "2026-06-29T00:00:00+07:00",
      cutoffUtc: "2026-06-28T17:00:00.000Z",
      sourceHash: "a".repeat(64),
      summary: {
        affectedOrders: 4,
        affectedLines: 4,
        affectedUnits: 5,
        mappedUnits: 5,
        sourceLedgerRows: 29,
        sourceReplayMismatchItems: 0,
        storedCogs: 20_923,
        projectedCogs: 11_370,
        cogsDelta: -9_553,
        unchangedCommercialLines: 4,
      },
      orders: [],
      lines: [],
      inventoryDeltas: [],
      corruptRecipe: {
        id: "REC-068",
        fingerprint: "b".repeat(64),
        directSnapshotReferences: 0,
        row: {},
      },
    }, null);

    expect(output).toContain("DRY RUN ONLY");
    expect(output).toContain("2026-06-29T00:00:00+07:00");
    expect(output).toContain("Affected: 4 orders / 4 lines / 5 drinks");
    expect(output).toContain("Size coverage: 5/5");
    expect(output).toContain("Source ledger: 29 rows / 0 replay mismatch items");
    expect(output).toContain("COGS: 20,923 -> 11,370 VND (delta -9,553)");
    expect(output).toContain("Snapshot ID: PENDING");
    expect(output).toContain("Manifest SHA-256: PENDING");
    expect(output).toContain("--apply is not implemented");
  });
});

function ingredient(
  ingredientId: string,
  quantity: number,
  ingredientType = "BASE_INGREDIENT",
) {
  return {
    ingredient_id: ingredientId,
    ingredient_type: ingredientType,
    quantity,
    unit_id: "",
  };
}

function receipt(id: string, itemReference: string, quantity: number, unitCost: number) {
  return {
    id,
    item_reference: itemReference,
    transaction_type: "PO_RECEIPT",
    quantity_change: quantity,
    unit_cost: unitCost,
    reference_id: id,
    created_at: "2026-06-01T00:00:00Z",
  };
}

function consume(orderId: string, itemReference: string, quantity: number, createdAt: string) {
  return {
    id: `${orderId}-${itemReference}`,
    item_reference: itemReference,
    transaction_type: "SALES_CONSUME",
    quantity_change: -quantity,
    unit_cost: 0,
    reference_id: orderId,
    created_at: createdAt,
    source: "VARIANT_RECIPE",
  };
}

function order(
  id: string,
  orderNo: string,
  status: string,
  createdAt: string,
) {
  return {
    id,
    order_no: orderNo,
    status,
    superseded_by: "",
    created_at: createdAt,
  };
}

function emptyLine(
  id: string,
  orderId: string,
  productId: string,
  productName: string,
) {
  return {
    id,
    order_id: orderId,
    line_no: 1,
    product_id: productId,
    product_snapshot_json: JSON.stringify({
      id: productId,
      name: productName,
    }),
    variant_id: "VAR-HONG",
    variant_snapshot_json: JSON.stringify({
      id: "VAR-HONG",
      size_name: "700ml",
      price: 15_000,
    }),
    qty: 1,
    unit_price: 15_000,
    gross_line_total: 15_000,
    net_line_total: 15_000,
    cost_at_sale: 0,
    recipe_snapshot_json: JSON.stringify({
      variant: {
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-HONG",
        ingredients: [],
      },
      modifiers: [],
    }),
  };
}

function minimalPlanInput(): any {
  const cutoff = "2026-06-29T00:00:00+07:00";
  return {
    cutoff,
    migrationKey: "TEST-MIGRATION",
    sourceProductId: "PROD-HONG",
    targetProductId: "PROD-LUC",
    corruptRecipeId: "REC-068",
    expectedTargetRecipeId: "REC-TARGET",
    expectedOrderNumbers: ["ORDER-1"],
    products: [
      { id: "PROD-HONG", name: "Hồng trà chanh", status: "ACTIVE" },
      { id: "PROD-LUC", name: "Lục trà chanh", status: "ACTIVE" },
    ],
    variants: [
      {
        id: "VAR-HONG",
        product_id: "PROD-HONG",
        size_name: "700ml",
        price: 15_000,
        status: "ACTIVE",
      },
      {
        id: "VAR-LUC",
        product_id: "PROD-LUC",
        size_name: "700ml",
        price: 15_000,
        status: "ACTIVE",
      },
    ],
    recipes: [
      {
        id: "REC-TARGET",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-LUC",
        ingredients_json: "[]",
        status: "ACTIVE",
        created_at: "2026-06-28T17:00:00Z",
      },
      {
        id: "REC-068",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-HONG",
        ingredients_json: "[]",
        status: "ACTIVE",
        created_at: "2026-06-20T00:00:00Z",
      },
    ],
    semiProducts: [],
    baseIngredients: [],
    orders: [order("order-1", "ORDER-1", "COMPLETED", cutoff)],
    orderLines: [emptyLine(
      "line-1",
      "order-1",
      "PROD-HONG",
      "Hồng trà chanh",
    )],
    stockLedger: [],
  };
}
