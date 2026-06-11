"use server";

import { findAll, remove, removeMany } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function getOrders() {
  try {
    const [orders, orderLines, products, variants, brands, modifiers, categories] = await Promise.all([
      findAll("Orders"),
      findAll("Order_Lines"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Brands"),
      findAll("Modifiers"),
      findAll("Product_Categories"),
    ]);

    const mappedOrders = orders.map(order => {
      const lines = orderLines.filter(l => l.order_id === order.id).map(line => {
        const product = products.find(p => p.id === line.product_id);
        const variant = variants.find(v => v.id === line.variant_id);
        let mods = [];
        try {
          if (line.modifiers_json) {
            mods = JSON.parse(line.modifiers_json);
          }
        } catch(e){}

        return {
          ...line,
          product_name: product?.name || "Unknown",
          size_name: variant?.size_name || "Unknown",
          modifiers: mods
        };
      });

      const brand = brands.find(b => b.id === order.brand_id);
      let display_order_no = order.order_no;
      if (display_order_no && display_order_no.startsWith('#')) {
        const numStr = display_order_no.replace('#', '').padStart(6, '0');
        const bCode = brand?.code || "ORD";
        display_order_no = `${bCode}${numStr}`;
      } else if (!display_order_no) {
         display_order_no = order.id;
      }

      return {
        ...order,
        display_order_no,
        lines
      };
    });

    mappedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return {
      orders: mappedOrders,
      brands: brands.filter((b: any) => b.status !== "DELETED"),
      products: products.filter((p: any) => p.status !== "DELETED"),
      variants: variants.filter((v: any) => v.status !== "DELETED"),
      modifiers: modifiers.filter((m: any) => m.status !== "DELETED"),
      categories: categories.filter((c: any) => c.status !== "DELETED"),
    };
  } catch (error: any) {
    console.error("Lỗi getOrders:", error);
    return { orders: [], brands: [], products: [], variants: [], modifiers: [], categories: [] };
  }
}

export async function deleteOrder(orderId: string) {
  try {
    const [orderLines, stockLedger] = await Promise.all([
      findAll("Order_Lines"),
      findAll("Stock_Ledger"),
    ]);

    const lineIds = orderLines.filter((l: any) => l.order_id === orderId).map((l: any) => l.id);
    const stockIds = stockLedger.filter((s: any) => s.reference_id === orderId).map((s: any) => s.id);

    if (stockIds.length > 0) await removeMany("Stock_Ledger", stockIds);
    if (lineIds.length > 0) await removeMany("Order_Lines", lineIds);
    await remove("Orders", orderId);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");
    return { success: true };
  } catch (error: any) {
    console.error("Lỗi xoá đơn:", error);
    return { success: false, error: error.message };
  }
}
