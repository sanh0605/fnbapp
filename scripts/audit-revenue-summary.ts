/**
 * Deep Revenue Audit — Per-Product Revenue Summary
 *
 * For each variant that has ever been the target of a PRODUCT_DISCOUNT
 * promotion, compute the actual revenue (using the same computeLineRevenue
 * function the P&L report uses) and compare it to the expected revenue
 * if the promo price had been strictly enforced.
 *
 * Output: audit-summary.json (+ console headline)
 *
 * Headline number this surfaces for Sữa Dâu:
 *   - Total qty sold during promo window
 *   - Expected revenue (qty * 25.000đ)
 *   - Actual revenue (sum of computeLineRevenue.variantRevenue)
 *   - Delta (actual - expected)
 *   - List of order IDs that contributed to the delta
 *
 * Usage: npx tsx scripts/audit-revenue-summary.ts
 */

import { findAllNoCache } from "../lib/sheets_db";
import { computeLineRevenue } from "../_legacy/lib/report-utils";
import * as fs from "fs";
import * as path from "path";

// ===== Types =====

interface PromoWindow {
  promoId: string;
  promoName: string;
  startDate: string;
  endDate: string;
  discountType: "PERCENT" | "FLAT_PRICE" | string;
  discountValue: number;
}

interface ProductRevenueSummary {
  productId: string;
  productName: string;
  variantId: string;
  sizeName: string;
  expectedPromoUnitPrice: number;
  expectedPromoUnitPriceNote: string;
  totalQtySoldDuringPromo: number;
  expectedRevenueDuringPromo: number;
  actualRevenueDuringPromo: number;
  delta: number;
  anomalousOrderCount: number;
  anomalousOrderIds: string[];
  anomalousOrderSamples: string[];
}

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  created_at: string;
}

interface LineRow {
  id: string;
  order_id: string;
  variant_id: string;
  qty: string | number;
  unit_price: string | number;
  line_discount: string | number;
  modifiers_json: string;
}

// ===== Helpers =====

function parseApplicableVariants(rawJson?: string): string[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) return parsed as string[];
    if (parsed && typeof parsed === "object") return Object.keys(parsed);
  } catch {}
  return [];
}

/**
 * Expected revenue per unit for a variant under a given PRODUCT_DISCOUNT promo.
 * - FLAT_PRICE: the customer pays exactly `discountValue` per unit (e.g., 25k promo)
 * - PERCENT:    customer pays `unitPrice * (1 - val/100)`
 * - FLAT VND:   customer pays `max(0, unitPrice - val)`
 *
 * NOTE: this assumes the variant's unit_price captured on the order line is the
 * pre-promo price (which it is, per POS logic). For FLAT_PRICE, the expected
 * unit price is independent of unit_price.
 */
function expectedUnitRevenue(unitPrice: number, window: PromoWindow): number {
  if (window.discountType === "FLAT_PRICE") {
    return window.discountValue;
  }
  if (window.discountType === "PERCENT") {
    return unitPrice * (1 - window.discountValue / 100);
  }
  return Math.max(0, unitPrice - window.discountValue);
}

// ===== Main =====

async function main() {
  console.log("[audit-revenue-summary] Fetching Orders, Order_Lines, Product_Variants, Products, Promotions ...");

  const [orders, orderLines, variants, products, promotions] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Products"),
    findAllNoCache("Promotions"),
  ]);

  const variantById = new Map<string, any>((variants as any[]).map((v) => [v.id, v]));
  const productById = new Map<string, any>((products as any[]).map((p) => [p.id, p]));

  // Build promo windows per variant
  const promoWindowsByVariant = new Map<string, PromoWindow[]>();
  for (const promo of promotions as any[]) {
    if (promo.type !== "PRODUCT_DISCOUNT") continue;
    const applicable = parseApplicableVariants(promo.applicable_products_json);
    for (const variantId of applicable) {
      const windows = promoWindowsByVariant.get(variantId) || [];
      windows.push({
        promoId: promo.id,
        promoName: promo.name,
        startDate: promo.start_date,
        endDate: promo.end_date || "",
        discountType: promo.discount_type,
        discountValue: Number(promo.discount_value),
      });
      promoWindowsByVariant.set(variantId, windows);
    }
  }

  function findPromoAt(variantId: string, atIso: string): PromoWindow | undefined {
    const windows = promoWindowsByVariant.get(variantId);
    if (!windows || windows.length === 0) return undefined;
    const atMs = new Date(atIso).getTime();
    return windows.find((w) => {
      const startMs = new Date(w.startDate).getTime();
      if (startMs > atMs) return false;
      if (w.endDate && new Date(w.endDate).getTime() < atMs) return false;
      return true;
    });
  }

  // Group lines by order for quick lookup
  const linesByOrderId = new Map<string, LineRow[]>();
  for (const lineRaw of orderLines as any[]) {
    const line = lineRaw as LineRow;
    const arr = linesByOrderId.get(line.order_id) || [];
    arr.push(line);
    linesByOrderId.set(line.order_id, arr);
  }

  // Pre-compute order_discount_ratio per order (mirrors reports.ts:160-164)
  const orderDiscountRatioById = new Map<string, number>();
  for (const orderRaw of orders as any[]) {
    const order = orderRaw as OrderRow;
    if (order.status !== "COMPLETED") continue;
    const subtotal = Number(order.subtotal || order.subtotal_amount || 0);
    const orderDiscount = Number(order.discount_amount || 0);
    orderDiscountRatioById.set(order.id, subtotal > 0 ? Math.min(1, orderDiscount / subtotal) : 0);
  }

  // ===== Build per-variant summary =====
  const summary: ProductRevenueSummary[] = [];

  for (const [variantId, windows] of promoWindowsByVariant.entries()) {
    const variant = variantById.get(variantId);
    if (!variant) continue;
    const product = productById.get(variant.product_id);
    const productName = product?.name || variant.product_id;

    let totalQty = 0;
    let actualRevenue = 0;
    let expectedRevenue = 0;
    const anomalousOrderIds: string[] = [];

    for (const orderRaw of orders as any[]) {
      const order = orderRaw as OrderRow;
      if (order.status !== "COMPLETED") continue;

      const activePromo = findPromoAt(variantId, order.created_at);
      if (!activePromo) continue;

      const orderLinesForOrder = linesByOrderId.get(order.id) || [];
      const orderDiscountRatio = orderDiscountRatioById.get(order.id) || 0;

      for (const line of orderLinesForOrder) {
        if (line.variant_id !== variantId) continue;

        const qty = Number(line.qty || 0);
        const unitPrice = Number(line.unit_price || 0);

        const lineRev = computeLineRevenue({
          qty,
          unit_price: unitPrice,
          line_discount: Number(line.line_discount || 0),
          modifiers_json: line.modifiers_json || "",
          order_discount_ratio: orderDiscountRatio,
        });

        const expectedPerUnit = expectedUnitRevenue(unitPrice, activePromo);
        const expectedLineTotal = expectedPerUnit * qty;

        totalQty += qty;
        actualRevenue += lineRev.variantRevenue;
        expectedRevenue += expectedLineTotal;

        if (Math.abs(lineRev.variantRevenue - expectedLineTotal) > 2) {
          if (!anomalousOrderIds.includes(order.id)) {
            anomalousOrderIds.push(order.id);
          }
        }
      }
    }

    if (totalQty === 0) continue;

    // Use the most recent promo window for the headline "expected unit price" label
    const referenceWindow = windows.sort((a, b) =>
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )[0];

    const expectedUnitPriceNote =
      referenceWindow.discountType === "FLAT_PRICE"
        ? `${referenceWindow.discountValue.toLocaleString("vi-VN")}đ (FLAT_PRICE per ${referenceWindow.promoName})`
        : referenceWindow.discountType === "PERCENT"
          ? `${referenceWindow.discountValue}% off`
          : `${referenceWindow.discountValue.toLocaleString("vi-VN")}đ off`;

    summary.push({
      productId: variant.product_id,
      productName,
      variantId,
      sizeName: variant.size_name || "",
      expectedPromoUnitPrice: referenceWindow.discountType === "FLAT_PRICE"
        ? referenceWindow.discountValue
        : 0, // For non-FLAT_PRICE, expected unit price depends on the line's unit_price
      expectedPromoUnitPriceNote: expectedUnitPriceNote,
      totalQtySoldDuringPromo: totalQty,
      expectedRevenueDuringPromo: Math.round(expectedRevenue),
      actualRevenueDuringPromo: Math.round(actualRevenue),
      delta: Math.round(actualRevenue - expectedRevenue),
      anomalousOrderCount: anomalousOrderIds.length,
      anomalousOrderIds,
      anomalousOrderSamples: anomalousOrderIds.slice(0, 10),
    });
  }

  // Sort by absolute delta (biggest revenue impact first)
  summary.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // ===== Output =====
  const outputPath = path.resolve(process.cwd(), "audit-summary.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2)
  );

  console.log(`\n[audit-revenue-summary] Wrote ${summary.length} variants to ${outputPath}\n`);

  console.log("=== PER-PRODUCT REVENUE UNDER PRODUCT_DISCOUNT PROMO WINDOWS ===\n");
  console.log(
    "Product | Variant | Qty | Expected/unit | Expected Total | Actual Total | Delta | # Bad Orders"
  );
  for (const s of summary) {
    const deltaStr = `${s.delta >= 0 ? "+" : ""}${s.delta.toLocaleString("vi-VN")}`;
    console.log(
      `${s.productName} | ${s.sizeName} | ${s.totalQtySoldDuringPromo} | ${s.expectedPromoUnitPriceNote} | ${s.expectedRevenueDuringPromo.toLocaleString("vi-VN")} | ${s.actualRevenueDuringPromo.toLocaleString("vi-VN")} | ${deltaStr} | ${s.anomalousOrderCount}`
    );
  }

  // Highlight Sữa Dâu specifically if present
  const suaDau = summary.find((s) => /sữa\s*dâu/i.test(s.productName));
  if (suaDau) {
    console.log(`\n=== HEADLINE: Sữa Dâu ===`);
    console.log(`  Expected unit price under promo: ${suaDau.expectedPromoUnitPriceNote}`);
    console.log(`  Total qty sold during promo:     ${suaDau.totalQtySoldDuringPromo} ly`);
    console.log(`  Expected revenue:                 ${suaDau.expectedRevenueDuringPromo.toLocaleString("vi-VN")}đ`);
    console.log(`  Actual revenue:                   ${suaDau.actualRevenueDuringPromo.toLocaleString("vi-VN")}đ`);
    console.log(`  Delta (actual - expected):        ${suaDau.delta >= 0 ? "+" : ""}${suaDau.delta.toLocaleString("vi-VN")}đ`);
    console.log(`  Anomalous orders:                 ${suaDau.anomalousOrderCount}`);
    if (suaDau.anomalousOrderSamples.length > 0) {
      console.log(`  Sample order IDs:                 ${suaDau.anomalousOrderSamples.join(", ")}`);
    }
  } else {
    console.log(`\n[NOTE] No variant matching "Sữa Dâu" was found in promo windows. Check promotion.applicable_products_json.`);
  }
}

main().catch((err) => {
  console.error("[audit-revenue-summary] FATAL:", err);
  process.exit(1);
});
