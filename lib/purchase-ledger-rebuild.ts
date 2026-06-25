type PurchaseOrderInput = {
  id: string;
  subtotal_amount?: string | number;
  shipping_fee?: string | number;
  tax_amount?: string | number;
  voucher_amount?: string | number;
  discount_amount?: string | number;
};

type PurchaseOrderLineInput = {
  id?: string;
  purchased_item_id?: string;
  item_id?: string;
  unit?: string;
  unit_id?: string;
  quantity?: string | number;
  subtotal?: string | number;
  conversion_id?: string;
};

type PurchasedItemInput = {
  id: string;
  base_ingredient_id?: string;
};

type ConversionInput = {
  id: string;
  purchased_item_id?: string;
  purchased_unit?: string;
  conversion_rate?: string | number;
};

export type PurchaseReceiptBuildResult = {
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  landed_cost_total: number;
  conversion_id: string;
  conversion_rate: number;
};

export function buildPurchaseReceipt(input: {
  po: PurchaseOrderInput;
  line: PurchaseOrderLineInput;
  item: PurchasedItemInput;
  conversions: ConversionInput[];
}): PurchaseReceiptBuildResult {
  const purchasedItemId = input.line.purchased_item_id || input.line.item_id || "";
  const isRaw = Boolean(input.item.base_ingredient_id);
  const conversion = isRaw
    ? resolveConversion(input.line, purchasedItemId, input.conversions)
    : null;
  const conversionRate = conversion ? Number(conversion.conversion_rate) || 0 : 1;
  const quantity = Number(input.line.quantity) || 0;
  const quantityChange = quantity * conversionRate;
  const landedCostTotal = calculateLineLandedCost(input.po, input.line);

  return {
    item_reference: input.item.base_ingredient_id || purchasedItemId,
    quantity_change: quantityChange,
    unit_cost: quantityChange > 0 ? landedCostTotal / quantityChange : 0,
    landed_cost_total: landedCostTotal,
    conversion_id: conversion?.id || "",
    conversion_rate: conversionRate,
  };
}

export function resolveConversion(
  line: PurchaseOrderLineInput,
  purchasedItemId: string,
  conversions: ConversionInput[],
): ConversionInput {
  const conversionId = String(line.conversion_id || "").trim();
  if (conversionId) {
    const conversion = conversions.find(candidate => candidate.id === conversionId);
    if (!conversion) {
      // Claude code — Phase 2.2: user-facing errors in tiếng Việt.
      throw new Error(`Không tìm thấy quy đổi ${conversionId} cho dòng ${line.id || ""}`);
    }
    if (conversion.purchased_item_id !== purchasedItemId) {
      throw new Error(
        `Quy đổi ${conversionId} không thuộc mặt hàng ${purchasedItemId} ở dòng ${line.id || ""}`,
      );
    }
    return conversion;
  }

  const unit = normalizeUnit(line.unit || line.unit_id || "");
  const candidates = conversions.filter(conversion =>
    conversion.purchased_item_id === purchasedItemId &&
    normalizeUnit(conversion.purchased_unit || "") === unit,
  );

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new Error(
      `Quy đổi mơ hồ cho dòng ${line.id || ""}: ${candidates.map(candidate => candidate.id).join(",")}`,
    );
  }
  throw new Error(`Thiếu quy đổi cho dòng ${line.id || ""}`);
}

function calculateLineLandedCost(po: PurchaseOrderInput, line: PurchaseOrderLineInput): number {
  const subtotalAmount = Number(po.subtotal_amount) || 0;
  const lineSubtotal = Number(line.subtotal) || 0;
  const totalExtraCosts =
    (Number(po.shipping_fee) || 0) +
    (Number(po.tax_amount) || 0) -
    (Number(po.voucher_amount) || 0) -
    (Number(po.discount_amount) || 0);
  const allocatedExtra = subtotalAmount > 0 ? totalExtraCosts * (lineSubtotal / subtotalAmount) : 0;
  return lineSubtotal + allocatedExtra;
}

function normalizeUnit(unit: string): string {
  return String(unit).trim().toLowerCase();
}
