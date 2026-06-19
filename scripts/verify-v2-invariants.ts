import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { assertOrderInvariants } = require("../lib/order-math");

(async () => {
  const orders = await findAllNoCache("Orders_V2");
  const lines = await findAllNoCache("Order_Lines_V2");
  const completed = orders.filter((o: any) => o.status === "COMPLETED" && !o.superseded_by);
  let pass = 0, fail = 0;
  const failedOrders: any[] = [];
  for (const o of completed) {
    const orderLines = lines.filter((l: any) => l.order_id === o.id).map((l: any) => ({
      ...l,
      qty: Number(l.qty) || 0,
      unit_price: Number(l.unit_price) || 0,
      gross_line_total: Number(l.gross_line_total) || 0,
      promo_discount: Number(l.promo_discount) || 0,
      manual_item_discount: Number(l.manual_item_discount) || 0,
      order_discount_allocation: Number(l.order_discount_allocation) || 0,
      net_line_total: Number(l.net_line_total) || 0,
    }));
    const order = {
      ...o,
      version: Number(o.version) || 1,
      gross_total: Number(o.gross_total) || 0,
      promo_discount_total: Number(o.promo_discount_total) || 0,
      manual_item_discount_total: Number(o.manual_item_discount_total) || 0,
      manual_order_discount: Number(o.manual_order_discount) || 0,
      net_total: Number(o.net_total) || 0,
    };
    try {
      assertOrderInvariants(order, orderLines);
      pass++;
    } catch (e: any) {
      fail++;
      if (failedOrders.length < 5) failedOrders.push({ order_no: o.order_no, error: e.message });
    }
  }
  console.log("Invariant check on COMPLETED V2 orders:");
  console.log("  Pass:", pass);
  console.log("  Fail:", fail);
  if (failedOrders.length > 0) {
    console.log("  Sample failures:");
    failedOrders.forEach((f: any) => console.log("    " + f.order_no + ":", f.error));
  }
})();
