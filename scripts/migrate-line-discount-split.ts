/**
 * Sub-Task 1: Split line_discount for all Order_Lines
 */

import * as fs from "fs";
import * as path from "path";
import { findAllNoCache } from "../lib/sheets_db";
import { batchUpdateOrderLines } from "./batch-sheets-utils";

const IS_LIVE = process.argv.includes("--live");

// ==== Helpers from previous scripts ====
function parseApplicableProducts(rawJson?: string): { variantIds: Set<string>; valueByVariant: Map<string, number | string> } {
  const variantIds = new Set<string>();
  const valueByVariant = new Map<string, number | string>();

  if (!rawJson) return { variantIds, valueByVariant };

  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      parsed.forEach((id: string) => variantIds.add(id));
    } else if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([id, val]) => {
        variantIds.add(id);
        valueByVariant.set(id, val as number | string);
      });
    }
  } catch (e) {}
  return { variantIds, valueByVariant };
}

function computeExpectedLineDiscount(
  unitPrice: number,
  qty: number,
  discountType: string,
  discountValue: number
): number {
  if (discountType === "PERCENT") return unitPrice * qty * (discountValue / 100);
  if (discountType === "FLAT_PRICE") return Math.max(0, unitPrice - discountValue) * qty;
  return discountValue * qty;
}

async function main() {
  console.log(`[migrate-line-discount-split] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);
  
  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");
  const promos = await findAllNoCache("Promotions");

  let classData: any = { orders: [] };
  try {
    const classPath = path.resolve(process.cwd(), "scripts", "output", "classification.json");
    if (fs.existsSync(classPath)) {
      classData = JSON.parse(fs.readFileSync(classPath, "utf8"));
    }
  } catch (e) {
    console.warn("Could not parse classification.json. Proceeding with empty classification data.");
  }

  const promoById = new Map<string, any>(promos.map((p: any) => [p.id, p]));
  const classByOrderId = new Map<string, any>(classData.orders.map((o: any) => [o.orderId, o]));
  const ordersById = new Map<string, any>(orders.map((o: any) => [o.id, o]));

  let updatesNeeded = 0;
  let skipped = 0;
  const samples: any[] = [];
  const batchUpdates: any[] = [];

  for (const line of lines) {
    const order = ordersById.get(line.order_id);
    if (!order || order.status !== "COMPLETED") {
      skipped++;
      continue;
    }

    // If it has already been migrated or is a new order (which writes line_manual_discount = 0 or value)
    if (line.line_manual_discount !== undefined && line.line_manual_discount !== "") {
      skipped++;
      continue;
    }

    const oldLineDiscount = Number(line.line_discount || 0);

    let expectedPromo = 0;
    let isPromoApplied = false;

    const cls = classByOrderId.get(order.id);
    if (cls && (cls.tier === "CONFIRMED" || cls.tier === "INFERRED_HIGH") && cls.matchedPromoId) {
      const promo = promoById.get(cls.matchedPromoId);
      if (promo && promo.type === "PRODUCT_DISCOUNT") {
        const { variantIds, valueByVariant } = parseApplicableProducts(promo.applicable_products_json);
        if (variantIds.has(line.variant_id)) {
          isPromoApplied = true;
          const val = valueByVariant.has(line.variant_id) ? Number(valueByVariant.get(line.variant_id)) : Number(promo.discount_value);
          expectedPromo = computeExpectedLineDiscount(Number(line.unit_price || 0), Number(line.qty || 1), promo.discount_type, val);
        }
      }
    } else if (order.applied_promotion_id) {
      // Fallback
      const promo = promoById.get(order.applied_promotion_id);
      if (promo && promo.type === "PRODUCT_DISCOUNT") {
        const { variantIds, valueByVariant } = parseApplicableProducts(promo.applicable_products_json);
        if (variantIds.has(line.variant_id)) {
          isPromoApplied = true;
          const val = valueByVariant.has(line.variant_id) ? Number(valueByVariant.get(line.variant_id)) : Number(promo.discount_value);
          expectedPromo = computeExpectedLineDiscount(Number(line.unit_price || 0), Number(line.qty || 1), promo.discount_type, val);
        }
      }
    }

    let newLineDiscount = 0;
    let newLineManualDiscount = 0;

    if (isPromoApplied) {
      newLineDiscount = Math.min(oldLineDiscount, Math.round(expectedPromo));
      newLineManualDiscount = Math.max(0, oldLineDiscount - newLineDiscount);
    } else {
      newLineDiscount = 0;
      newLineManualDiscount = oldLineDiscount;
    }

    updatesNeeded++;
    if (samples.length < 5 && oldLineDiscount > 0) {
      samples.push({
        id: line.id,
        variant_id: line.variant_id,
        old_line_discount: oldLineDiscount,
        new_line_discount: newLineDiscount,
        new_line_manual_discount: newLineManualDiscount
      });
    }

    if (IS_LIVE) {
      batchUpdates.push({
        id: line.id,
        data: {
          line_discount: newLineDiscount,
          line_manual_discount: newLineManualDiscount
        }
      });
    }
  }

  console.log(`Total lines: ${lines.length}`);
  console.log(`Updates needed: ${updatesNeeded}`);
  console.log(`Skipped (already split or non-completed order): ${skipped}`);
  console.log("Sample updates:");
  console.table(samples);
  
  if (!IS_LIVE) {
    console.log("Run with --live to execute.");
  } else if (batchUpdates.length > 0) {
    console.log(`Sending ${batchUpdates.length} updates...`);
    await batchUpdateOrderLines(batchUpdates);
    console.log("Updates complete.");
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
