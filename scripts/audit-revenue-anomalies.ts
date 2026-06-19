/**
 * Deep Revenue Audit — Per-Order Anomaly Detection
 *
 * Flags historical orders where manual order-level discounts collided with
 * PRODUCT_DISCOUNT promotions, plus related line_discount inconsistencies.
 *
 * Output: audit-anomalies.json (+ console summary)
 *
 * Anomaly types:
 *   1. PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT
 *      Order has applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT"
 *      AND order.discount_amount > 0. This is the UCK000094 case: cashier
 *      entered a manual order-level discount, which the current POS logic
 *      treats as overriding the promo (see POSScreen.tsx:442-452).
 *
 *   2. APPLICABLE_VARIANT_LINE_DISCOUNT_MISMATCH
 *      Line on a variant listed in the order's promo snapshot has a
 *      line_discount that does not match what the promo formula would
 *      produce. Indicates partial/incorrect recovery from prior scripts.
 *
 *   3. NON_APPLICABLE_VARIANT_HAS_LINE_DISCOUNT
 *      Line on a variant NOT in the order's promo snapshot has
 *      line_discount > 0. Most likely a leftover from the buggy
 *      fix-historical-discounts.ts prorating script that was never cleaned
 *      up (recover-product-discount.ts only fixed applicable variants).
 *
 *   4. POTENTIAL_PROMO_NOT_APPLIED
 *      Order placed during an active PRODUCT_DISCOUNT promo window for
 *      one of its variants, but the order has no promo snapshot AND the
 *      line_discount does not match the promo formula. Suggests the promo
 *      was silently dropped at checkout time.
 *
 * Usage: npx tsx scripts/audit-revenue-anomalies.ts
 */

import { findAllNoCache } from "../lib/sheets_db";
import * as fs from "fs";
import * as path from "path";

// ===== Types =====

interface PromotionSnapshot {
  id?: string;
  name?: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE";
  discount_value: number | string;
  applicable_products_json?: string;
}

interface Anomaly {
  orderId: string;
  orderNo: string;
  createdAt: string;
  type: string;
  description: string;
  details: Record<string, any>;
}

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  total_amount: string | number;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  applied_promotion_id?: string;
  applied_promotion_snapshot_json?: string;
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

interface VariantRow {
  id: string;
  product_id: string;
  size_name: string;
  price: string | number;
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
 * Expected per-line discount for a variant covered by a PRODUCT_DISCOUNT promo.
 * Mirrors the formula in POSScreen.tsx (lines 474-482) and recover-product-discount.ts.
 */
function computeExpectedLineDiscount(
  unitPrice: number,
  qty: number,
  discountType: "PERCENT" | "FLAT_PRICE" | string,
  discountValue: number
): number {
  if (discountType === "PERCENT") {
    return unitPrice * qty * (discountValue / 100);
  }
  if (discountType === "FLAT_PRICE") {
    return Math.max(0, unitPrice - discountValue) * qty;
  }
  // Default: flat VND per unit
  return discountValue * qty;
}

// ===== Main =====

async function main() {
  console.log("[audit-revenue-anomalies] Fetching Orders, Order_Lines, Product_Variants, Products, Promotions ...");

  const [orders, orderLines, variants, products, promotions] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Products"),
    findAllNoCache("Promotions"),
  ]);

  const variantById = new Map<string, VariantRow>(
    (variants as any[]).map((v) => [v.id, v as VariantRow])
  );
  const productById = new Map<string, any>((products as any[]).map((p) => [p.id, p]));

  // Build promo windows per variant for the "POTENTIAL_PROMO_NOT_APPLIED" check.
  // Only PRODUCT_DISCOUNT promos create windows; ORDER_DISCOUNT doesn't target variants.
  const promoWindowsByVariant = new Map<
    string,
    Array<{
      promoId: string;
      promoName: string;
      startDate: string;
      endDate: string;
      discountType: string;
      discountValue: number;
    }>
  >();

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

  function findPromoAt(variantId: string, atIso: string) {
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

  const anomalies: Anomaly[] = [];

  for (const orderRaw of orders as any[]) {
    const order = orderRaw as OrderRow;
    if (order.status !== "COMPLETED") continue;

    const orderLinesForOrder = (orderLines as any[]).filter(
      (l) => (l as LineRow).order_id === order.id
    ) as LineRow[];
    if (orderLinesForOrder.length === 0) continue;

    // Parse promo snapshot
    let promoSnapshot: PromotionSnapshot | null = null;
    if (order.applied_promotion_snapshot_json) {
      try {
        promoSnapshot = JSON.parse(order.applied_promotion_snapshot_json) as PromotionSnapshot;
      } catch {}
    }

    const orderDiscount = Number(order.discount_amount || 0);
    const orderNo = order.order_no || order.id;

    // ===== Anomaly 1: PRODUCT_DISCOUNT + manual order-level discount =====
    if (promoSnapshot?.type === "PRODUCT_DISCOUNT" && orderDiscount > 0) {
      anomalies.push({
        orderId: order.id,
        orderNo,
        createdAt: order.created_at,
        type: "PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT",
        description: `Đơn có CTKM PRODUCT_DISCOUNT (${promoSnapshot.name || promoSnapshot.id || "?"}) nhưng discount_amount = ${orderDiscount}. Trong logic POS hiện tại, cashier nhập chiết khấu thủ công trên modal checkout sẽ ghi đè hoàn toàn lên CTKM PRODUCT_DISCOUNT, làm mất doanh thu chuẩn của món được khuyến mãi.`,
        details: {
          promoName: promoSnapshot.name || promoSnapshot.id,
          discountType: promoSnapshot.discount_type,
          discountValue: promoSnapshot.discount_value,
          orderDiscountAmount: orderDiscount,
          lineCount: orderLinesForOrder.length,
        },
      });
    }

    // ===== Anomaly 2 & 3: line_discount mismatches under PRODUCT_DISCOUNT snapshot =====
    if (promoSnapshot?.type === "PRODUCT_DISCOUNT") {
      const applicableVariants = parseApplicableVariants(promoSnapshot.applicable_products_json);

      for (const line of orderLinesForOrder) {
        const qty = Number(line.qty || 0);
        const unitPrice = Number(line.unit_price || 0);
        const actualLineDiscount = Number(line.line_discount || 0);
        const variant = variantById.get(line.variant_id);
        const variantLabel = variant
          ? `${productById.get(variant.product_id)?.name || variant.product_id} (${variant.size_name})`
          : line.variant_id;

        if (applicableVariants.includes(line.variant_id)) {
          // Anomaly 2
          const expected = computeExpectedLineDiscount(
            unitPrice,
            qty,
            promoSnapshot.discount_type,
            Number(promoSnapshot.discount_value)
          );
          if (Math.abs(actualLineDiscount - expected) > 2) {
            anomalies.push({
              orderId: order.id,
              orderNo,
              createdAt: order.created_at,
              type: "APPLICABLE_VARIANT_LINE_DISCOUNT_MISMATCH",
              description: `Món được CTKM "${variantLabel}": line_discount thực tế = ${actualLineDiscount}, kỳ vọng theo công thức CTKM = ${Math.round(expected)}.`,
              details: {
                variantId: line.variant_id,
                variantLabel,
                unitPrice,
                qty,
                discountType: promoSnapshot.discount_type,
                discountValue: promoSnapshot.discount_value,
                actualLineDiscount,
                expectedLineDiscount: Math.round(expected),
                diff: Math.round(actualLineDiscount - expected),
              },
            });
          }
        } else {
          // Anomaly 3
          if (actualLineDiscount > 0) {
            anomalies.push({
              orderId: order.id,
              orderNo,
              createdAt: order.created_at,
              type: "NON_APPLICABLE_VARIANT_HAS_LINE_DISCOUNT",
              description: `Món không thuộc CTKM "${variantLabel}" có line_discount = ${actualLineDiscount}. Có thể do tàn dư từ script fix-historical-discounts.ts (chia đều) chưa được dọn.`,
              details: {
                variantId: line.variant_id,
                variantLabel,
                actualLineDiscount,
              },
            });
          }
        }
      }
    }

    // ===== Anomaly 4: promo-eligible variant ordered during promo window but no snapshot =====
    if (!promoSnapshot || promoSnapshot.type !== "PRODUCT_DISCOUNT") {
      for (const line of orderLinesForOrder) {
        const variant = variantById.get(line.variant_id);
        if (!variant) continue;

        const activePromo = findPromoAt(line.variant_id, order.created_at);
        if (!activePromo) continue;

        const qty = Number(line.qty || 0);
        const unitPrice = Number(line.unit_price || 0);
        const expected = computeExpectedLineDiscount(
          unitPrice,
          qty,
          activePromo.discountType,
          activePromo.discountValue
        );
        const actual = Number(line.line_discount || 0);

        // Only flag when the promo would have applied a non-trivial discount
        // AND the actual line_discount doesn't already match (avoids noise
        // from cashiers who legitimately chose not to apply the promo).
        if (expected > 1000 && Math.abs(actual - expected) > 2) {
          anomalies.push({
            orderId: order.id,
            orderNo,
            createdAt: order.created_at,
            type: "POTENTIAL_PROMO_NOT_APPLIED",
            description: `Món "${productById.get(variant.product_id)?.name || variant.product_id} (${variant.size_name})" nằm trong cửa sổ CTKM ${activePromo.promoName} đang hoạt động, nhưng đơn không có promo snapshot và line_discount không khớp kỳ vọng.`,
            details: {
              variantId: line.variant_id,
              activePromoId: activePromo.promoId,
              activePromoName: activePromo.promoName,
              unitPrice,
              qty,
              expectedLineDiscount: Math.round(expected),
              actualLineDiscount: actual,
              orderDiscountAmount: orderDiscount,
            },
          });
        }
      }
    }
  }

  // ===== Output =====
  const outputPath = path.resolve(process.cwd(), "audit-anomalies.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), anomalies }, null, 2)
  );

  console.log(`\n[audit-revenue-anomalies] Wrote ${anomalies.length} anomalies to ${outputPath}`);

  const byType: Record<string, number> = {};
  for (const a of anomalies) byType[a.type] = (byType[a.type] || 0) + 1;
  console.log("\nBreakdown by type:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }

  // Print first 5 examples per type for quick triage
  console.log("\nSample anomalies (up to 3 per type):");
  for (const type of Object.keys(byType)) {
    console.log(`\n  --- ${type} ---`);
    anomalies
      .filter((a) => a.type === type)
      .slice(0, 3)
      .forEach((a) => {
        console.log(`    [${a.orderNo}] ${a.description}`);
      });
  }

  // Headline: orders that look like UCK000094
  const uckLike = anomalies.filter((a) => a.type === "PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT");
  if (uckLike.length > 0) {
    console.log(`\n[HEADLINE] ${uckLike.length} orders match the UCK000094 pattern (manual discount overriding PRODUCT_DISCOUNT promo):`);
    uckLike.slice(0, 10).forEach((a) => console.log(`  - ${a.orderNo}: ${a.details.promoName} | discount_amount=${a.details.orderDiscountAmount}`));
  }
}

main().catch((err) => {
  console.error("[audit-revenue-anomalies] FATAL:", err);
  process.exit(1);
});
