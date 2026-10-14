"use server";

import {
  findAll,
  findAllWhere,
  findById,
} from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";
import crypto from "node:crypto";
import { EVENT_TYPE } from "@/lib/sales/order-types";
import {
  buildEditedOrderFromCart,
  planEditedOrderPayments,
} from "@/lib/sales/order-edit-cart";
import { supersedeOrderV2 } from "@/lib/sales/sheets-db-v2-edit";
import type { CartInput } from "@/lib/sales/order-cart";
import { normalizeOrderV2, normalizeLineV2 } from "./order-helpers";

export interface EditOrderV2Input {
  orderId: string;
  expectedVersion: number;
  cart: CartInput;
  reason: string;
}

export type EditOrderV2Result =
  | { success: true; new_order_id: string; new_version: number }
  | { success: false; error: string };

// ============================================================
// editOrderV2 — modify order, write reversal and consumption
// ============================================================

export async function editOrderV2(input: EditOrderV2Input): Promise<EditOrderV2Result> {
  try {
    if (!input.reason || input.reason.trim().length === 0) {
      return { success: false, error: "Lý do chỉnh sửa là bắt buộc" };
    }

    // CODE-22: require ADMIN before touching any order data.
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    // 1. Load old order + lines
    const [oldOrder, oldLines] = await Promise.all([
      findById("Orders_V2", input.orderId),
      findAllWhere("Order_Lines_V2", {
        eq: { order_id: input.orderId },
      }),
    ]);
    if (!oldOrder) return { success: false, error: `Order ${input.orderId} not found` };

    const oldOrderV2 = normalizeOrderV2(oldOrder);
    const oldLinesV2 = oldLines.map(normalizeLineV2);

    const actor = { id: auth.actor.id, name: auth.actor.name };
    const oldPayments = await findAllWhere<{
      method: string;
      amount: number | string;
      reference?: string | null;
    }>("Order_Payments", {
      eq: { order_id: input.orderId },
    });

    // 3. Load reference data
    const originalSaleTime = oldOrderV2.created_at;
    const [
      brands,
      products,
      variants,
      categories,
      modifiers,
      promotions,
    ] = await Promise.all([
      findAll("Brands"), findAll("Products"), findAll("Product_Variants"),
      findAll("Product_Categories"), findAll("Modifiers"), findAll("Promotions"),
    ]);

    // 4. Build edited order (preserves sale time, increments version). As of
    // Phase 2 
    // this no longer resolves a recipe, so Recipes is not fetched above. As
    // of 2026-09-01 
    // Base_Ingredients is not fetched either -- it was loaded and passed in
    // on every edit but never read inside buildEditedOrderFromCart.
    const built = buildEditedOrderFromCart(
      { ...input.cart, actor },
      { brands, products, variants, categories, modifiers, promotions },
      { order: oldOrderV2, lines: oldLinesV2 },
    );
    const paymentPlan = planEditedOrderPayments(
      oldPayments.map((payment) => {
        if (payment.method !== "CASH" && payment.method !== "BANK_TRANSFER") {
          throw new Error("Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n c\u1ee7a \u0111\u01a1n g\u1ed1c kh\u00f4ng h\u1ee3p l\u1ec7");
        }
        const amount = Number(payment.amount);
        if (!Number.isInteger(amount) || amount < 0) {
          throw new Error("S\u1ed1 ti\u1ec1n thanh to\u00e1n c\u1ee7a \u0111\u01a1n g\u1ed1c kh\u00f4ng h\u1ee3p l\u1ec7");
        }
        return {
          method: payment.method,
          amount,
          reference: payment.reference || "",
        };
      }),
      oldOrderV2.net_total,
      built.order.net_total,
      built.order.payment_method === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
    );
    const editedPayments = paymentPlan.map((payment) => ({
      id: `pay-${crypto.randomUUID()}`,
      order_id: built.order.id,
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference || "",
    }));

    // Editing no longer computes a new cost or a new sale-time consumption
    // (Plan C Task 3) -- cost_at_sale for the edited lines stays at its
    // column default (0). The old version's real ledger rows, if any, are
    // still reversed below: that undoes what already happened, which is a
    // different thing from computing a new consumption for the replacement.

    // 6. Build EDITED event
    const eventTime = new Date().toISOString();
    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: built.order.id,
      event_type: EVENT_TYPE.EDITED,
      event_at: eventTime,
      actor_id: actor.id,
      actor_name: actor.name,
      from_version: oldOrderV2.version,
      to_version: built.order.version,
      previous_order_id: oldOrderV2.id,
      delta_json: JSON.stringify({
        old_gross: oldOrderV2.gross_total,
        new_gross: built.order.gross_total,
        old_net: oldOrderV2.net_total,
        new_net: built.order.net_total,
        old_line_count: oldLinesV2.length,
        new_line_count: built.lines.length,
      }),
      reason: input.reason,
    };

    // Phase A
    // proved the old reversal always wrote 0 stock_ledger rows (see
    // voidOrderV2's own comment in order-void-actions.ts for the exact count: 0 rows across
    // all 53 real voided/edited order ids checked). Phase C removed
    // supersede_order_v2_atomic's stock_ledger write entirely, so this call
    // no longer has a ledger movement pair to build or send.
    const result = await supersedeOrderV2({
      oldOrderId: oldOrderV2.id,
      expectedOldVersion: input.expectedVersion,
      newOrder: built.order,
      newLines: built.lines,
      event,
      payments: editedPayments,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin/orders");
      revalidatePath("/admin");
    }

    return {
      success: true,
      new_order_id: built.order.id,
      new_version: built.order.version,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
