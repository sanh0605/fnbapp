/**
 * Supersede-and-replace batched write for order edits.
 *
 * Operations (in order):
 *   1. Verify old order exists, is COMPLETED, version matches (optimistic lock)
 *   2. Update old order: status=SUPERSEDED, superseded_by=newOrderId
 *   3. Insert new order (COMPLETED, version+1)
 *   4. InsertMany new Order_Lines_V2
 *   5. Insert Order_Events (EDITED)
 *   6. InsertMany Stock_Ledger EDIT_REVERSAL + SALES_CONSUME entries
 *
 * On any failure, attempts reverse-order cleanup. Not a true transaction.
 */

"use server";

import { findAllNoCache, insert, insertMany, remove, removeMany, update } from "@/lib/sheets_db";
import { ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

interface LedgerEntryInput {
  id: string;
  transaction_type: string;
  reference_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  created_at: string;
  order_event_id: string;
  cost_at_sale: number;
  source?: string;
}

export interface SupersedeOrderV2Input {
  oldOrderId: string;
  expectedOldVersion: number;
  newOrder: OrderV2;
  newLines: OrderLineV2[];
  event: OrderEvent;
  reversalEntries: LedgerEntryInput[];
  consumeEntries: LedgerEntryInput[];
}

export type SupersedeOrderV2Result =
  | { success: true }
  | { success: false; error: string };

export async function supersedeOrderV2(input: SupersedeOrderV2Input): Promise<SupersedeOrderV2Result> {
  // 1. Verify old order
  const allOrders = await findAllNoCache("Orders_V2");
  const oldOrder = allOrders.find((o: any) => o.id === input.oldOrderId);
  if (!oldOrder) {
    return { success: false, error: `Order ${input.oldOrderId} not found` };
  }
  if (oldOrder.status !== ORDER_STATUS.COMPLETED) {
    return { success: false, error: `Order status is ${oldOrder.status}, must be COMPLETED to edit` };
  }
  if (Number(oldOrder.version) !== input.expectedOldVersion) {
    return { success: false, error: `Optimistic lock failed: expected version ${input.expectedOldVersion} but found ${oldOrder.version}` };
  }

  const cleanup: string[] = [];

  try {
    // 2. Mark old as SUPERSEDED
    await update("Orders_V2", input.oldOrderId, {
      status: ORDER_STATUS.SUPERSEDED,
      superseded_by: input.newOrder.id,
    });
    cleanup.push(`UPDATE:Orders_V2:${input.oldOrderId}`);

    // 3. Insert new order
    await insert("Orders_V2", input.newOrder);
    cleanup.push(`Orders_V2:${input.newOrder.id}`);

    // 4. Insert new lines
    if (input.newLines.length > 0) {
      await insertMany("Order_Lines_V2", input.newLines);
      cleanup.push(`Order_Lines_V2:${input.newLines.map(l => l.id).join(",")}`);
    }

    // 5. Insert event
    await insert("Order_Events", input.event);
    cleanup.push(`Order_Events:${input.event.id}`);

    // 6. Insert reversal + consume ledger entries (combined)
    const allLedger = [...input.reversalEntries, ...input.consumeEntries];
    if (allLedger.length > 0) {
      await insertMany("Stock_Ledger", allLedger);
      cleanup.push(`Stock_Ledger:${allLedger.map(l => l.id).join(",")}`);
    }

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);

    // Reverse-order cleanup
    for (const entry of [...cleanup].reverse()) {
      try {
        if (entry.startsWith("UPDATE:")) {
          const [, sheet, id] = entry.split(":");
          // Best-effort: restore old status (we may not have it in scope cleanly)
          await update(sheet, id, { status: ORDER_STATUS.COMPLETED, superseded_by: "" });
        } else {
          const [sheet, ids] = entry.split(":");
          const idList = ids.split(",");
          await removeMany(sheet, idList);
        }
      } catch {
        // best-effort
      }
    }

    return { success: false, error: errorMsg };
  }
}
