"use server";

import { findAllWhere, findById } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";
import crypto from "node:crypto";
import { EVENT_TYPE } from "@/lib/sales/order-types";
import { planRequestedPayments } from "@/lib/sales/order-edit-cart";
import { supersedeOrderV2 } from "@/lib/sales/sheets-db-v2-edit";

export interface ChangeOrderPaymentsInput {
  orderId: string;
  expectedVersion: number;
  payments: unknown;
  reason: string;
}

export type ChangeOrderPaymentsResult =
  | { success: true; new_order_id: string }
  | { success: false; error: string };

// BR-SALE-014: an edit only changes how the order was paid. The old rows are
// copied as they are (raw, so no value is re-derived); the catalog is never read.
export async function changeOrderPayments(
  input: ChangeOrderPaymentsInput,
): Promise<ChangeOrderPaymentsResult> {
  try {
    if (!input.reason || input.reason.trim().length === 0) {
      return { success: false, error: "Lý do chỉnh sửa là bắt buộc" };
    }

    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const [oldOrder, oldLines, oldPayments] = await Promise.all([
      findById("Orders_V2", input.orderId),
      findAllWhere("Order_Lines_V2", { eq: { order_id: input.orderId } }),
      findAllWhere<{ method: string; amount: number | string }>("Order_Payments", {
        eq: { order_id: input.orderId },
      }),
    ]);
    if (!oldOrder) return { success: false, error: "Không tìm thấy đơn" };

    const parts = planRequestedPayments(input.payments, Number(oldOrder.net_total));
    const newOrderId = `ord-${crypto.randomUUID()}`;
    const newVersion = Number(oldOrder.version) + 1;

    const newOrder = {
      ...oldOrder,
      id: newOrderId,
      version: newVersion,
      // The RPC requires the parent to be the order being replaced.
      parent_order_id: oldOrder.id,
      payment_method: parts[0].method,
    };
    const newLines = oldLines.map((line) => ({
      ...line,
      id: `ol-${crypto.randomUUID()}`,
      order_id: newOrderId,
    }));
    const payments = parts.map((part) => ({
      id: `pay-${crypto.randomUUID()}`,
      order_id: newOrderId,
      method: part.method,
      amount: part.amount,
      reference: part.reference || "",
    }));

    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: newOrderId,
      event_type: EVENT_TYPE.EDITED,
      event_at: new Date().toISOString(),
      actor_id: auth.actor.id,
      actor_name: auth.actor.name,
      from_version: Number(oldOrder.version),
      to_version: newVersion,
      previous_order_id: oldOrder.id,
      delta_json: JSON.stringify({
        old_payments: oldPayments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
        new_payments: parts.map((p) => ({ method: p.method, amount: p.amount })),
      }),
      reason: input.reason,
    };

    const result = await supersedeOrderV2({
      oldOrderId: oldOrder.id,
      expectedOldVersion: input.expectedVersion,
      newOrder: newOrder as never,
      newLines: newLines as never,
      event: event as never,
      payments,
    });
    if (!result.success) {
      return {
        success: false,
        error: result.error.includes("Optimistic lock failed")
          ? "Đơn vừa được người khác sửa, tải lại trang rồi làm lại"
          : result.error,
      };
    }

    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin/orders");
      revalidatePath("/admin");
    }
    return { success: true, new_order_id: newOrderId };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
