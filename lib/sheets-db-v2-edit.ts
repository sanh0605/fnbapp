/**
 * Atomic supersede-and-replace persistence for order edits.
 *
 * The RPC locks and verifies the old version, then writes the replacement
 * order, lines, event, ledger effects, and SUPERSEDED transition in one
 * PostgreSQL transaction.
 */

"use server";

import { supersedeOrderAtomic } from "@/lib/order-edit-transaction";
import type { OrderEvent, OrderLineV2, OrderV2 } from "@/lib/order-types";

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

export async function supersedeOrderV2(
  input: SupersedeOrderV2Input,
): Promise<SupersedeOrderV2Result> {
  try {
    await supersedeOrderAtomic({
      oldOrderId: input.oldOrderId,
      expectedOldVersion: input.expectedOldVersion,
      newOrder: input.newOrder as unknown as Record<string, unknown>,
      newLines: input.newLines as unknown as Array<Record<string, unknown>>,
      event: input.event as unknown as Record<string, unknown>,
      ledgerRows: [
        ...input.reversalEntries,
        ...input.consumeEntries,
      ] as unknown as Array<Record<string, unknown>>,
    });
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
