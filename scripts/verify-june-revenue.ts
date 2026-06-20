import { findAllNoCache } from "../lib/sheets_db";

async function main() {
  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");

  const startDate = new Date("2026-06-01T00:00:00Z");
  const endDate = new Date("2026-06-30T23:59:59Z");

  const completedOrders = orders.filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    const d = new Date(o.created_at);
    return d >= startDate && d <= endDate;
  });

  const validOrderIds = new Set(completedOrders.map((o: any) => o.id));

  let totalGross = 0;
  let totalPromoDiscount = 0;
  let totalManualLineDiscount = 0;
  let totalOrderDiscount = 0;
  let totalNet = 0;

  for (const o of completedOrders) {
    totalOrderDiscount += Number(o.discount_amount || 0);
    totalNet += Number(o.total_amount || 0);
  }

  for (const l of lines) {
    if (!validOrderIds.has(l.order_id)) continue;
    
    let modsPrice = 0;
    if (l.modifiers_json) {
      try {
        const parsed = JSON.parse(l.modifiers_json);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: any) => modsPrice += Number(m.price || 0));
        }
      } catch {}
    }
    
    totalGross += (Number(l.unit_price) + modsPrice) * Number(l.qty);
    totalPromoDiscount += Number(l.line_discount || 0);
    totalManualLineDiscount += Number(l.line_manual_discount || 0);
  }

  console.log("=== JUNE 2026 REVENUE VERIFICATION ===");
  console.log(`Total Orders: ${completedOrders.length}`);
  console.log(`Total Gross Revenue: ${totalGross}`);
  console.log(`Total Promo Discount: ${totalPromoDiscount}`);
  console.log(`Total Manual Line Discount: ${totalManualLineDiscount}`);
  console.log(`Total Order Discount: ${totalOrderDiscount}`);
  console.log(`Total Net Revenue: ${totalNet}`);
  console.log("--------------------------------");
  
  const computedNet = totalGross - totalPromoDiscount - totalManualLineDiscount - totalOrderDiscount;
  console.log(`Computed Net (Gross - All Discounts): ${computedNet}`);
  console.log(`Match? ${computedNet === totalNet ? 'YES' : 'NO'}`);
}

main().catch(console.error);
