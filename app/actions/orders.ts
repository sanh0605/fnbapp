"use server";

import { findAll, remove } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function getOrders() {
  try {
    const [orders, orderLines, products, variants, brands] = await Promise.all([
      findAll("Orders"),
      findAll("Order_Lines"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Brands")
    ]);

    // Map lines to orders
    const mappedOrders = orders.map(order => {
      const lines = orderLines.filter(l => l.order_id === order.id).map(line => {
        const product = products.find(p => p.id === line.product_id);
        const variant = variants.find(v => v.id === line.variant_id);
        let modifiers = [];
        try {
          if (line.modifiers_json) {
            modifiers = JSON.parse(line.modifiers_json);
          }
        } catch(e){}

        return {
          ...line,
          product_name: product?.name || "Unknown",
          size_name: variant?.size_name || "Unknown",
          modifiers
        };
      });

      const brand = brands.find(b => b.id === order.brand_id);
      let display_order_no = order.order_no;
      if (display_order_no && display_order_no.startsWith('#')) {
        const numStr = display_order_no.replace('#', '').padStart(6, '0');
        const bCode = brand?.code || "ORD";
        display_order_no = `${bCode}${numStr}`;
      } else if (!display_order_no) {
         // Fallback if no order_no
         display_order_no = order.id;
      }

      return {
        ...order,
        display_order_no,
        lines
      };
    });

    // Sort by created_at descending
    mappedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return mappedOrders;
  } catch (error: any) {
    console.error("Lỗi getOrders:", error);
    return [];
  }
}

export async function deleteOrder(orderId: string) {
  try {
    // 1. Lấy thông tin order lines để xoá liên kết
    const orderLines = await findAll("Order_Lines");
    const linesToDelete = orderLines.filter((l: any) => l.order_id === orderId);

    // 2. Lấy thông tin stock ledger để xoá liên kết (hoàn kho)
    const stockLedger = await findAll("Stock_Ledger");
    const stockToDelete = stockLedger.filter((s: any) => s.reference_id === orderId);

    // 3. Thực hiện xoá lần lượt
    for (const s of stockToDelete) {
      await remove("Stock_Ledger", s.id);
    }

    for (const l of linesToDelete) {
      await remove("Order_Lines", l.id);
    }

    await remove("Orders", orderId);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");
    return { success: true };
  } catch (error: any) {
    console.error("Lỗi xoá đơn:", error);
    return { success: false, error: error.message };
  }
}
