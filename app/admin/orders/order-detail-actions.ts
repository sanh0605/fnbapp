"use server";

import {
  findAll,
  findAllWhere,
  findAllWhereInBatches,
  findById,
} from "@/lib/db/tables";
import { requireAdmin } from "@/lib/auth/auth";
import type { OrderEvent } from "@/lib/sales/order-types";
import type { OrderListItem } from "./actions";
import { effectivePaymentRows } from "@/lib/sales/payment-method";
import { parseObject } from "./order-helpers";

export interface OrderDetailV2Result {
  order: OrderListItem;
  timeline: Array<{
    id: string;
    version: number;
    status: string;
    created_at: string;
    created_by_name: string;
    gross_total: number;
    net_total: number;
    superseded_by: string;
  }>;
  events: OrderEvent[];
}

// ============================================================
// getOrderDetailV2 — single order + version timeline
// ============================================================

export async function getOrderDetailV2(orderId: string): Promise<OrderDetailV2Result | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const current = await findById("Orders_V2", orderId);
  if (!current) return null;

  // Each version's parent is the version it replaced: walk up to v1, then down.
  const chainById = new Map<string, any>([[current.id, current]]);
  let root = current;
  while (root.parent_order_id && !chainById.has(root.parent_order_id)) {
    const parent = await findById("Orders_V2", root.parent_order_id);
    if (!parent) break;
    chainById.set(parent.id, parent);
    root = parent;
  }
  const queue = [root.id];
  for (const id of queue) {
    for (const child of await findAllWhere("Orders_V2", { eq: { parent_order_id: id } })) {
      if (child?.id && !chainById.has(child.id)) chainById.set(child.id, child);
      if (child?.id && !queue.includes(child.id)) queue.push(child.id);
    }
  }
  const chainOrders = Array.from(chainById.values());
  chainOrders.sort((a, b) => Number(a.version) - Number(b.version));

  const [orderLines, paymentRows, products, variants, events] = await Promise.all([
    findAllWhereInBatches("Order_Lines_V2", "order_id", [orderId]),
    findAllWhereInBatches("Order_Payments", "order_id", [orderId]),
    findAll("Products"),
    findAll("Product_Variants"),
    findAllWhereInBatches(
      "Order_Events",
      "order_id",
      chainOrders.map(order => order.id),
    ),
  ]);

  // Build current order detail (reuse logic from getOrdersV2)
  const orderLinesV2 = (orderLines as any[]).filter(l => l.order_id === orderId);
  // Claude code — CODE-13: O(1) lookup Maps.
  const productById = new Map((products as any[]).map(p => [p.id, p]));
  const variantById = new Map((variants as any[]).map(v => [v.id, v]));
  const mappedLines = orderLinesV2.map(line => {
    const product = productById.get(line.product_id);
    const variant = variantById.get(line.variant_id);
    let mods: any[] = [];
    try {
      if (line.modifiers_snapshot_json) mods = JSON.parse(line.modifiers_snapshot_json);
    } catch {}
    const productSnap = parseObject(line.product_snapshot_json);
    const variantSnap = parseObject(line.variant_snapshot_json);
    return {
      ...line,
      qty: Number(line.qty) || 0,
      unit_price: Number(line.unit_price) || 0,
      gross_line_total: Number(line.gross_line_total) || 0,
      promo_discount: Number(line.promo_discount) || 0,
      manual_item_discount: Number(line.manual_item_discount) || 0,
      order_discount_allocation: Number(line.order_discount_allocation) || 0,
      net_line_total: Number(line.net_line_total) || 0,
      product_name: productSnap.name || product?.name || "Không rõ",
      size_name: variantSnap.size_name || variant?.size_name || "Không rõ",
      modifiers: mods,
    };
  });

  // Events for this order chain
  events.sort((a: any, b: any) =>
    new Date(b.event_at).getTime() - new Date(a.event_at).getTime(),
  );

  return {
    order: {
      id: current.id,
      order_no: current.order_no,
      display_order_no: current.order_no,
      brand_id: current.brand_id,
      status: current.status,
      version: Number(current.version) || 1,
      parent_order_id: current.parent_order_id || "",
      gross_total: Number(current.gross_total) || 0,
      promo_discount_total: Number(current.promo_discount_total) || 0,
      manual_item_discount_total: Number(current.manual_item_discount_total) || 0,
      manual_order_discount: Number(current.manual_order_discount) || 0,
      net_total: Number(current.net_total) || 0,
      method: current.payment_method === "BANK_TRANSFER" ? "Chuyen khoan" : "Tien mat",
      payments: effectivePaymentRows(current, paymentRows as any[]),
      created_by_name: current.created_by_name || "",
      created_at: current.created_at,
      lines: mappedLines,
    },
    timeline: chainOrders.map(o => ({
      id: o.id,
      version: Number(o.version) || 1,
      status: o.status,
      created_at: o.created_at,
      created_by_name: o.created_by_name || "",
      gross_total: Number(o.gross_total) || 0,
      net_total: Number(o.net_total) || 0,
      superseded_by: o.superseded_by || "",
    })),
    events: events as OrderEvent[],
  };
}
