/**
 * Atomic supersede-and-replace persistence for order edits.
 *
 * The RPC locks and verifies the old version, then writes the replacement
 * order, lines, event, ledger effects, and SUPERSEDED transition in one
 * PostgreSQL transaction.
 */

"use server";

import { supersedeOrderAtomic } from "@/lib/order-edit-transaction";
import type { OrderEditPaymentInput } from "@/lib/order-edit-transaction";
import type { OrderEvent, OrderLineV2, OrderV2 } from "@/lib/order-types";

export interface SupersedeOrderV2Input {
  oldOrderId: string;
  expectedOldVersion: number;
  newOrder: OrderV2;
  newLines: OrderLineV2[];
  event: OrderEvent;
  payments: OrderEditPaymentInput[];
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
      payments: input.payments,
    });
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
