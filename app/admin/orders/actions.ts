"use server";

import { findAll, findAllNoCache, insert, update } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import crypto from "node:crypto";

import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";
import { buildEditedOrderFromCart } from "@/lib/order-edit-cart";
import { computeLineCostAtSale } from "@/lib/order-cogs";
import { supersedeOrderV2 } from "@/lib/sheets-db-v2-edit";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import type { CartInput } from "@/lib/order-cart";

// ============================================================
// Types
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

export interface VoidOrderV2Result {
  success: boolean;
  error?: string;
}

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
// getOrdersV2 — list latest COMPLETED versions with details
// ============================================================

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

    let session = null;
    if (process.env.CLI_MODE !== "true") {
      session = await getServerSession(authOptions);
    }
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

    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin/orders");
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// ============================================================
// editOrderV2 — modify order, write reversal and consumption
// ============================================================

export async function editOrderV2(input: EditOrderV2Input): Promise<EditOrderV2Result> {
  try {
    if (!input.reason || input.reason.trim().length === 0) {
      return { success: false, error: "Lý do chỉnh sửa là bắt buộc" };
    }

    // 1. Load old order + lines
    const [allOrders, allLines] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
    ]);
    const oldOrder = allOrders.find((o: any) => o.id === input.orderId);
    if (!oldOrder) return { success: false, error: `Order ${input.orderId} not found` };

    const oldLines = allLines.filter((l: any) => l.order_id === input.orderId);
    const oldOrderV2 = normalizeOrderV2(oldOrder);
    const oldLinesV2 = oldLines.map(normalizeLineV2);

    // 2. Resolve actor
    let session = null;
    if (process.env.CLI_MODE !== "true") {
      session = await getServerSession(authOptions);
    }
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

    // 3. Load reference data
    const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients] = await Promise.all([
      findAll("Brands"), findAll("Products"), findAll("Product_Variants"),
      findAll("Product_Categories"), findAll("Modifiers"), findAll("Promotions"),
      findAll("Recipes"), findAll("Base_Ingredients"),
    ]);
    const ledger = await findAllNoCache("Stock_Ledger");

    // 4. Build edited order (preserves sale time, increments version)
    const built = buildEditedOrderFromCart(
      { ...input.cart, actor },
      { brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients },
      { order: oldOrderV2, lines: oldLinesV2 },
    );

    // 5. Compute COGS at ORIGINAL sale time (not edit time)
    const originalSaleTime = oldOrderV2.created_at;
    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      line.cost_at_sale = computeLineCostAtSale(lineRecipe, ledger, line.qty, originalSaleTime);
    }

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

    // 7. Build reversal entries (mirror old SALES_CONSUME rows for this order)
    const oldLedgerRows = ledger.filter((l: any) =>
      l.reference_id === oldOrderV2.id && l.transaction_type === "SALES_CONSUME",
    );
    const reversalEntries = oldLedgerRows.map((l: any) => ({
      id: `stk-${crypto.randomUUID()}`,
      transaction_type: "EDIT_REVERSAL",
      reference_id: oldOrderV2.id,
      item_reference: l.item_reference,
      quantity_change: -Number(l.quantity_change), // negate (positive value)
      unit_cost: Number(l.unit_cost) || 0,
      created_at: eventTime,
      order_event_id: event.id,
      cost_at_sale: Number(l.cost_at_sale) || 0,
      source: l.source || "VARIANT_RECIPE",
    }));

    // 8. Build new SALES_CONSUME entries for the new version
    const consumeEntries = buildStockLedgerEntries(built, event.id, originalSaleTime);

    // 9. Execute supersede
    const result = await supersedeOrderV2({
      oldOrderId: oldOrderV2.id,
      expectedOldVersion: input.expectedVersion,
      newOrder: built.order,
      newLines: built.lines,
      event,
      reversalEntries,
      consumeEntries,
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

// ============================================================
// Helper functions for orders and order-edit
// ============================================================

function buildStockLedgerEntries(
  built: ReturnType<typeof buildEditedOrderFromCart>,
  eventId: string,
  saleTime: string,
): any[] {
  const entries: any[] = [];
  for (const line of built.lines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    for (const ing of lineRecipe.variant.ingredients) {
      if (ing.quantity <= 0) continue;
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
        item_reference: ing.ingredient_id,
        quantity_change: -(ing.quantity * line.qty),
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0,
        source: "VARIANT_RECIPE",
      });
    }
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        if (ing.quantity <= 0) continue;
        entries.push({
          id: `stk-${crypto.randomUUID()}`,
          transaction_type: "SALES_CONSUME",
          reference_id: built.order.id,
          item_reference: ing.ingredient_id,
          quantity_change: -(ing.quantity * line.qty),
          unit_cost: 0,
          created_at: saleTime,
          order_event_id: eventId,
          cost_at_sale: 0,
          source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
        });
      }
    }
  }
  return entries;
}

// Coerce raw sheet row (strings) into typed OrderV2/OrderLineV2 with numeric fields
function normalizeOrderV2(row: any): any {
  return {
    ...row,
    version: Number(row.version) || 1,
    gross_total: Number(row.gross_total) || 0,
    promo_discount_total: Number(row.promo_discount_total) || 0,
    manual_item_discount_total: Number(row.manual_item_discount_total) || 0,
    manual_order_discount: Number(row.manual_order_discount) || 0,
    net_total: Number(row.net_total) || 0,
  };
}

function normalizeLineV2(row: any): any {
  return {
    ...row,
    line_no: Number(row.line_no) || 0,
    qty: Number(row.qty) || 0,
    unit_price: Number(row.unit_price) || 0,
    gross_line_total: Number(row.gross_line_total) || 0,
    promo_discount: Number(row.promo_discount) || 0,
    manual_item_discount: Number(row.manual_item_discount) || 0,
    order_discount_allocation: Number(row.order_discount_allocation) || 0,
    net_line_total: Number(row.net_line_total) || 0,
    cost_at_sale: Number(row.cost_at_sale) || 0,
  };
}
