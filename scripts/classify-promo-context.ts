/**
 * Phase 2: Promo Inference Classifier
 * Read-only script to classify historical orders into confidence tiers.
 */

import { findAllNoCache } from "../lib/sheets_db";
import * as fs from "fs";
import * as path from "path";

// ==== Imports (Copied from fix script as instructed) ====

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

// ==== Types ====

type Tier = "CONFIRMED" | "INFERRED_HIGH" | "INFERRED_MEDIUM" | "INFERRED_LOW" | "AMBIGUOUS" | "NO_PROMO";

interface Classification {
  orderId: string;
  orderNo: string;
  createdAt: string;
  tier: Tier;
  matchedPromoId?: string;
  matchedPromoName?: string;
  evidence: {
    rule: string;
    snapshotPresent: boolean;
    appliedPromotionIdPresent: boolean;
    appliedPromotionIdValue: string;
    activePromoCount: number;
    relevantPromoCount: number;
    candidatePromoIds: string[];
    applicableLinesSummary: {
      variantId: string;
      expected: number;
      actual: number;
      diff: number;
    }[];
    orderDiscountAmount: number;
  };
  lines: Array<{
    variantId: string;
    isApplicable: boolean;
    qty: number;
    unitPrice: number;
    lineDiscount: number;
  }>;
}

// ==== Algorithm ====

async function main() {
  const ordersRaw = await findAllNoCache("Orders") as any[];
  const linesRaw = await findAllNoCache("Order_Lines") as any[];
  const promosRaw = await findAllNoCache("Promotions") as any[];

  const orders = ordersRaw.filter((o) => o.status === "COMPLETED");
  
  const productDiscountPromos = promosRaw.filter((p) => p.type === "PRODUCT_DISCOUNT" && p.status === "ACTIVE");
  
  const linesByOrderId = new Map<string, any[]>();
  for (const l of linesRaw) {
    if (!linesByOrderId.has(l.order_id)) {
      linesByOrderId.set(l.order_id, []);
    }
    linesByOrderId.get(l.order_id)!.push(l);
  }

  const promoById = new Map<string, any>();
  for (const p of promosRaw) {
    promoById.set(p.id, p);
  }

  const classifications: Classification[] = [];

  for (const order of orders) {
    const myLines = linesByOrderId.get(order.id) || [];
    
    // Step A
    const orderCreatedAt = new Date(order.created_at);
    const activePromos = productDiscountPromos.filter(p => {
      const start = new Date(p.start_date);
      // If end_date is missing, it's indefinitely active, but let's safely handle it.
      // The requirement says "whose [start_date, end_date] window contains O.created_at"
      const end = p.end_date ? new Date(p.end_date) : new Date("2099-12-31T23:59:59Z");
      return start <= orderCreatedAt && orderCreatedAt <= end;
    });

    // Step B
    const relevantPromos = activePromos.filter(p => {
      const { variantIds } = parseApplicableProducts(p.applicable_products_json);
      return myLines.some(l => variantIds.has(l.variant_id));
    });

    // Default evidence
    const evidence: Classification["evidence"] = {
      rule: "Default AMBIGUOUS",
      snapshotPresent: false,
      appliedPromotionIdPresent: !!order.applied_promotion_id,
      appliedPromotionIdValue: order.applied_promotion_id || "",
      activePromoCount: activePromos.length,
      relevantPromoCount: relevantPromos.length,
      candidatePromoIds: relevantPromos.map(p => p.id),
      applicableLinesSummary: [],
      orderDiscountAmount: Number(order.discount_amount || 0)
    };

    let tier: Tier = "AMBIGUOUS";
    let matchedPromo: any = undefined;

    // Classification Logic
    if (relevantPromos.length === 0) {
      tier = "NO_PROMO";
      evidence.rule = "relevantPromos.length === 0";
    } else if (relevantPromos.length === 1) {
      const P = relevantPromos[0];
      if (order.applied_promotion_id === P.id) {
        tier = "CONFIRMED";
        matchedPromo = P;
        evidence.rule = "relevantPromos.length === 1 AND order.applied_promotion_id === P.id";
      } else {
        const { variantIds, valueByVariant } = parseApplicableProducts(P.applicable_products_json);
        const applicableLines = myLines.filter(l => variantIds.has(l.variant_id));

        if (applicableLines.length === 0) {
          tier = "AMBIGUOUS";
          evidence.rule = "relevantPromos.length === 1 BUT applicableLines.length === 0";
        } else {
          const matchInfo = applicableLines.map(l => {
            const customVal = valueByVariant.get(l.variant_id);
            const effValue = customVal !== undefined ? Number(customVal) : Number(P.discount_value);
            const expected = computeExpectedLineDiscount(Number(l.unit_price || 0), Number(l.qty || 1), P.discount_type, effValue);
            const actual = Number(l.line_discount || 0);
            return { line: l, expected, actual, diff: Math.abs(actual - expected) };
          });

          evidence.applicableLinesSummary = matchInfo.map(m => ({
            variantId: m.line.variant_id,
            expected: m.expected,
            actual: m.actual,
            diff: m.diff
          }));

          const allMatchExpected = matchInfo.every(m => m.diff <= 2);
          const allZero = matchInfo.every(m => m.actual === 0);

          if (allMatchExpected) {
            tier = "INFERRED_HIGH";
            matchedPromo = P;
            evidence.rule = "relevantPromos.length === 1 AND all applicable lines match expected line_discount";
          } else if (allZero && Number(order.discount_amount || 0) === 0) {
            tier = "INFERRED_MEDIUM";
            matchedPromo = P;
            evidence.rule = "relevantPromos.length === 1 AND all applicable line_discounts are 0 AND order discount is 0";
          } else if (allZero && Number(order.discount_amount || 0) > 0) {
            tier = "INFERRED_LOW";
            matchedPromo = P;
            evidence.rule = "relevantPromos.length === 1 AND all applicable line_discounts are 0 AND order discount > 0 (UCK000094 pattern)";
          } else {
            tier = "AMBIGUOUS";
            evidence.rule = "relevantPromos.length === 1 BUT line evidence does not fit any inferred tier";
          }
        }
      }
    } else {
      // relevantPromos.length >= 2
      if (order.applied_promotion_id && relevantPromos.some(p => p.id === order.applied_promotion_id)) {
        const P = relevantPromos.find(p => p.id === order.applied_promotion_id);
        tier = "CONFIRMED";
        matchedPromo = P;
        evidence.rule = "relevantPromos.length >= 2 AND order.applied_promotion_id matches one of them";
      } else {
        tier = "AMBIGUOUS";
        evidence.rule = "relevantPromos.length >= 2 AND order.applied_promotion_id does not uniquely identify one";
      }
    }

    // Build the final lines array for output
    const mappedLines = myLines.map(l => {
      let isApplicable = false;
      if (matchedPromo) {
        const { variantIds } = parseApplicableProducts(matchedPromo.applicable_products_json);
        isApplicable = variantIds.has(l.variant_id);
      }
      return {
        variantId: l.variant_id,
        isApplicable,
        qty: Number(l.qty || 1),
        unitPrice: Number(l.unit_price || 0),
        lineDiscount: Number(l.line_discount || 0)
      };
    });

    classifications.push({
      orderId: order.id,
      orderNo: order.order_no || order.id,
      createdAt: order.created_at,
      tier,
      matchedPromoId: matchedPromo?.id,
      matchedPromoName: matchedPromo?.name,
      evidence,
      lines: mappedLines
    });
  }

  // ==== Generate Summaries ====
  const countsByTier: Record<string, number> = {
    CONFIRMED: 0,
    INFERRED_HIGH: 0,
    INFERRED_MEDIUM: 0,
    INFERRED_LOW: 0,
    AMBIGUOUS: 0,
    NO_PROMO: 0
  };

  const samplesByTier: Record<string, string[]> = {
    CONFIRMED: [],
    INFERRED_HIGH: [],
    INFERRED_MEDIUM: [],
    INFERRED_LOW: [],
    AMBIGUOUS: [],
    NO_PROMO: []
  };

  const sanityChecks = {
    appliedPromotionIdSetButTierNotConfirmed: 0,
    confirmedButLineDiscountMismatch: 0,
    ambiguousWithMultipleActivePromos: 0,
    inferredLowCount: 0
  };

  for (const c of classifications) {
    countsByTier[c.tier]++;
    if (samplesByTier[c.tier].length < 3) {
      samplesByTier[c.tier].push(c.orderNo);
    }

    if (c.evidence.appliedPromotionIdPresent && c.tier !== "CONFIRMED") {
      sanityChecks.appliedPromotionIdSetButTierNotConfirmed++;
    }

    if (c.tier === "CONFIRMED" && c.evidence.applicableLinesSummary.some(m => m.diff > 2)) {
      sanityChecks.confirmedButLineDiscountMismatch++;
    }

    if (c.tier === "AMBIGUOUS" && c.evidence.relevantPromoCount >= 2) {
      sanityChecks.ambiguousWithMultipleActivePromos++;
    }
  }

  sanityChecks.inferredLowCount = countsByTier["INFERRED_LOW"];

  // ==== Write Files ====
  const outputDir = path.join(process.cwd(), "scripts", "output");
  
  const fullJson = {
    generatedAt: new Date().toISOString(),
    totalOrdersProcessed: orders.length,
    orders: classifications
  };
  fs.writeFileSync(path.join(outputDir, "classification.json"), JSON.stringify(fullJson, null, 2));

  const summaryJson = {
    generatedAt: new Date().toISOString(),
    totalOrdersProcessed: orders.length,
    countsByTier,
    samplesByTier,
    sanityChecks
  };
  fs.writeFileSync(path.join(outputDir, "classification-summary.json"), JSON.stringify(summaryJson, null, 2));

  // ==== Console Output ====
  console.log("");
  console.log("CLASSIFICATION COMPLETE");
  console.log("=======================");
  console.log(`Total COMPLETED orders processed: ${orders.length}`);
  console.log("Counts by tier:");
  console.log(`  CONFIRMED:       ${countsByTier["CONFIRMED"]}`);
  console.log(`  INFERRED_HIGH:   ${countsByTier["INFERRED_HIGH"]}`);
  console.log(`  INFERRED_MEDIUM: ${countsByTier["INFERRED_MEDIUM"]}`);
  console.log(`  INFERRED_LOW:    ${countsByTier["INFERRED_LOW"]}    <- requires User sign-off before any fix`);
  console.log(`  AMBIGUOUS:       ${countsByTier["AMBIGUOUS"]}`);
  console.log(`  NO_PROMO:        ${countsByTier["NO_PROMO"]}`);
  console.log("Sanity checks:");
  console.log(`  applied_promotion_id set but tier != CONFIRMED: ${sanityChecks.appliedPromotionIdSetButTierNotConfirmed}  (investigate if > 0)`);
  console.log(`  CONFIRMED with line_discount mismatch: ${sanityChecks.confirmedButLineDiscountMismatch}           (already fixed?)`);
  console.log(`  AMBIGUOUS with multiple active promos: ${sanityChecks.ambiguousWithMultipleActivePromos}`);
  console.log("Output files:");
  console.log("  scripts/output/classification.json");
  console.log("  scripts/output/classification-summary.json");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
