/**
 * Phase E.2: Re-audit Orders against Promo Windows
 */

import * as fs from "fs";
import * as path from "path";
import { findAllNoCache } from "../lib/sheets_db";

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
  console.log("Fetching DB...");
  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");
  const promos = await findAllNoCache("Promotions");

  const productDiscountPromos = promos.filter((p: any) => p.type === "PRODUCT_DISCOUNT");

  const linesByOrder = new Map<string, any[]>();
  for (const l of lines) {
    if (!linesByOrder.has(l.order_id)) linesByOrder.set(l.order_id, []);
    linesByOrder.get(l.order_id)!.push(l);
  }

  const results: any = {
    PROMO_APPLIED_CORRECT: [],
    PROMO_MISSING_ID: [],
    PROMO_ID_INVALID: [],
    NO_PROMO: []
  };

  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;

    const myLines = linesByOrder.get(order.id) || [];
    const createdAt = new Date(order.created_at);

    // Find ALL active product discount promos at order time
    const activePromosAtTime = productDiscountPromos.filter((p: any) => {
      const start = new Date(p.start_date);
      const end = p.end_date ? new Date(p.end_date) : new Date("2099-12-31T23:59:59Z");
      return start <= createdAt && createdAt <= end;
    });

    // Check if any of these active promos apply to any line in the cart
    let actuallyMatchedPromo: any = null;
    for (const p of activePromosAtTime) {
      const { variantIds } = parseApplicableProducts(p.applicable_products_json);
      if (myLines.some((l: any) => variantIds.has(l.variant_id))) {
        actuallyMatchedPromo = p;
        break; // Use first match
      }
    }

    const currentStoredId = order.applied_promotion_id || "";

    if (actuallyMatchedPromo) {
      if (currentStoredId === actuallyMatchedPromo.id) {
        results.PROMO_APPLIED_CORRECT.push({ order, promo: actuallyMatchedPromo });
      } else if (currentStoredId === "") {
        // We found a promo that should have applied, but ID is missing
        const { variantIds, valueByVariant } = parseApplicableProducts(actuallyMatchedPromo.applicable_products_json);
        const calcLines = myLines.filter((l: any) => variantIds.has(l.variant_id)).map((l: any) => {
          const val = valueByVariant.has(l.variant_id) ? Number(valueByVariant.get(l.variant_id)) : Number(actuallyMatchedPromo.discount_value);
          const expected = computeExpectedLineDiscount(Number(l.unit_price || 0), Number(l.qty || 1), actuallyMatchedPromo.discount_type, val);
          return {
            id: l.id,
            variant_id: l.variant_id,
            current_line_discount: Number(l.line_discount || 0),
            current_line_manual_discount: Number(l.line_manual_discount || 0),
            expected_promo_discount: expected
          };
        });

        results.PROMO_MISSING_ID.push({ 
          order, 
          promo: actuallyMatchedPromo,
          lines: calcLines
        });
      } else {
        // ID is stored, but it doesn't match the one we derived (should be rare)
        results.PROMO_ID_INVALID.push({ order, reason: "ID mismatch", expected: actuallyMatchedPromo.id, actual: currentStoredId });
      }
    } else {
      // No promo should apply according to window/variants
      if (currentStoredId !== "") {
        // But an ID is stored! Ghost promo.
        results.PROMO_ID_INVALID.push({ order, reason: "Ghost promo (out of window or no variant match)", actual: currentStoredId });
      } else {
        results.NO_PROMO.push({ order });
      }
    }
  }

  let md = "# Re-audit Promo Windows Report\n\n";
  
  md += "## Summary Counts\n";
  md += `- **PROMO_APPLIED_CORRECT**: ${results.PROMO_APPLIED_CORRECT.length}\n`;
  md += `- **PROMO_MISSING_ID**: ${results.PROMO_MISSING_ID.length}\n`;
  md += `- **PROMO_ID_INVALID**: ${results.PROMO_ID_INVALID.length}\n`;
  md += `- **NO_PROMO**: ${results.NO_PROMO.length}\n\n`;

  md += "## PROMO_MISSING_ID (Need Backfill)\n\n";
  if (results.PROMO_MISSING_ID.length === 0) md += "None.\n";
  results.PROMO_MISSING_ID.forEach((item: any) => {
    md += `### ${item.order.order_no} (${item.order.created_at})\n`;
    md += `- **Matched Promo**: ${item.promo.name} (${item.promo.id})\n`;
    item.lines.forEach((l: any) => {
      md += `  - Line ${l.variant_id}: expected promo: ${l.expected_promo_discount}, current line_discount: ${l.current_line_discount}, current line_manual: ${l.current_line_manual_discount}\n`;
    });
  });

  md += "\n## PROMO_ID_INVALID (Need Clearing)\n\n";
  if (results.PROMO_ID_INVALID.length === 0) md += "None.\n";
  results.PROMO_ID_INVALID.forEach((item: any) => {
    md += `- **${item.order.order_no}** (${item.order.created_at}): ${item.reason} (Stored: ${item.actual})\n`;
  });

  const outPath = path.resolve(process.cwd(), "scripts", "output", "reaudit-report.md");
  fs.writeFileSync(outPath, md);
  console.log(`Report written to ${outPath}`);
  console.log(md);
}

main().catch(console.error);
