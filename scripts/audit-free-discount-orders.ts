import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TARGET_ORDER_NOS = ["PHD000351", "PHD000540", "PHD000561", "PHD000548", "PHD000562"];

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  const targetSet = new Set(TARGET_ORDER_NOS);
  const selected = (orders as any[])
    .filter(order => targetSet.has(order.order_no))
    .sort((a, b) => String(a.order_no).localeCompare(String(b.order_no)));

  for (const order of selected) {
    console.log(`\n${order.order_no} | id=${order.id} | created=${order.created_at}`);
    console.log(
      `gross=${order.gross_total} | promo=${order.promo_discount_total} | manual_item=${order.manual_item_discount_total} | manual_order=${order.manual_order_discount} | net=${order.net_total} | promo_id=${order.applied_promotion_id || "-"}`,
    );

    const orderLines = (lines as any[]).filter(line => line.order_id === order.id);
    for (const line of orderLines) {
      const product = parseJson(line.product_snapshot_json, {});
      const variant = parseJson(line.variant_snapshot_json, {});
      const modifiers = parseJson(line.modifiers_snapshot_json, []);
      const modifierSummary = Array.isArray(modifiers) && modifiers.length > 0
        ? modifiers.map((modifier: any) =>
            `${modifier.name || modifier.id} x${modifier.qty || 1} @${modifier.price || 0}`,
          ).join("; ")
        : "-";

      console.log(
        `  line=${line.id} | qty=${line.qty} | product=${product.name || line.product_id} | size=${variant.size_name || line.variant_id} | unit=${line.unit_price} | gross=${line.gross_line_total} | promo=${line.promo_discount} | order_alloc=${line.order_discount_allocation} | net=${line.net_line_total}`,
      );
      console.log(`    modifiers=${modifierSummary}`);
    }
  }
}

function parseJson(value: string, fallback: any) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
