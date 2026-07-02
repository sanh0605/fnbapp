import { createHash } from "node:crypto";
import type { PurchaseLedgerMismatch } from "@/lib/purchase-ledger-audit";

type LedgerRow = {
  id: string;
  reference_id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
};

type ExpectedReceipt = {
  po_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
};

export type PurchaseCostRecoveryChange = {
  ledger_id: string;
  po_id: string;
  item_reference: string;
  quantity_change: number;
  old_unit_cost: number;
  new_unit_cost: number;
  old_total_cost: number;
  new_total_cost: number;
  delta_total_cost: number;
};

export type PurchaseCostRecoveryPlan = {
  run_id: string;
  source_hash: string;
  changes: PurchaseCostRecoveryChange[];
};

export function buildPurchaseCostRecoveryPlan(input: {
  runId: string;
  mismatches: PurchaseLedgerMismatch[];
  expectedReceipts: ExpectedReceipt[];
  ledger: LedgerRow[];
  materialThreshold?: number;
}): PurchaseCostRecoveryPlan {
  const materialThreshold = input.materialThreshold ?? 1;
  const changes: PurchaseCostRecoveryChange[] = [];

  for (const mismatch of input.mismatches) {
    if (Math.abs(mismatch.delta_total_cost) < materialThreshold) continue;
    if (Math.abs(mismatch.delta_quantity) > 0.000001) {
      throw new Error(
        `${mismatch.po_id}/${mismatch.item_reference}: quantity mismatch requires manual review`,
      );
    }
    const rows = input.ledger.filter(
      row =>
        row.transaction_type === "PO_RECEIPT" &&
        row.reference_id === mismatch.po_id &&
        row.item_reference === mismatch.item_reference,
    );
    const expectedRows = input.expectedReceipts.filter(
      row =>
        row.po_id === mismatch.po_id &&
        row.item_reference === mismatch.item_reference,
    );
    const actualQuantity = rows.reduce(
      (sum, row) => sum + (Number(row.quantity_change) || 0),
      0,
    );
    const expectedQuantity = expectedRows.reduce(
      (sum, row) => sum + row.quantity_change,
      0,
    );
    if (
      Math.abs(actualQuantity - mismatch.actual_quantity) > 0.000001 ||
      Math.abs(expectedQuantity - mismatch.expected_quantity) > 0.000001
    ) {
      throw new Error(
        `${mismatch.po_id}/${mismatch.item_reference}: ledger changed after audit`,
      );
    }

    for (const expectedRow of expectedRows) {
      const matchingRows = rows.filter(
        row =>
          Math.abs(
            (Number(row.quantity_change) || 0) -
            expectedRow.quantity_change,
          ) <= 0.000001,
      );
      if (matchingRows.length !== 1) {
        throw new Error(
          `${mismatch.po_id}/${mismatch.item_reference}: expected a unique quantity match for ${expectedRow.quantity_change}`,
        );
      }
      const row = matchingRows[0];
      const quantity = Number(row.quantity_change) || 0;
      const oldUnitCost = Number(row.unit_cost) || 0;
      const newUnitCost = roundDecimal(expectedRow.unit_cost);
      const oldTotalCost = roundDecimal(quantity * oldUnitCost);
      const newTotalCost = roundDecimal(quantity * newUnitCost);
      const deltaTotalCost = roundDecimal(newTotalCost - oldTotalCost);
      if (Math.abs(deltaTotalCost) < materialThreshold) continue;
      changes.push({
        ledger_id: row.id,
        po_id: mismatch.po_id,
        item_reference: mismatch.item_reference,
        quantity_change: quantity,
        old_unit_cost: oldUnitCost,
        new_unit_cost: newUnitCost,
        old_total_cost: oldTotalCost,
        new_total_cost: newTotalCost,
        delta_total_cost: deltaTotalCost,
      });
    }
  }

  changes.sort((left, right) =>
    left.po_id.localeCompare(right.po_id) ||
    left.item_reference.localeCompare(right.item_reference),
  );
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(changes))
    .digest("hex");
  return {
    run_id: input.runId,
    source_hash: sourceHash,
    changes,
  };
}

function roundDecimal(value: number, places = 6): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
