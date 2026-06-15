import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const DRY_RUN = process.argv.includes("--dry-run");

// ===== Types =====

interface PromotionSnapshot {
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE";
  discount_value: number | string;
  applicable_products_json?: string;
}

interface OrderRow {
  id: string;
  status: string;
  total_amount: string | number;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  applied_promotion_snapshot_json?: string;
  created_at: string;
}

// ===== Helpers =====

/**
 * Compute the correct per-line discount for a PRODUCT_DISCOUNT promotion.
 * Mirrors the runtime formula used in app/pos/page.tsx and recover-product-discount.ts.
 */
function computeProductDiscountLineDiscount(
  unitPrice: number,
  qty: number,
  promo: PromotionSnapshot,
  variantValue: number | string
): number {
  const val = Number(variantValue);
  if (promo.discount_type === "PERCENT") {
    return Math.round(unitPrice * qty * (val / 100));
  }
  if (promo.discount_type === "FLAT_PRICE") {
    return Math.max(0, unitPrice - val) * qty;
  }
  // Default: flat VND per unit
  return val * qty;
}

/**
 * Parse `applicable_products_json`. It can be:
 *   - An array of variant IDs (use promo.discount_value for all)
 *   - An object map { variantId: perVariantValueOrOverride }
 * Returns { variantIds: Set, valueByVariant: Map }.
 */
function parseApplicableProducts(
  rawJson: string | undefined
): { variantIds: Set<string>; valueByVariant: Map<string, number | string> } {
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
    // leave empty
  }
  return { variantIds, valueByVariant };
}

// ===== Main =====

async function main() {
  if (!SPREADSHEET_ID) {
    throw new Error("GOOGLE_SPREADSHEET_ID env var is required");
  }
  console.log(`[fix-subtotal-and-line-discounts] mode=${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

  // ===== Job B: recover PRODUCT_DISCOUNT line_discounts =====
  // For every COMPLETED order whose promotion snapshot is PRODUCT_DISCOUNT:
  //   - Lines on applicable variants: re-set line_discount from promo formula.
  //   - Lines on non-applicable variants: zero out (undo wrong prorating).
  console.log("[Job B] Fetching Orders, Order_Lines, and Promotions ...");

  const orders = await findAllNoCache("Orders");
  const promotions = await findAllNoCache("Promotions");
  const sheets = getSheetsClient();

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

  if ([idIdxL, orderIdIdxL, variantIdIdxL, unitPriceIdxL, qtyIdxL, lineDiscountIdxL].some((i) => i < 0)) {
    throw new Error("Order_Lines is missing one of required columns: id, order_id, variant_id, unit_price, qty, line_discount");
  }

  // Pre-process promotions to be accessible by ID
  const promoById = new Map<string, PromotionSnapshot>();
  promotions.forEach((p: any) => {
    promoById.set(p.id, {
      type: p.type as any,
      discount_type: p.discount_type as any,
      discount_value: p.discount_value,
      applicable_products_json: p.applicable_products_json
    });
  });

  const productDiscountOrders = orders.filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    
    let promo: PromotionSnapshot | undefined;
    if (o.applied_promotion_snapshot_json) {
      try {
        promo = JSON.parse(o.applied_promotion_snapshot_json) as PromotionSnapshot;
      } catch { }
    } else if (o.applied_promotion_id) {
      promo = promoById.get(o.applied_promotion_id);
    }
    
    return promo?.type === "PRODUCT_DISCOUNT";
  });

  console.log(`[Job B] ${productDiscountOrders.length} orders with PRODUCT_DISCOUNT promotion snapshot/id.`);

  const lineUpdates: { range: string; values: number[][] }[] = [];
  let applicableFixed = 0;
  let nonApplicableZeroed = 0;

  for (const order of productDiscountOrders) {
    let promo: PromotionSnapshot | undefined;
    if (order.applied_promotion_snapshot_json) {
      try {
        promo = JSON.parse(order.applied_promotion_snapshot_json) as PromotionSnapshot;
      } catch { continue; }
    } else if (order.applied_promotion_id) {
      promo = promoById.get(order.applied_promotion_id);
    }

    if (!promo) continue;

    const { variantIds, valueByVariant } = parseApplicableProducts(promo.applicable_products_json);
    if (variantIds.size === 0) continue; // nothing to do; can't tell which line was the promo target

    for (let i = 1; i < rowsLines.length; i++) {
      const row = rowsLines[i];
      if (!row || row[orderIdIdxL] !== order.id) continue;

      const variantId = row[variantIdIdxL];
      const qty = Number(row[qtyIdxL] || 1);
      const unitPrice = Number(row[unitPriceIdxL] || 0);
      const lineDiscountCol = String.fromCharCode(65 + lineDiscountIdxL);

      let newLineDiscount: number;
      if (variantIds.has(variantId)) {
        const val = valueByVariant.has(variantId) ? valueByVariant.get(variantId)! : promo.discount_value;
        newLineDiscount = computeProductDiscountLineDiscount(unitPrice, qty, promo, val);
        applicableFixed++;
      } else {
        newLineDiscount = 0;
        nonApplicableZeroed++;
      }

      lineUpdates.push({
        range: `Order_Lines!${lineDiscountCol}${i + 1}`,
        values: [[newLineDiscount]],
      });
    }
  }

  console.log(`[Job B] Prepared ${lineUpdates.length} line updates (applicable fixed: ${applicableFixed}, non-applicable zeroed: ${nonApplicableZeroed}).`);

  if (!DRY_RUN && lineUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: { valueInputOption: "USER_ENTERED", data: lineUpdates },
    });
    console.log("[Job B] Line updates written.");
  } else if (DRY_RUN) {
    console.log("[Job B] DRY-RUN: no writes performed.");
  }

  // ===== Job A: backfill missing `subtotal` column =====
  // For every COMPLETED order whose `subtotal` column is blank/zero:
  //   subtotal = total_amount + discount_amount + sum(line.line_discount)
  // (Job B has already corrected line_discounts above, so this formula reads the right values.)
  console.log("[Job A] Re-fetching Orders and Order_Lines for current state ...");

  const ordersAfterB = await findAllNoCache("Orders");
  const resLinesA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:Z`,
  });
  const rowsLinesA = resLinesA.data.values || [];
  const headersLA = rowsLinesA[0] as string[];
  const orderIdIdxLA = headersLA.indexOf("order_id");
  const lineDiscountIdxLA = headersLA.indexOf("line_discount");

  const resOrdersA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Z`,
  });
  const rowsOrdersA = resOrdersA.data.values || [];
  const headersOA = rowsOrdersA[0] as string[];
  const idIdxOA = headersOA.indexOf("id");
  const totalAmountIdxOA = headersOA.indexOf("total_amount");
  const discountAmountIdxOA = headersOA.indexOf("discount_amount");
  let subtotalIdxOA = headersOA.indexOf("subtotal");

  if (subtotalIdxOA < 0) {
    throw new Error("Orders sheet is missing the `subtotal` column. Add the column in Google Sheets before running this script.");
  }

  // Build a map: orderId -> sum(line.line_discount) using current Order_Lines state
  const lineDiscountSumByOrderId = new Map<string, number>();
  for (let i = 1; i < rowsLinesA.length; i++) {
    const row = rowsLinesA[i];
    if (!row) continue;
    const oid = row[orderIdIdxLA];
    const ld = Number(row[lineDiscountIdxLA] || 0);
    lineDiscountSumByOrderId.set(oid, (lineDiscountSumByOrderId.get(oid) || 0) + ld);
  }

  const orderUpdates: { range: string; values: number[][] }[] = [];
  let backfilled = 0;

  for (let i = 1; i < rowsOrdersA.length; i++) {
    const row = rowsOrdersA[i];
    if (!row) continue;
    if (row[idIdxOA] === undefined) continue;

    // Find the corresponding order object to check status
    const orderObj = ordersAfterB.find((o: OrderRow) => o.id === row[idIdxOA]);
    if (!orderObj || orderObj.status !== "COMPLETED") continue;

    const existingSubtotal = Number(row[subtotalIdxOA] || 0);
    if (existingSubtotal > 0) continue; // already populated, leave alone

    const totalAmount = Number(row[totalAmountIdxOA] || 0);
    const discountAmount = Number(row[discountAmountIdxOA] || 0);
    const lineDiscountSum = lineDiscountSumByOrderId.get(row[idIdxOA]) || 0;
    const newSubtotal = Math.round(totalAmount + discountAmount + lineDiscountSum);

    const subtotalCol = String.fromCharCode(65 + subtotalIdxOA);
    orderUpdates.push({
      range: `Orders!${subtotalCol}${i + 1}`,
      values: [[newSubtotal]],
    });
    backfilled++;
  }

  console.log(`[Job A] Prepared ${orderUpdates.length} order subtotal updates (backfilled: ${backfilled}).`);

  if (!DRY_RUN && orderUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: { valueInputOption: "USER_ENTERED", data: orderUpdates },
    });
    console.log("[Job A] Order subtotal updates written.");
  } else if (DRY_RUN) {
    console.log("[Job A] DRY-RUN: no writes performed.");
  }

  console.log("[fix-subtotal-and-line-discounts] done.");
}

main().catch((err) => {
  console.error("[fix-subtotal-and-line-discounts] FATAL:", err);
  process.exit(1);
});
