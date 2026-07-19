"use server";

import {
  findAll,
  findAllNoCache,
  findAllWhere,
  findAllWhereInBatches,
  findById,
  insert,
  insertMany,
  update,
} from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import crypto from "node:crypto";

import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";
import { buildEditedOrderFromCart } from "@/lib/order-edit-cart";
import { supersedeOrderV2 } from "@/lib/sheets-db-v2-edit";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import { computeMacCostForConsumptionRows } from "@/lib/mac-cogs";
import {
  allocateRecipeConsumption,
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "@/lib/inventory-consumption";
import type { CartInput } from "@/lib/order-cart";
import { voidOrderAtomic } from "@/lib/void-order-transaction";

function parseObject(value: any): any {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

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
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

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

    // Claude code — CODE-13: build Maps once for O(1) lookup instead of O(n) find per line.
    const productById = new Map((products as any[]).map(p => [p.id, p]));
    const variantById = new Map((variants as any[]).map(v => [v.id, v]));

    const mappedOrders: OrderListItem[] = latestOrders.map(order => {
      const orderLinesV2 = (orderLines as any[]).filter(l => l.order_id === order.id);
      const mappedLines = orderLinesV2.map(line => {
        const product = productById.get(line.product_id);
        const variant = variantById.get(line.variant_id);
        let mods: any[] = [];
        try {
          if (line.modifiers_snapshot_json) {
            mods = JSON.parse(line.modifiers_snapshot_json);
          }
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
          product_name: productSnap.name || product?.name || "Unknown",
          size_name: variantSnap.size_name || variant?.size_name || "Unknown",
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
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const current = await findById("Orders_V2", orderId);
  if (!current) return null;

  // Find root
  const rootId = current.parent_order_id || current.id;

  // All versions in chain
  const [rootOrder, childOrders] = await Promise.all([
    rootId === current.id
      ? Promise.resolve(current)
      : findById("Orders_V2", rootId),
    findAllWhere("Orders_V2", {
      eq: { parent_order_id: rootId },
    }),
  ]);
  const chainById = new Map<string, any>();
  for (const order of [rootOrder, current, ...childOrders]) {
    if (order?.id) chainById.set(order.id, order);
  }
  const chainOrders = Array.from(chainById.values());
  chainOrders.sort((a, b) => Number(a.version) - Number(b.version));

  const [orderLines, products, variants, brands, events] = await Promise.all([
    findAllWhereInBatches("Order_Lines_V2", "order_id", [orderId]),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Brands"),
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
      product_name: productSnap.name || product?.name || "Unknown",
      size_name: variantSnap.size_name || variant?.size_name || "Unknown",
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
  events.sort((a: any, b: any) =>
    new Date(b.event_at).getTime() - new Date(a.event_at).getTime(),
  );

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

    // Claude code — CODE-22: require ADMIN before any state mutation.
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const actor = { id: auth.actor.id, name: auth.actor.name };

    const allOrders = await findAllNoCache("Orders_V2");
    const order = (allOrders as any[]).find(o => o.id === orderId);
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

    await voidOrderAtomic({
      orderId,
      event,
      reversalRows: reversalEntries,
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

    // 2. Resolve actor (Claude code — CODE-22: require ADMIN)
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const actor = { id: auth.actor.id, name: auth.actor.name };

    // 3. Load reference data
    const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients, semiProducts] = await Promise.all([
      findAll("Brands"), findAll("Products"), findAll("Product_Variants"),
      findAll("Product_Categories"), findAll("Modifiers"), findAll("Promotions"),
      findAll("Recipes"), findAll("Base_Ingredients"), findAll("Semi_Products"),
    ]);
    const ledger = await findAllNoCache("Stock_Ledger");

    // 4. Build edited order (preserves sale time, increments version)
    const built = buildEditedOrderFromCart(
      { ...input.cart, actor },
      { brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients },
      { order: oldOrderV2, lines: oldLinesV2 },
    );

    // 5. Compute COGS at ORIGINAL sale time (not edit time), using the same MAC path as POS.
    const originalSaleTime = oldOrderV2.created_at;
    const saleMs = new Date(originalSaleTime).getTime();
    const pastLedger = (ledger as any[]).filter(e => {
      const entryTime = new Date(e.created_at || 0).getTime();
      if (entryTime > saleMs) return false;
      return e.reference_id !== oldOrderV2.id;
    });
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);
    const consumptionBalances = buildInventoryBalances(pastLedger, originalSaleTime);

    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const consumptionRows = buildLineConsumptionRows(lineRecipe, line.qty, consumptionBalances, consumptionMaps);
      line.cost_at_sale = computeMacCostForConsumptionRows(consumptionRows, pastLedger, originalSaleTime, consumptionMaps);
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
    const consumeEntries = buildStockLedgerEntries(built, event.id, originalSaleTime, pastLedger, consumptionMaps);

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
  pastLedger: any[],
  consumptionMaps: ReturnType<typeof buildSemiProductRecipeMaps>,
): any[] {
  const entries: any[] = [];
  const balances = buildInventoryBalances(pastLedger, saleTime);
  for (const line of built.lines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    for (const row of buildLineConsumptionRows(lineRecipe, line.qty, balances, consumptionMaps)) {
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
        item_reference: row.item_reference,
        quantity_change: -row.quantity,
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0,
        source: row.source,
      });
    }
  }
  return entries;
}

// Claude code — R12: buildLineConsumptionRows extracted to lib/inventory-consumption.ts (shared).

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
