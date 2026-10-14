"use server";

import { findById } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";
import crypto from "node:crypto";
import { EVENT_TYPE, ORDER_STATUS } from "@/lib/sales/order-types";
import { voidOrderAtomic } from "@/lib/sales/void-order-transaction";

export interface VoidOrderV2Result {
  success: boolean;
  error?: string;
}

// ============================================================
// voidOrderV2 — mark VOIDED, write reversal
// ============================================================

export async function voidOrderV2(orderId: string, reason: string): Promise<VoidOrderV2Result> {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Lý do huỷ đơn là bắt buộc" };
    }

    // Claude code — CODE-22: require ADMIN before any state mutation.
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const actor = { id: auth.actor.id, name: auth.actor.name };

    const order = await findById("Orders_V2", orderId);
    if (!order) return { success: false, error: `Order ${orderId} not found` };
    if (order.status !== ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.VOIDED) {
      return { success: false, error: `Order status is ${order.status}, must be COMPLETED to void` };
    }

    const eventTime = new Date().toISOString();
    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: orderId,
      event_type: EVENT_TYPE.VOIDED,
      event_at: eventTime,
      actor_id: actor.id,
      actor_name: actor.name,
      from_version: Number(order.version) || 1,
      to_version: Number(order.version) || 1,
      previous_order_id: "",
      delta_json: JSON.stringify({ voided: true, net_total_before: Number(order.net_total) || 0 }),
      reason,
    };

    // Phase A:
    // this used to reverse stock_ledger rows for the order's checkout, but
    // selling has never written one since the 2026-08-07 cutover -- proved
    // live before this code was removed, not assumed: 0 stock_ledger rows
    // across all 24 real VOIDED orders and all 17 real EDITED (superseded)
    // orders in production, both old and new versions, 53 unique order ids
    // checked. Phase C removed void_order_atomic's stock_ledger write
    // entirely, so there is no longer a reversalRows field to send.
    await voidOrderAtomic({
      orderId,
      event,
      voidedAt: eventTime,
      voidedById: actor.id,
      reason,
    });

    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin/orders");
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
