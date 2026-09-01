/**
 * HISTORICAL (Plan E E3, 2026-08-11) -- see lib/historical/README.md.
 * Wrote real V2 orders during the early orders-v2 build-out (referenced by
 * the original submitOrderV2 action and the first POS-checkout-atomicity
 * pass); superseded before this measurement by the current checkout write
 * path. Not imported anywhere live.
 *
 * WILL FAIL IF RUN (docs/superpowers/plans/2026-09-02-clean-up-after-the-ledger.md
 * section 2.1, 2026-09-02): step 4 below, insertMany("Stock_Ledger", ...),
 * reads/writes a table Phase D dropped (migration 0096, applied). Kept, not
 * deleted, per CLAUDE.md section 3 -- this is the only surviving record of
 * how the early orders-v2 write path batched order + lines + event + ledger
 * as one logical unit. Confirmed zero live callers as of 2026-09-02 (only
 * insertOrderV2Records's own test imports it) -- kept for the historical
 * record, not because anything still calls it.
 *
 * Batched write helpers for V2 sheets.
 *
 * Writes OrderV2 + lines + event + ledger as a logical unit.
 * On any failure, attempts cleanup of previously inserted rows.
 * Not a true transaction (Google Sheets API doesn't support them),
 * but reduces the window of inconsistency.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 4.3)
 */

"use server";

import { insert, insertMany, removeMany } from "@/lib/sheets_db";
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
}

export interface InsertOrderV2Input {
  order: OrderV2;
  lines: OrderLineV2[];
  event: OrderEvent;
  ledgerEntries: LedgerEntryInput[];
}

export type InsertOrderV2Result =
  | { success: true }
  | { success: false; error: string; partialCleanup: string[] };

export async function insertOrderV2Records(input: InsertOrderV2Input): Promise<InsertOrderV2Result> {
  const cleanup: string[] = [];

  try {
    // 1. Orders_V2 (single row)
    await insert("Orders_V2", input.order);
    cleanup.push(`Orders_V2:${input.order.id}`);

    // 2. Order_Lines_V2 (many rows)
    if (input.lines.length > 0) {
      await insertMany("Order_Lines_V2", input.lines);
      cleanup.push(`Order_Lines_V2:${input.lines.map(l => l.id).join(",")}`);
    }

    // 3. Order_Events (single row)
    await insert("Order_Events", input.event);
    cleanup.push(`Order_Events:${input.event.id}`);

    // 4. Stock_Ledger (many rows)
    if (input.ledgerEntries.length > 0) {
      await insertMany("Stock_Ledger", input.ledgerEntries);
      cleanup.push(`Stock_Ledger:${input.ledgerEntries.map(l => l.id).join(",")}`);
    }

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);

    // Reverse-order cleanup
    for (const entry of [...cleanup].reverse()) {
      try {
        const [sheet, ids] = entry.split(":");
        const idList = ids.split(",");
        await removeMany(sheet, idList);
      } catch {
        // Best-effort; ignore cleanup failures
      }
    }

    return { success: false, error: errorMsg, partialCleanup: cleanup };
  }
}
