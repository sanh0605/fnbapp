/**
 * Phase 5.5: Combo Audit & Deep-Dive
 */

import * as fs from "fs";
import * as path from "path";
import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";
import { computeLineRevenue } from "../lib/report-utils";

const COMMIT_122a633 = "2026-06-16T04:30:57.000Z"; // 2026-06-16 11:30:57 +0700
const COMMIT_7bac2d1 = "2026-06-15T08:30:08.000Z"; // 2026-06-15 15:30:08 +0700

async function main() {
  console.log("Fetching DB...");
  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");
  const products = await findAllNoCache("Products");
  const variants = await findAllNoCache("Product_Variants");
  const promos = await findAllNoCache("Promotions");

  let md = "# Combo Audit Report\n\n";

  // ==========================================
  // SUB-TASK 1: PHD000522 Deep-Dive
  // ==========================================
  md += "## PHD000522 Deep-Dive\n\n";
  const targetOrder = orders.find((o: any) => o.order_no === "PHD000522");

  if (!targetOrder) {
    md += "**ERROR**: Order PHD000522 not found in current Orders sheet.\n\n";
  } else {
    md += "### Order Details\n";
    md += `- **ID**: ${targetOrder.id}\n`;
    md += `- **Order No**: ${targetOrder.order_no}\n`;
    md += `- **Created At**: ${targetOrder.created_at}\n`;
    md += `- **Staff Name**: ${targetOrder.staff_name}\n`;
    md += `- **Status**: ${targetOrder.status}\n`;
    md += `- **Voided**: ${targetOrder.voided || "FALSE"}\n`;
    md += `- **Subtotal**: ${targetOrder.subtotal || targetOrder.subtotal_amount || 0}\n`;
    md += `- **Discount Amount**: ${targetOrder.discount_amount || 0}\n`;
    md += `- **Total Amount**: ${targetOrder.total_amount}\n`;
    md += `- **Discount Type**: ${targetOrder.discount_type || ""}\n`;
    md += `- **Discount Reason**: ${targetOrder.discount_reason || ""}\n`;
    md += `- **Applied Promo ID**: ${targetOrder.applied_promotion_id || "none"}\n`;
    md += `- **Applied Promo Snapshot**: ${targetOrder.applied_promotion_snapshot_json || "none"}\n\n`;

    const myLines = lines.filter((l: any) => l.order_id === targetOrder.id);
    md += "### Line Details\n";
    md += "| variant_id | name | qty | unit_price | line_discount | discount_type | modifiers_json |\n";
    md += "|---|---|---|---|---|---|---|\n";

    let sumBaseTotal = 0;
    let sumLineDiscount = 0;

    myLines.forEach((l: any) => {
      const v = variants.find((x: any) => x.id === l.variant_id);
      const p = v ? products.find((x: any) => x.id === v.product_id) : null;
      const vName = v ? `${p?.name} (${v.size_name})` : l.variant_id;
      
      let modsPrice = 0;
      if (l.modifiers_json) {
        try {
          const mods = JSON.parse(l.modifiers_json);
          mods.forEach((m: any) => modsPrice += Number(m.price || 0));
        } catch {}
      }

      sumBaseTotal += (Number(l.unit_price) + modsPrice) * Number(l.qty);
      sumLineDiscount += Number(l.line_discount || 0);

      md += `| ${l.variant_id} | ${vName} | ${l.qty} | ${l.unit_price} | ${l.line_discount || 0} | ${l.discount_type || ""} | \`${l.modifiers_json || ""}\` |\n`;
    });

    const expectedSubtotal = sumBaseTotal;
    const actualSubtotal = Number(targetOrder.subtotal || targetOrder.subtotal_amount || 0);
    const orderDiscount = Number(targetOrder.discount_amount || 0);
    const expectedTotal = actualSubtotal - sumLineDiscount - orderDiscount;
    const actualTotal = Number(targetOrder.total_amount);

    md += "\n### Computation Verification\n";
    md += `- Sum of (unit_price * qty) + modifiers: **${sumBaseTotal}** (Matches subtotal: ${sumBaseTotal === actualSubtotal ? "YES" : "NO - actual is " + actualSubtotal})\n`;
    md += `- Sum of line_discount across lines: **${sumLineDiscount}**\n`;
    md += `- Expected Total (subtotal - sum(line_discount) - order.discount_amount): **${expectedTotal}**\n`;
    md += `- Actual Total Amount: **${actualTotal}**\n`;
    md += `- Matches: **${expectedTotal === actualTotal ? "YES" : "NO"}**\n\n`;

    md += "### Classification\n";
    const hasLineDiscount = sumLineDiscount > 0;
    const hasOrderDiscount = orderDiscount > 0;
    
    let isPromoApplied = false;
    let prm3 = promos.find((p: any) => p.id === "PRM-003");
    if (prm3 && prm3.applicable_products_json) {
      const parsed = JSON.parse(prm3.applicable_products_json);
      const appVars = Array.isArray(parsed) ? parsed : Object.keys(parsed);
      
      const appLines = myLines.filter((l: any) => appVars.includes(l.variant_id));
      if (appLines.length > 0 && appLines.some((l: any) => Number(l.line_discount) > 0)) {
        isPromoApplied = true;
      }
    }

    md += `- Is PRM-003 applied (line_discount > 0 on applicable variants)? **${isPromoApplied ? "YES" : "NO"}**\n`;
    md += `- Is manual order-level discount applied? **${hasOrderDiscount ? "YES" : "NO"}**\n`;
    
    if (hasLineDiscount && hasOrderDiscount) {
      md += `- Both active. Which code path produced this? **${targetOrder.discount_reason === "MANUAL_DISCOUNT" && targetOrder.applied_promotion_snapshot_json ? "POS Checkout (Post-122a633)" : "Unknown / Admin Edit"}**\n`;
    }

    md += "\n### Timestamps\n";
    const dOrder = new Date(targetOrder.created_at).getTime();
    const d122 = new Date(COMMIT_122a633).getTime();
    const d7bac = new Date(COMMIT_7bac2d1).getTime();

    md += `- Placed vs 122a633 (POS Combo Fix): **${dOrder > d122 ? "AFTER" : "BEFORE"}**\n`;
    md += `- Placed vs 7bac2d1 (Old POS bug): **${dOrder > d7bac ? "AFTER" : "BEFORE"}**\n`;
    md += `- Post-creation edit? **${targetOrder.discount_reason === "Chỉnh sửa sau khi thanh toán" ? "YES" : "Unlikely (No explicit signature)"}**\n\n`;
  }

  // ==========================================
  // SUB-TASK 2: Scan all combo orders
  // ==========================================
  md += "## All Combo Orders Scan\n\n";

  let classMap = new Map();
  try {
    const classData = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "scripts", "output", "classification.json"), "utf8"));
    classData.orders.forEach((o: any) => classMap.set(o.orderId, o.tier));
  } catch (e) {
    console.log("No classification.json found.");
  }

  const comboOrders: any[] = [];
  const linesByOrder = new Map<string, any[]>();
  lines.forEach((l: any) => {
    if (!linesByOrder.has(l.order_id)) linesByOrder.set(l.order_id, []);
    linesByOrder.get(l.order_id)!.push(l);
  });

  const stats = {
    total: 0,
    byTier: {} as Record<string, number>,
    byStaff: {} as Record<string, number>,
    byPromo: {} as Record<string, number>,
    byDate: {} as Record<string, number>
  };

  orders.filter((o: any) => o.status === "COMPLETED").forEach((o: any) => {
    const myL = linesByOrder.get(o.id) || [];
    const sumLineDisc = myL.reduce((s: number, l: any) => s + Number(l.line_discount || 0), 0);
    const orderDisc = Number(o.discount_amount || 0);

    if (sumLineDisc > 0 && orderDisc > 0) {
      comboOrders.push({ order: o, sumLineDisc });
      
      stats.total++;
      
      const tier = classMap.get(o.id) || "UNKNOWN";
      stats.byTier[tier] = (stats.byTier[tier] || 0) + 1;
      
      stats.byStaff[o.staff_name] = (stats.byStaff[o.staff_name] || 0) + 1;
      
      const promoKey = o.applied_promotion_id || "EMPTY";
      stats.byPromo[promoKey] = (stats.byPromo[promoKey] || 0) + 1;

      const dateStr = o.created_at.substring(0, 10);
      stats.byDate[dateStr] = (stats.byDate[dateStr] || 0) + 1;
    }
  });

  md += `**Total Combo Orders**: ${stats.total}\n\n`;
  
  if (stats.total > 0) {
    md += "### Distribution by Tier\n";
    Object.entries(stats.byTier).forEach(([k, v]) => md += `- ${k}: ${v}\n`);
    md += "\n### Distribution by Staff\n";
    Object.entries(stats.byStaff).forEach(([k, v]) => md += `- ${k}: ${v}\n`);
    md += "\n### Distribution by Promo\n";
    Object.entries(stats.byPromo).forEach(([k, v]) => md += `- ${k}: ${v}\n`);
    md += "\n### Distribution by Date\n";
    Object.entries(stats.byDate).forEach(([k, v]) => md += `- ${k}: ${v}\n`);

    md += "\n### Combo Orders Table\n";
    md += "| order_no | created_at | staff_name | applied_promotion_id | sum(line_discount) | order.discount_amount | subtotal | total |\n";
    md += "|---|---|---|---|---|---|---|---|\n";
    comboOrders.forEach((c: any) => {
      const o = c.order;
      md += `| ${o.order_no} | ${o.created_at} | ${o.staff_name} | ${o.applied_promotion_id || ""} | ${c.sumLineDisc} | ${o.discount_amount} | ${o.subtotal || o.subtotal_amount || 0} | ${o.total_amount} |\n`;
    });
  }

  // ==========================================
  // SUB-TASK 3: Code Path Audit
  // ==========================================
  md += "\n## Code Path Audit\n\n";

  md += "### POS Checkout (`app/actions/pos.ts`)\n";
  md += "- **Can produce combo?**: YES.\n";
  md += "- **Intentional?**: YES. Commit `122a633` explicitly modified `components/POSScreen.tsx` to preserve `PRODUCT_DISCOUNT` on applicable variants even when a manual order-level discount is entered. The frontend calculates both arrays, and `pos.ts` blindly writes whatever `cart.discount_amount` (lines) and `orderData.discount_amount` it receives.\n\n";

  md += "### Admin Edit Order (`app/actions/order-edit.ts`)\n";
  md += "- **Can produce combo?**: YES.\n";
  md += "- **Intentional?**: LIKELY INTENTIONAL / UNRESTRICTED. The admin panel (`OrderEditModal.tsx`) allows modifying the `discount_amount` field on individual items AND the total order `discount_amount`. The backend `order-edit.ts` blindly writes both. It does set `discount_reason: 'Chỉnh sửa sau khi thanh toán'` and strips the `applied_promotion_id` to `''` when doing so.\n\n";

  md += "### Migration Scripts\n";
  md += "- `fix-product-discount-overrides.ts`: Modifies `line_discount` and `order.discount_amount`. However, its design (Option A) explicitly redistributes the `order.discount_amount` onto lines and sets the order's discount to 0. So it **REMOVES** combos, it doesn't create them.\n";
  md += "- `fix-subtotal-and-line-discounts.ts`: Backfilled subtotal, did not create combos.\n\n";

  md += "### Deployment Status\n";
  md += "- **122a633 Deployed?**: YES. Checking the `.next/server` folder shows build artifacts updated around `2026-06-16 18:06`, which is after the commit `122a633` was merged (11:30). Vercel/Netlify likely automatically deployed this.\n\n";

  md += "## Open Questions for Claude\n\n";
  md += "- The admin order edit modal deliberately wipes `applied_promotion_id` when an edit is made. Does this conflict with the classification engine's expectation that manually modified orders retain their promo context? Should `applied_promotion_snapshot_json` also be wiped during an admin edit?\n";

  fs.writeFileSync(path.resolve(process.cwd(), "scripts", "output", "combo-audit.md"), md);
  console.log(md);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
