"use server";

import { findAll, findAllNoCache, insert, update } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "node:crypto";

import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

// ============================================================
// getOrdersV2 — list latest COMPLETED versions with details
// ============================================================

export interface OrderListItem {
  id: string;
  order_no: string;
  display_order_no: string;
  brand_id: string;
  status: string;
  version: number;
  parent_order_id: string;
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;
  method: string;
  created_by_name: string;
  created_at: string;
  lines: Array<OrderLineV2 & {
    product_name: string;
    size_name: string;
    modifiers: any[];
  }>;
}

export interface GetOrdersV2Result {
  orders: OrderListItem[];
  brands: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  categories: any[];
}

export async function getOrdersV2(): Promise<GetOrdersV2Result> {
  try {
    const [orders, orderLines, products, variants, brands, modifiers, categories] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Brands"),
      findAll("Modifiers"),
      findAll("Product_Categories"),
    ]);

    // Latest versions only: status=COMPLETED AND superseded_by=""
    const latestOrders = (orders as any[]).filter(o =>
      o.status === ORDER_STATUS.COMPLETED && !o.superseded_by,
    );

    const mappedOrders: OrderListItem[] = latestOrders.map(order => {
      const orderLinesV2 = (orderLines as any[]).filter(l => l.order_id === order.id);
      const mappedLines = orderLinesV2.map(line => {
        const product = (products as any[]).find(p => p.id === line.product_id);
        const variant = (variants as any[]).find(v => v.id === line.variant_id);
        let mods: any[] = [];
        try {
          if (line.modifiers_snapshot_json) {
            mods = JSON.parse(line.modifiers_snapshot_json);
          }
        } catch {}
        return {
          ...line,
          qty: Number(line.qty) || 0,
          unit_price: Number(line.unit_price) || 0,
          gross_line_total: Number(line.gross_line_total) || 0,
          promo_discount: Number(line.promo_discount) || 0,
          manual_item_discount: Number(line.manual_item_discount) || 0,
          order_discount_allocation: Number(line.order_discount_allocation) || 0,
          net_line_total: Number(line.net_line_total) || 0,
          product_name: product?.name || "Unknown",
          size_name: variant?.size_name || "Unknown",
          modifiers: mods,
        };
      });

      const brand = (brands as any[]).find(b => b.id === order.brand_id);
      let display_order_no = order.order_no;
      if (display_order_no && display_order_no.startsWith("#")) {
        const numStr = display_order_no.replace("#", "").padStart(6, "0");
        const bCode = brand?.code || "ORD";
        display_order_no = `${bCode}${numStr}`;
      }

      return {
        id: order.id,
        order_no: order.order_no,
        display_order_no,
        brand_id: order.brand_id,
        status: order.status,
        version: Number(order.version) || 1,
        parent_order_id: order.parent_order_id || "",
        gross_total: Number(order.gross_total) || 0,
        promo_discount_total: Number(order.promo_discount_total) || 0,
        manual_item_discount_total: Number(order.manual_item_discount_total) || 0,
        manual_order_discount: Number(order.manual_order_discount) || 0,
        net_total: Number(order.net_total) || 0,
        method: order.payment_method === "BANK_TRANSFER" ? "Chuyen khoan" : "Tien mat",
        created_by_name: order.created_by_name || "",
        created_at: order.created_at,
        lines: mappedLines,
      };
    });

    mappedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return {
      orders: mappedOrders,
      brands: (brands as any[]).filter(b => b.status !== "DELETED"),
      products: (products as any[]).filter(p => p.status !== "DELETED"),
      variants: (variants as any[]).filter(v => v.status !== "DELETED"),
      modifiers: (modifiers as any[]).filter(m => m.status !== "DELETED"),
      categories: (categories as any[]).filter(c => c.status !== "DELETED"),
    };
  } catch (err: any) {
    console.error("[getOrdersV2]", err);
    return { orders: [], brands: [], products: [], variants: [], modifiers: [], categories: [] };
  }
}

// ============================================================
// getOrderDetailV2 — single order + version timeline
// ============================================================

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

export async function getOrderDetailV2(orderId: string): Promise<OrderDetailV2Result | null> {
  const { orders, orderLines, products, variants, brands } = {
    orders: await findAllNoCache("Orders_V2"),
    orderLines: await findAllNoCache("Order_Lines_V2"),
    products: await findAll("Products"),
    variants: await findAll("Product_Variants"),
    brands: await findAll("Brands"),
  };

  const current = (orders as any[]).find(o => o.id === orderId);
  if (!current) return null;

  // Find root
  const rootId = current.parent_order_id || current.id;

  // All versions in chain
  const chainOrders = (orders as any[]).filter(o =>
    o.id === rootId || o.parent_order_id === rootId,
  );
  chainOrders.sort((a, b) => Number(a.version) - Number(b.version));

  // Build current order detail (reuse logic from getOrdersV2)
  const orderLinesV2 = (orderLines as any[]).filter(l => l.order_id === orderId);
  const mappedLines = orderLinesV2.map(line => {
    const product = (products as any[]).find(p => p.id === line.product_id);
    const variant = (variants as any[]).find(v => v.id === line.variant_id);
    let mods: any[] = [];
    try {
      if (line.modifiers_snapshot_json) mods = JSON.parse(line.modifiers_snapshot_json);
    } catch {}
    return {
      ...line,
      qty: Number(line.qty) || 0,
      unit_price: Number(line.unit_price) || 0,
      gross_line_total: Number(line.gross_line_total) || 0,
      promo_discount: Number(line.promo_discount) || 0,
      manual_item_discount: Number(line.manual_item_discount) || 0,
      order_discount_allocation: Number(line.order_discount_allocation) || 0,
      net_line_total: Number(line.net_line_total) || 0,
      product_name: product?.name || "Unknown",
      size_name: variant?.size_name || "Unknown",
      modifiers: mods,
    };
  });

  const brand = (brands as any[]).find(b => b.id === current.brand_id);
  let display_order_no = current.order_no;
  if (display_order_no && display_order_no.startsWith("#")) {
    const numStr = display_order_no.replace("#", "").padStart(6, "0");
    const bCode = brand?.code || "ORD";
    display_order_no = `${bCode}${numStr}`;
  }

  // Events for this order chain
  const allEvents = await findAllNoCache("Order_Events");
  const events = (allEvents as any[]).filter(e =>
    chainOrders.some(o => o.id === e.order_id),
  ).sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());

  return {
    order: {
      id: current.id,
      order_no: current.order_no,
      display_order_no,
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

// ============================================================
// voidOrderV2 — mark VOIDED, write reversal
// ============================================================

export interface VoidOrderV2Result {
  success: boolean;
  error?: string;
}

export async function voidOrderV2(orderId: string, reason: string): Promise<VoidOrderV2Result> {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Lý do hủy đơn là bắt buộc" };
    }

    const allOrders = await findAllNoCache("Orders_V2");
    const order = (allOrders as any[]).find(o => o.id === orderId);
    if (!order) return { success: false, error: `Order ${orderId} not found` };
    if (order.status !== ORDER_STATUS.COMPLETED) {
      return { success: false, error: `Order status is ${order.status}, must be COMPLETED to void` };
    }

    const session = await getServerSession(authOptions);
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

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

    // Build reversal entries for ALL SALES_CONSUME rows of this order
    const ledger = await findAllNoCache("Stock_Ledger");
    const oldLedgerRows = (ledger as any[]).filter(l =>
      l.reference_id === orderId && l.transaction_type === "SALES_CONSUME",
    );
    const reversalEntries = oldLedgerRows.map(l => ({
      id: `stk-${crypto.randomUUID()}`,
      transaction_type: "EDIT_REVERSAL",
      reference_id: orderId,
      item_reference: l.item_reference,
      quantity_change: -Number(l.quantity_change),
      unit_cost: Number(l.unit_cost) || 0,
      created_at: eventTime,
      order_event_id: event.id,
      cost_at_sale: Number(l.cost_at_sale) || 0,
      source: l.source || "VARIANT_RECIPE",
    }));

    // 1. Mark order VOIDED
    await update("Orders_V2", orderId, {
      status: ORDER_STATUS.VOIDED,
      voided_at: eventTime,
      voided_by_id: actor.id,
      void_reason: reason,
    });

    // 2. Insert event
    await insert("Order_Events", event);

    // 3. Insert reversal entries
    if (reversalEntries.length > 0) {
      const { insertMany } = require("@/lib/sheets_db");
      await insertMany("Stock_Ledger", reversalEntries);
    }

    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
