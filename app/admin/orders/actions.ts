"use server";

import {
  findAll,
  findAllWhereInBatches,
} from "@/lib/db/tables";
import { requireAdmin } from "@/lib/auth/auth";
import { getSupabaseClient } from "@/lib/db/supabase";
import { displayMoney } from "@/lib/reports/display-rounding";

import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/sales/order-types";
import { normalizePaymentMethod } from "@/lib/sales/payment-method";
import type { OrderLineV2 } from "@/lib/sales/order-types";
import { parseObject } from "./order-helpers";

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

export interface OrdersV2Filters {
  page?: number;
  q?: string;
  from?: string;
  to?: string;
  payment?: string;
  brand?: string;
}

export interface GetOrdersV2Result {
  orders: OrderListItem[];
  totalCount: number;
  // BR-UI-004: money total over every order the filter matches (all pages).
  // Same rows as totalCount: latest COMPLETED versions only, so voided,
  // superseded and draft orders are out of it.
  totals: { count: number; netTotal: number };
  itemsPerPage: number;
  brands: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  categories: any[];
}

// ============================================================
// getOrdersV2 — list latest COMPLETED versions with details
// ============================================================

const ORDERS_ITEMS_PER_PAGE = 20;

// The one place the orders-list filter is written: the page of rows and the
// money total both read through it, so they can never disagree (BR-UI-004).
// `paymentOrderIds` are the orders that have an order_payments row of the
// wanted method (see paymentFilterOrderIds), so an order paid two ways shows
// under both filters (B1, lib/sales/payment-method.ts).
function applyOrderFilters<Q extends { eq: any; neq: any; gte: any; lte: any; ilike: any; or: any }>(
  query: Q, filters: OrdersV2Filters, paymentOrderIds: string[] = [],
): Q {
  let q: any = query
    .eq("status", ORDER_STATUS.COMPLETED)
    .or("superseded_by.is.null,superseded_by.eq.");
  if (filters.q) q = q.ilike("order_no", `%${filters.q}%`);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  const idClause = paymentOrderIds.length > 0 ? `,id.in.(${paymentOrderIds.join(",")})` : "";
  if (filters.payment === "Chuyen khoan") {
    q = q.or(`payment_method.eq.${PAYMENT_METHOD.BANK_TRANSFER}${idClause}`);
  } else if (filters.payment === "Tien mat") {
    // neq drops NULL in SQL, so a null method (empty = cash) is named too.
    q = q.or(`payment_method.neq.${PAYMENT_METHOD.BANK_TRANSFER},payment_method.is.null${idClause}`);
  }
  if (filters.brand) q = q.eq("brand_id", filters.brand);
  return q;
}

// Orders with an order_payments row of the wanted method: the split orders
// the single payment_method column cannot see. Empty method means cash.
async function paymentFilterOrderIds(
  supabase: ReturnType<typeof getSupabaseClient>, filters: OrdersV2Filters,
): Promise<string[]> {
  if (filters.payment !== "Chuyen khoan" && filters.payment !== "Tien mat") return [];
  const methods = filters.payment === "Chuyen khoan"
    ? [PAYMENT_METHOD.BANK_TRANSFER]
    : [PAYMENT_METHOD.CASH, ""];
  const { data, error } = await supabase.from("order_payments").select("order_id").in("method", methods);
  if (error) throw new Error(error.message);
  return Array.from(new Set((data || []).map((r: any) => String(r.order_id))));
}

// Sums net_total over every matched order, reading the database in chunks of
// 1,000 rows (the most one request returns). Rounded once from the exact sum
// (BR-DATA-005).
const TOTALS_CHUNK = 1000;
async function sumFilteredOrders(
  supabase: ReturnType<typeof getSupabaseClient>, filters: OrdersV2Filters, paymentOrderIds: string[],
): Promise<{ count: number; netTotal: number }> {
  let count = 0;
  let sum = 0;
  for (let from = 0; ; from += TOTALS_CHUNK) {
    const { data, error } = await applyOrderFilters(supabase.from("orders_v2").select("net_total"), filters, paymentOrderIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + TOTALS_CHUNK - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []) as Array<{ net_total: number | string | null }>;
    for (const r of rows) sum += Number(r.net_total) || 0;
    count += rows.length;
    if (rows.length < TOTALS_CHUNK) break;
  }
  return { count, netTotal: displayMoney(sum) };
}

export async function getOrdersV2(filters: OrdersV2Filters = {}): Promise<GetOrdersV2Result> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const page = Math.max(1, filters.page || 1);
    const offset = (page - 1) * ORDERS_ITEMS_PER_PAGE;

    const supabase = getSupabaseClient();
    // Latest versions only: status=COMPLETED AND superseded_by empty/null --
    // filtered, counted, and paginated at the database level instead of
    // fetching the whole (1600+ rows and growing) table on every load.
    const paymentOrderIds = await paymentFilterOrderIds(supabase, filters);
    const ordersQuery = applyOrderFilters(
      supabase.from("orders_v2").select("*", { count: "exact" }), filters, paymentOrderIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + ORDERS_ITEMS_PER_PAGE - 1);

    const [{ data: pageOrders, count, error: ordersError }, totals] = await Promise.all([
      ordersQuery,
      sumFilteredOrders(supabase, filters, paymentOrderIds),
    ]);
    if (ordersError) throw new Error(ordersError.message);

    const orderIds = (pageOrders || []).map((o: any) => o.id);
    const [orderLines, products, variants, brands, modifiers, categories] = await Promise.all([
      findAllWhereInBatches("Order_Lines_V2", "order_id", orderIds),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Brands"),
      findAll("Modifiers"),
      findAll("Product_Categories"),
    ]);

    // Claude code — CODE-13: build Maps once for O(1) lookup instead of O(n) find per line.
    const productById = new Map((products as any[]).map(p => [p.id, p]));
    const variantById = new Map((variants as any[]).map(v => [v.id, v]));

    const mappedOrders: OrderListItem[] = (pageOrders || []).map((order: any) => {
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
          product_name: productSnap.name || product?.name || "Không rõ",
          size_name: variantSnap.size_name || variant?.size_name || "Không rõ",
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
        method: normalizePaymentMethod(order.payment_method) === PAYMENT_METHOD.BANK_TRANSFER ? "Chuyen khoan" : "Tien mat",
        created_by_name: order.created_by_name || "",
        created_at: order.created_at,
        lines: mappedLines,
      };
    });

    return {
      orders: mappedOrders,
      totalCount: count || 0,
      totals,
      itemsPerPage: ORDERS_ITEMS_PER_PAGE,
      brands: (brands as any[]).filter(b => b.status !== "DELETED"),
      products: (products as any[]).filter(p => p.status !== "DELETED"),
      variants: (variants as any[]).filter(v => v.status !== "DELETED"),
      modifiers: (modifiers as any[]).filter(m => m.status !== "DELETED"),
      categories: (categories as any[]).filter(c => c.status !== "DELETED"),
    };
  } catch (err: any) {
    // not in the plan's own list (found while re-deriving it) -- same
    // defect: a real orders-history read failure must not render as "no
    // orders". Rethrow instead; app/error.tsx handles it.
    console.error("[getOrdersV2]", err);
    throw err;
  }
}
