export interface LineRevenueResult {
  variantRevenue: number;
  modRevenues: { id: string; name: string; revenue: number; raw: number }[];
  lineTotal: number;
}

export interface ComputeLineRevenueInput {
  qty: number;
  unit_price: number;
  line_discount: number;
  modifiers_json: string;
  /**
   * Order-level discount ratio in [0, 1].
   * Computed by the caller as order.discount_amount / order.subtotal_amount.
   * Applied multiplicatively on top of the per-line revenue so an order-wide
   * discount reduces every line proportionally without corrupting line_discount.
   * Defaults to 0 when the caller does not supply it (e.g. legacy callers).
   */
  order_discount_ratio?: number;
}

export function computeLineRevenue(line: ComputeLineRevenueInput): LineRevenueResult {
  const qty = Number(line.qty || 0);
  const price = Number(line.unit_price || 0);
  const lineDiscount = Number(line.line_discount || 0);
  const orderDiscountRatio = Math.min(1, Math.max(0, Number(line.order_discount_ratio || 0)));

  const variantRaw = qty * price;
  let remainingDiscount = lineDiscount;

  // PRIORITY 1: Apply item-level discount to the base variant first
  let variantRevenue: number;
  if (remainingDiscount >= variantRaw) {
    variantRevenue = 0;
    remainingDiscount -= variantRaw;
  } else {
    variantRevenue = variantRaw - remainingDiscount;
    remainingDiscount = 0;
  }

  // PRIORITY 2: Apply remaining item-level discount to modifiers
  let mods: { id: string; name: string; price: number }[] = [];
  let modsRawTotal = 0;
  if (line.modifiers_json) {
    try {
      const parsed = JSON.parse(line.modifiers_json);
      if (Array.isArray(parsed)) {
        mods = parsed;
        mods.forEach((m: any) => { modsRawTotal += Number(m.price || 0) * qty; });
      }
    } catch {}
  }

  const modRevenues = mods.map((mod: any) => {
    const modRaw = Number(mod.price || 0) * qty;
    const modRatio = modsRawTotal > 0 ? modRaw / modsRawTotal : 0;
    const itemLevelModDiscount = remainingDiscount * modRatio;
    const modRevenueAfterLineDiscount = Math.max(0, modRaw - itemLevelModDiscount);
    // Apply order-level discount multiplicatively on top of the line-level result
    const modRevenue = modRevenueAfterLineDiscount * (1 - orderDiscountRatio);

    return {
      id: mod.id || mod.name || "",
      name: mod.name || "",
      revenue: modRevenue,
      raw: modRaw,
    };
  });

  // Apply order-level discount multiplicatively on top of variant revenue
  variantRevenue = variantRevenue * (1 - orderDiscountRatio);

  const lineTotal = variantRevenue + modRevenues.reduce((s, m) => s + m.revenue, 0);
  return { variantRevenue, modRevenues, lineTotal };
}
