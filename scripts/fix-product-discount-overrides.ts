/**
 * Fix Historical PRODUCT_DISCOUNT Overrides
 *
 * For every COMPLETED order whose applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT",
 * this script enforces the promo price invariant:
 *   - Applicable variants: line_discount reset to promo formula value
 *   - Non-applicable variants (per Question 2 heuristic): line_discount zeroed
 *   - Order.discount_amount (per Question 1 strategy A): redistributed onto
 *     non-applicable variants' line_discount, then zeroed out
 *
 * Usage:
 *   npx tsx scripts/fix-product-discount-overrides.ts --dry-run    # preview counts only
 *   npx tsx scripts/fix-product-discount-overrides.ts              # live run
 */

import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";
import * as fs from "fs";
import * as path from "path";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const DRY_RUN = process.argv.includes("--dry-run");

// ===== Types =====

interface PromotionSnapshot {
  id?: string;
  name?: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE";
  discount_value: number | string;
  applicable_products_json?: string;
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
  } catch (e) {
  }
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
  return discountValue * qty; // flat VND per unit
}

// ===== Main =====

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID env var is required");
  console.log(`[fix-product-discount-overrides] mode=${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

  const orders = (await findAllNoCache("Orders")) as any[];
  const promotions = (await findAllNoCache("Promotions")) as any[];
  const sheets = getSheetsClient();

  const promoById = new Map<string, PromotionSnapshot>();
  promotions.forEach((p: any) => {
    promoById.set(p.id, {
      id: p.id,
      name: p.name,
      type: p.type as any,
      discount_type: p.discount_type as any,
      discount_value: p.discount_value,
      applicable_products_json: p.applicable_products_json
    });
  });

  // Step 5: Read Order_Lines sheet directly
  const resLines = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:Z`,
  });
  const rowsLines = resLines.data.values || [];
  const headersL = rowsLines[0] as string[];
  const idIdxL = headersL.indexOf("id");
  const orderIdIdxL = headersL.indexOf("order_id");
  const variantIdIdxL = headersL.indexOf("variant_id");
  const unitPriceIdxL = headersL.indexOf("unit_price");
  const qtyIdxL = headersL.indexOf("qty");
  const lineDiscountIdxL = headersL.indexOf("line_discount");
  const modifiersJsonIdxL = headersL.indexOf("modifiers_json");

  const resOrders = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Z`,
  });
  const rowsOrders = resOrders.data.values || [];
  const headersO = rowsOrders[0] as string[];
  const idIdxO = headersO.indexOf("id");
  const discountAmountIdxO = headersO.indexOf("discount_amount");

  // Step 6: Iterate orders, classify each line
  const lineUpdates: { range: string; values: number[][] }[] = [];
  const orderUpdates: { range: string; values: number[][] }[] = [];
  const report: any = {
    generatedAt: new Date().toISOString(),
    mode: DRY_RUN ? "DRY-RUN" : "LIVE",
    summary: {
      ordersProcessed: 0,
      applicableLineDiscountResynced: 0,
      nonApplicableLineDiscountZeroed: 0,
      orderDiscountRedistributed: 0,
      orderDiscountZeroedWithoutRedistribution: 0
    },
    perOrder: []
  };

  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;

    let promo: PromotionSnapshot | undefined;
    if (order.applied_promotion_snapshot_json) {
      try {
        promo = JSON.parse(order.applied_promotion_snapshot_json) as PromotionSnapshot;
      } catch { }
    }

    if (promo?.type !== "PRODUCT_DISCOUNT") continue;

    const { variantIds, valueByVariant } = parseApplicableProducts(promo.applicable_products_json);
    if (variantIds.size === 0) continue;

    const orderLinesData: any[] = [];
    let hasApplicableDiscounted = false;

    // Collect all lines for this order
    for (let i = 1; i < rowsLines.length; i++) {
      const row = rowsLines[i];
      if (!row || row[orderIdIdxL] !== order.id) continue;
      
      const variantId = row[variantIdIdxL];
      const unitPrice = Number(row[unitPriceIdxL] || 0);
      const qty = Number(row[qtyIdxL] || 1);
      const lineDiscount = Number(row[lineDiscountIdxL] || 0);
      const isApplicable = variantIds.has(variantId);
      
      let modsPrice = 0;
      if (modifiersJsonIdxL >= 0 && row[modifiersJsonIdxL]) {
        try {
          const parsed = JSON.parse(row[modifiersJsonIdxL]);
          if (Array.isArray(parsed)) {
            modsPrice = parsed.reduce((sum: number, mod: any) => sum + Number(mod.price || 0), 0);
          }
        } catch {}
      }

      orderLinesData.push({
        rowIndex: i + 1,
        variantId,
        unitPrice,
        qty,
        lineDiscount,
        isApplicable,
        modsPrice
      });

      if (isApplicable) {
        hasApplicableDiscounted = true;
      }
    }

    if (orderLinesData.length === 0) continue;

    report.summary.ordersProcessed++;
    const orderReport = {
      orderId: order.id,
      orderNo: order.order_no,
      before: {
        discount_amount: order.discount_amount,
        lines: orderLinesData.map(l => ({ variant: l.variantId, lineDiscount: l.lineDiscount }))
      },
      after: {
        discount_amount: 0,
        lines: [] as any[]
      }
    };

    let nonApplicableSubtotal = 0;
    
    // First pass: fix applicable variants, zero out non-applicable if heuristic met
    orderLinesData.forEach(l => {
      let newLineDiscount = l.lineDiscount;

      if (l.isApplicable) {
        const val = valueByVariant.has(l.variantId) ? Number(valueByVariant.get(l.variantId)) : Number(promo!.discount_value);
        const expected = computeExpectedLineDiscount(l.unitPrice, l.qty, promo!.discount_type, val);
        
        newLineDiscount = Math.round(expected);
        report.summary.applicableLineDiscountResynced++;
      } else {
        nonApplicableSubtotal += (l.unitPrice + l.modsPrice) * l.qty;
        
        if (hasApplicableDiscounted && l.lineDiscount > 0) {
          newLineDiscount = 0;
          report.summary.nonApplicableLineDiscountZeroed++;
        }
      }
      
      l.lineDiscount = newLineDiscount; // update for step 8
    });

    // Step 8: Redistribute order discount (Option A)
    const orderDiscountAmount = Number(order.discount_amount || 0);
    
    if (orderDiscountAmount > 0) {
      if (nonApplicableSubtotal > 0) {
        orderLinesData.forEach(l => {
          if (!l.isApplicable) {
            const lineBaseTotal = (l.unitPrice + l.modsPrice) * l.qty;
            const share = orderDiscountAmount * (lineBaseTotal / nonApplicableSubtotal);
            l.lineDiscount = Math.min(lineBaseTotal, Math.round(l.lineDiscount + share));
          }
        });
        report.summary.orderDiscountRedistributed++;
      } else {
        report.summary.orderDiscountZeroedWithoutRedistribution++;
      }
    }

    // Prepare updates
    const ids = rowsOrders.map(r => r[idIdxO]);
    const orderRowIdx = ids.indexOf(order.id);
    if (orderRowIdx >= 0 && discountAmountIdxO >= 0 && orderDiscountAmount > 0) {
      const col = String.fromCharCode(65 + discountAmountIdxO);
      if (!DRY_RUN) {
        orderUpdates.push({
          range: `Orders!${col}${orderRowIdx + 1}`,
          values: [[0]]
        });
      }
    }

    // Apply line updates
    orderLinesData.forEach(l => {
      const lineDiscountCol = String.fromCharCode(65 + lineDiscountIdxL);
      if (!DRY_RUN) {
        lineUpdates.push({
          range: `Order_Lines!${lineDiscountCol}${l.rowIndex}`,
          values: [[l.lineDiscount]]
        });
      }
      orderReport.after.lines.push({ variant: l.variantId, lineDiscount: l.lineDiscount });
    });

    report.perOrder.push(orderReport);
  }

  // Step 7 & 9: Apply batches
  if (!DRY_RUN && lineUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: { valueInputOption: "USER_ENTERED", data: lineUpdates },
    });
    console.log(`[fix-product-discount-overrides] ${lineUpdates.length} line updates written.`);
  }

  if (!DRY_RUN && orderUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: { valueInputOption: "USER_ENTERED", data: orderUpdates },
    });
    console.log(`[fix-product-discount-overrides] ${orderUpdates.length} order updates written.`);
  }

  // Step 10: Write report
  const reportPath = path.resolve(process.cwd(), "fix-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[fix-product-discount-overrides] Report written to ${reportPath}`);
  console.log(report.summary);
}

main().catch((err) => {
  console.error("[fix-product-discount-overrides] FATAL:", err);
  process.exit(1);
});
