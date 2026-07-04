import { createHash } from "node:crypto";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "./inventory-consumption";
import {
  computeMacCostForConsumptionRows,
  createMacLedgerIndex,
} from "./mac-cogs";
import {
  parseLineRecipeSnapshot,
  type LineRecipeSnapshot,
} from "./order-types";
import { selectEffectiveRecipe } from "./recipe-selection";

type Row = Record<string, any>;

export type HongToLucMigrationInput = {
  cutoff: string;
  migrationKey: string;
  sourceProductId: string;
  targetProductId: string;
  corruptRecipeId: string;
  expectedOrderNumbers: string[];
  products: Row[];
  variants: Row[];
  recipes: Row[];
  semiProducts: Row[];
  baseIngredients: Row[];
  orders: Row[];
  orderLines: Row[];
  stockLedger: Row[];
};

export type HongToLucMigrationPlan = {
  migrationKey: string;
  cutoff: string;
  cutoffUtc: string;
  sourceHash: string;
  summary: {
    affectedOrders: number;
    affectedLines: number;
    affectedUnits: number;
    mappedUnits: number;
    sourceLedgerRows: number;
    sourceReplayMismatchItems: number;
    storedCogs: number;
    projectedCogs: number;
    cogsDelta: number;
    unchangedCommercialLines: number;
  };
  orders: Array<{
    orderNo: string;
    orderId: string;
    createdAt: string;
    sourceLedgerRows: number;
    replayMismatchItems: Array<{
      itemReference: string;
      storedQuantity: number;
      rebuiltQuantity: number;
    }>;
  }>;
  lines: Array<{
    orderNo: string;
    orderId: string;
    lineId: string;
    quantity: number;
    sizeName: string;
    sourceProductId: string;
    targetProductId: string;
    sourceVariantId: string;
    targetVariantId: string;
    targetRecipeId: string;
    sourceUnitPrice: number;
    targetCatalogPrice: number;
    priceUnchanged: boolean;
    commercialTotalsUnchanged: boolean;
    storedCogs: number;
    projectedCogs: number;
    cogsDelta: number;
    sourceIngredients: unknown[];
    targetIngredients: unknown[];
  }>;
  inventoryDeltas: Array<{
    itemReference: string;
    itemName: string;
    quantity: number;
    currentBalance: number;
    projectedBalance: number;
  }>;
  corruptRecipe: {
    id: string;
    fingerprint: string;
    directSnapshotReferences: number;
    row: Row;
  };
};

export type RecoverySnapshotMetadata = {
  id: string;
  manifestSha256: string;
  verified: boolean;
};

export function parseHongToLucMigrationArgs(args: string[]): {
  snapshotId: string | null;
} {
  if (args.includes("--apply")) {
    throw new Error(
      "Dry-run only: this phase does not contain an apply implementation.",
    );
  }
  const snapshotIndex = args.indexOf("--snapshot-id");
  if (snapshotIndex === -1) return { snapshotId: null };
  const snapshotId = args[snapshotIndex + 1] || "";
  if (!/^recovery-\d{8}T\d{9}Z$/.test(snapshotId)) {
    throw new Error("Invalid or missing --snapshot-id value.");
  }
  return { snapshotId };
}

export function buildHongToLucMigrationPlan(
  input: HongToLucMigrationInput,
): HongToLucMigrationPlan {
  const cutoffMs = new Date(input.cutoff).getTime();
  if (!Number.isFinite(cutoffMs)) {
    throw new Error(`Invalid cutoff: ${input.cutoff}`);
  }

  const sourceProduct = requireRow(
    input.products,
    input.sourceProductId,
    "source product",
  );
  const targetProduct = requireRow(
    input.products,
    input.targetProductId,
    "target product",
  );
  const corruptRecipe = requireRow(
    input.recipes,
    input.corruptRecipeId,
    "corrupt recipe",
  );
  const normalizedRecipes = input.recipes.map(normalizeRecipe);
  const orderById = new Map(input.orders.map(order => [order.id, order]));
  const sourceName = normalizeName(sourceProduct.name);
  const affectedLines = input.orderLines.filter(line => {
    const order = orderById.get(line.order_id);
    if (
      !order ||
      order.status !== "COMPLETED" ||
      new Date(order.created_at).getTime() < cutoffMs
    ) {
      return false;
    }
    const snapshot = parseObject(line.product_snapshot_json);
    return line.product_id === input.sourceProductId ||
      normalizeName(snapshot.name) === sourceName;
  });
  if (affectedLines.length === 0) {
    throw new Error("No qualifying Hồng trà chanh order lines found.");
  }

  const affectedOrderIds = new Set(affectedLines.map(line => line.order_id));
  const affectedOrders = input.orders
    .filter(order => affectedOrderIds.has(order.id))
    .sort(compareCreatedThenId);
  for (const order of affectedOrders) {
    if (String(order.superseded_by || "")) {
      throw new Error(`Affected order ${order.order_no} is superseded.`);
    }
  }
  assertReviewedOrderSet(affectedOrders, input.expectedOrderNumbers);

  const names = new Map(
    [...input.baseIngredients, ...input.semiProducts]
      .map(item => [String(item.id), String(item.name || "")]),
  );
  const affectedLineIds = new Set(affectedLines.map(line => line.id));
  const macIndex = createMacLedgerIndex(input.stockLedger);
  const currentBalances = buildInventoryBalances(input.stockLedger);
  const totalOldLedger = new Map<string, number>();
  const totalNewLedger = new Map<string, number>();
  const planLines: HongToLucMigrationPlan["lines"] = [];
  const planOrders: HongToLucMigrationPlan["orders"] = [];
  let sourceLedgerRows = 0;
  let sourceReplayMismatchItems = 0;
  let storedCogs = 0;
  let projectedCogs = 0;

  for (const order of affectedOrders) {
    const orderLines = input.orderLines
      .filter(line => line.order_id === order.id)
      .sort((left, right) => (
        Number(left.line_no) - Number(right.line_no) ||
        String(left.id).localeCompare(String(right.id))
      ));
    const ledgerBeforeOrder = input.stockLedger.filter(
      row => row.reference_id !== order.id,
    );
    const oldBalances = buildInventoryBalances(
      ledgerBeforeOrder,
      order.created_at,
    );
    const newBalances = new Map(oldBalances);
    const consumptionMaps = buildSemiProductRecipeMaps(
      normalizedRecipes,
      input.semiProducts,
      order.created_at,
    );
    const rebuiltOldRows: ConsumptionRow[] = [];
    const rebuiltNewRows: ConsumptionRow[] = [];

    for (const line of orderLines) {
      const sourceRecipe = parseLineRecipeSnapshot(
        stringifyJson(line.recipe_snapshot_json, {}),
      );
      const oldRows = buildLineConsumptionRows(
        sourceRecipe,
        Number(line.qty),
        oldBalances,
        consumptionMaps,
      );
      rebuiltOldRows.push(...oldRows);

      let targetRecipeSnapshot = sourceRecipe;
      let targetVariant: Row | null = null;
      let effectiveTargetRecipe: Row | null = null;
      if (affectedLineIds.has(line.id)) {
        const sourceVariantSnapshot = parseObject(line.variant_snapshot_json);
        targetVariant = input.variants.find(variant => (
          variant.product_id === input.targetProductId &&
          variant.status === "ACTIVE" &&
          normalizeName(variant.size_name) ===
            normalizeName(sourceVariantSnapshot.size_name)
        )) || null;
        if (!targetVariant) {
          throw new Error(
            `No active target variant for line ${line.id} size ${sourceVariantSnapshot.size_name}.`,
          );
        }
        effectiveTargetRecipe = selectEffectiveRecipe(
          normalizedRecipes,
          "PRODUCT_VARIANT",
          targetVariant.id,
          order.created_at,
        );
        if (!effectiveTargetRecipe) {
          throw new Error(
            `No effective target recipe for ${targetVariant.id} at ${order.created_at}.`,
          );
        }
        targetRecipeSnapshot = replaceVariantRecipe(
          sourceRecipe,
          targetVariant.id,
          parseArray(effectiveTargetRecipe.ingredients_json),
        );
      }

      const newRows = buildLineConsumptionRows(
        targetRecipeSnapshot,
        Number(line.qty),
        newBalances,
        consumptionMaps,
      );
      rebuiltNewRows.push(...newRows);

      if (affectedLineIds.has(line.id)) {
        const sourceVariantSnapshot = parseObject(line.variant_snapshot_json);
        const nextCost = computeMacCostForConsumptionRows(
          newRows,
          macIndex,
          order.created_at,
          consumptionMaps,
        );
        const oldCost = Number(line.cost_at_sale || 0);
        const targetPrice = Number(targetVariant?.price || 0);
        const sourcePrice = Number(line.unit_price || 0);
        storedCogs += oldCost;
        projectedCogs += nextCost;
        planLines.push({
          orderNo: String(order.order_no),
          orderId: String(order.id),
          lineId: String(line.id),
          quantity: Number(line.qty),
          sizeName: String(sourceVariantSnapshot.size_name || ""),
          sourceProductId: String(line.product_id),
          targetProductId: String(targetProduct.id),
          sourceVariantId: String(line.variant_id),
          targetVariantId: String(targetVariant?.id),
          targetRecipeId: String(effectiveTargetRecipe?.id),
          sourceUnitPrice: sourcePrice,
          targetCatalogPrice: targetPrice,
          priceUnchanged: sourcePrice === targetPrice,
          commercialTotalsUnchanged: true,
          storedCogs: oldCost,
          projectedCogs: nextCost,
          cogsDelta: nextCost - oldCost,
          sourceIngredients: sourceRecipe.variant.ingredients,
          targetIngredients: targetRecipeSnapshot.variant.ingredients,
        });
      }
    }

    addQuantities(totalOldLedger, rebuiltOldRows);
    addQuantities(totalNewLedger, rebuiltNewRows);
    const storedRows = input.stockLedger
      .filter(row => (
        row.reference_id === order.id &&
        row.transaction_type === "SALES_CONSUME"
      ))
      .map(row => ({
        item_reference: String(row.item_reference || ""),
        quantity: Math.abs(Number(row.quantity_change || 0)),
        source: String(row.source || ""),
      }));
    sourceLedgerRows += storedRows.length;
    const mismatch = compareQuantityMaps(
      aggregateRows(storedRows),
      aggregateRows(rebuiltOldRows),
    );
    sourceReplayMismatchItems += mismatch.length;
    planOrders.push({
      orderNo: String(order.order_no),
      orderId: String(order.id),
      createdAt: String(order.created_at),
      sourceLedgerRows: storedRows.length,
      replayMismatchItems: mismatch,
    });
  }

  if (sourceReplayMismatchItems > 0) {
    throw new Error(
      `Source ledger replay has ${sourceReplayMismatchItems} mismatch item(s).`,
    );
  }

  const inventoryDeltas = buildInventoryDeltas(
    totalOldLedger,
    totalNewLedger,
    currentBalances,
    names,
  );
  const sourceRows = {
    migrationKey: input.migrationKey,
    cutoff: input.cutoff,
    products: [sourceProduct, targetProduct],
    variants: input.variants.filter(variant => (
      [input.sourceProductId, input.targetProductId].includes(variant.product_id)
    )),
    corruptRecipe,
    orders: affectedOrders,
    lines: input.orderLines.filter(line => affectedOrderIds.has(line.order_id)),
    ledger: input.stockLedger.filter(row => affectedOrderIds.has(row.reference_id)),
  };

  return {
    migrationKey: input.migrationKey,
    cutoff: input.cutoff,
    cutoffUtc: new Date(input.cutoff).toISOString(),
    sourceHash: sha256(canonicalStringify(sourceRows)),
    summary: {
      affectedOrders: affectedOrders.length,
      affectedLines: affectedLines.length,
      affectedUnits: sum(planLines.map(line => line.quantity)),
      mappedUnits: sum(planLines.map(line => line.quantity)),
      sourceLedgerRows,
      sourceReplayMismatchItems,
      storedCogs,
      projectedCogs,
      cogsDelta: projectedCogs - storedCogs,
      unchangedCommercialLines: planLines.filter(
        line => line.priceUnchanged && line.commercialTotalsUnchanged,
      ).length,
    },
    orders: planOrders,
    lines: planLines,
    inventoryDeltas,
    corruptRecipe: {
      id: input.corruptRecipeId,
      fingerprint: sha256(canonicalStringify(corruptRecipe)),
      directSnapshotReferences: input.orderLines.filter(
        line => stringifyJson(line.recipe_snapshot_json, {}).includes(
          input.corruptRecipeId,
        ),
      ).length,
      row: corruptRecipe,
    },
  };
}

export function buildSnapshotMetadata(
  snapshotId: string,
  manifestContent: string,
  verified: boolean,
): RecoverySnapshotMetadata {
  const manifest = JSON.parse(manifestContent) as { runId?: string };
  if (manifest.runId !== snapshotId) {
    throw new Error(
      `Snapshot manifest runId ${manifest.runId || "(missing)"} does not match ${snapshotId}.`,
    );
  }
  return {
    id: snapshotId,
    manifestSha256: sha256(manifestContent),
    verified,
  };
}

export function renderHongToLucDryRun(
  plan: HongToLucMigrationPlan,
  snapshot: RecoverySnapshotMetadata | null,
): string {
  const lines = [
    "=== HỒNG TRÀ CHANH -> LỤC TRÀ CHANH (DRY RUN ONLY) ===",
    `Migration key: ${plan.migrationKey}`,
    `Source SHA-256: ${plan.sourceHash}`,
    `Cutoff (Asia/Ho_Chi_Minh): ${plan.cutoff}`,
    `Cutoff (UTC): ${plan.cutoffUtc}`,
    `Snapshot ID: ${snapshot?.id || "PENDING"}`,
    `Manifest SHA-256: ${snapshot?.manifestSha256 || "PENDING"}`,
    `Snapshot verified: ${snapshot ? String(snapshot.verified).toUpperCase() : "PENDING"}`,
    "",
    "SUMMARY",
    `Affected: ${plan.summary.affectedOrders} orders / ${plan.summary.affectedLines} lines / ${plan.summary.affectedUnits} drinks`,
    `Size coverage: ${plan.summary.mappedUnits}/${plan.summary.affectedUnits}`,
    `Prices/commercial totals unchanged: ${plan.summary.unchangedCommercialLines}/${plan.summary.affectedLines} lines`,
    `Source ledger: ${plan.summary.sourceLedgerRows} rows / ${plan.summary.sourceReplayMismatchItems} replay mismatch items`,
    `COGS: ${formatInteger(plan.summary.storedCogs)} -> ${formatInteger(plan.summary.projectedCogs)} VND (delta ${formatSignedInteger(plan.summary.cogsDelta)})`,
    "",
    "ORDERS",
  ];

  for (const order of plan.orders) {
    lines.push(
      `${order.orderNo} | ${order.orderId} | ${formatSaigon(order.createdAt)} | ` +
      `ledger=${order.sourceLedgerRows} | replay_mismatch=${order.replayMismatchItems.length}`,
    );
  }

  lines.push("", "ORDER LINE DIFFS");
  for (const line of plan.lines) {
    lines.push(
      `${line.orderNo} | line=${line.lineId} | qty=${line.quantity} | size=${line.sizeName}`,
      `  product: ${line.sourceProductId} -> ${line.targetProductId}`,
      `  variant: ${line.sourceVariantId} -> ${line.targetVariantId}`,
      `  target recipe: ${line.targetRecipeId}`,
      `  price: ${formatInteger(line.sourceUnitPrice)} -> ${formatInteger(line.targetCatalogPrice)} VND ` +
        `[${line.priceUnchanged ? "UNCHANGED" : "CHANGED"}]`,
      `  commercial totals: ${line.commercialTotalsUnchanged ? "UNCHANGED" : "CHANGED"}`,
      `  COGS: ${formatInteger(line.storedCogs)} -> ${formatInteger(line.projectedCogs)} VND ` +
        `(delta ${formatSignedInteger(line.cogsDelta)})`,
      `  source ingredients: ${formatIngredients(line.sourceIngredients)}`,
      `  target ingredients: ${formatIngredients(line.targetIngredients)}`,
    );
  }

  lines.push("", "PROJECTED INVENTORY DELTAS");
  for (const delta of plan.inventoryDeltas) {
    lines.push(
      `${delta.itemReference} ${delta.itemName}: ` +
      `delta=${formatSignedDecimal(delta.quantity)} | ` +
      `${formatDecimal(delta.currentBalance)} -> ${formatDecimal(delta.projectedBalance)}`,
    );
  }

  lines.push(
    "",
    "REC-068",
    `Recipe ID: ${plan.corruptRecipe.id}`,
    `Fingerprint SHA-256: ${plan.corruptRecipe.fingerprint}`,
    `Direct recipe-ID references in order snapshots: ${plan.corruptRecipe.directSnapshotReferences}`,
    `Row: ${canonicalStringify(plan.corruptRecipe.row)}`,
    "",
    snapshot
      ? "Snapshot gate is populated; apply still requires separate user approval and apply implementation."
      : "Snapshot gate is PENDING; capture and verify a fresh snapshot before apply.",
    "--apply is not implemented in this dry-run-only phase.",
    "No operational data was changed.",
  );
  return `${lines.join("\n")}\n`;
}

function requireRow(rows: Row[], id: string, label: string): Row {
  const row = rows.find(candidate => candidate.id === id);
  if (!row) throw new Error(`Missing ${label} ${id}.`);
  return row;
}

function normalizeRecipe(recipe: Row): Row {
  return {
    ...recipe,
    ingredients_json: stringifyJson(recipe.ingredients_json, []),
  };
}

function replaceVariantRecipe(
  source: LineRecipeSnapshot,
  targetId: string,
  ingredients: any[],
): LineRecipeSnapshot {
  return {
    ...source,
    variant: {
      target_type: "PRODUCT_VARIANT",
      target_id: targetId,
      ingredients,
    },
  };
}

function assertReviewedOrderSet(
  orders: Row[],
  expectedOrderNumbers: string[],
): void {
  const actual = orders.map(order => String(order.order_no)).sort();
  const expected = [...expectedOrderNumbers].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Qualifying order set changed. Expected ${expected.join(", ")}, got ${actual.join(", ")}.`,
    );
  }
}

function buildInventoryDeltas(
  oldLedger: Map<string, number>,
  newLedger: Map<string, number>,
  currentBalances: Map<string, number>,
  names: Map<string, string>,
): HongToLucMigrationPlan["inventoryDeltas"] {
  const ids = new Set([...oldLedger.keys(), ...newLedger.keys()]);
  return [...ids]
    .map(itemReference => {
      const quantity =
        (oldLedger.get(itemReference) || 0) -
        (newLedger.get(itemReference) || 0);
      const currentBalance = currentBalances.get(itemReference) || 0;
      return {
        itemReference,
        itemName: names.get(itemReference) || "?",
        quantity,
        currentBalance,
        projectedBalance: currentBalance + quantity,
      };
    })
    .filter(row => Math.abs(row.quantity) > 0.000001)
    .sort((left, right) => left.itemReference.localeCompare(right.itemReference));
}

function compareQuantityMaps(
  stored: Map<string, number>,
  rebuilt: Map<string, number>,
): Array<{
  itemReference: string;
  storedQuantity: number;
  rebuiltQuantity: number;
}> {
  const ids = new Set([...stored.keys(), ...rebuilt.keys()]);
  return [...ids]
    .filter(id => Math.abs((stored.get(id) || 0) - (rebuilt.get(id) || 0)) > 0.00001)
    .map(itemReference => ({
      itemReference,
      storedQuantity: stored.get(itemReference) || 0,
      rebuiltQuantity: rebuilt.get(itemReference) || 0,
    }))
    .sort((left, right) => left.itemReference.localeCompare(right.itemReference));
}

function addQuantities(
  target: Map<string, number>,
  rows: ConsumptionRow[],
): void {
  for (const [id, quantity] of aggregateRows(rows)) {
    target.set(id, (target.get(id) || 0) + quantity);
  }
}

function aggregateRows(rows: ConsumptionRow[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (!row.item_reference) continue;
    result.set(
      row.item_reference,
      (result.get(row.item_reference) || 0) + Number(row.quantity || 0),
    );
  }
  return result;
}

function parseObject(value: unknown): Row {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as Row : {};
}

function parseArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyJson(value: unknown, fallback: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? fallback);
}

function normalizeName(value: unknown): string {
  return String(value || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi");
}

function compareCreatedThenId(left: Row, right: Row): number {
  return new Date(left.created_at || 0).getTime() -
      new Date(right.created_at || 0).getTime() ||
    String(left.id).localeCompare(String(right.id));
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatSignedInteger(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatInteger(Math.abs(value))}`;
}

function formatDecimal(value: number): string {
  return Number(value.toFixed(6)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

function formatSignedDecimal(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatDecimal(Math.abs(value))}`;
}

function formatSaigon(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  }).format(new Date(value)) + " +07";
}

function formatIngredients(value: unknown[]): string {
  if (!Array.isArray(value) || value.length === 0) return "(none)";
  return value.map((ingredient: any) => (
    `${ingredient.ingredient_id}:${Number(ingredient.quantity || 0)}`
  )).join(", ");
}
