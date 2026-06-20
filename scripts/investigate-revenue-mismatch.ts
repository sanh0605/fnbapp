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

  const linesByOrder = new Map<string, any[]>();
  for (const l of lines) {
    if (!linesByOrder.has(l.order_id)) {
      linesByOrder.set(l.order_id, []);
    }
    linesByOrder.get(l.order_id)!.push(l);
  }

  let totalMismatch = 0;

  for (const o of completedOrders) {
    let gross = 0;
    let promoDisc = 0;
    let manualDisc = 0;
    const orderDisc = Number(o.discount_amount || 0);
    const total = Number(o.total_amount || 0);

    const myLines = linesByOrder.get(o.id) || [];
    for (const l of myLines) {
      let modsPrice = 0;
      if (l.modifiers_json) {
        try {
          const parsed = JSON.parse(l.modifiers_json);
          if (Array.isArray(parsed)) {
            parsed.forEach((m: any) => modsPrice += Number(m.price || 0));
          }
        } catch {}
      }
      gross += (Number(l.unit_price) + modsPrice) * Number(l.qty);
      promoDisc += Number(l.line_discount || 0);
      manualDisc += Number(l.line_manual_discount || 0);
    }

    const computedNet = gross - promoDisc - manualDisc - orderDisc;
    const diff = computedNet - total;

    if (Math.abs(diff) > 2) {
      console.log(`Mismatch on ${o.order_no}: computed ${computedNet}, stored ${total}, diff ${diff}`);
      totalMismatch += diff;
    }
  }

  console.log(`\nTotal absolute mismatch value across all orders: ${totalMismatch}`);
}

main().catch(console.error);
