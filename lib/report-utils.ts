export interface LineRevenueResult {
  variantRevenue: number;
  modRevenues: { id: string; name: string; revenue: number; raw: number }[];
  lineTotal: number;
}

export function computeLineRevenue(line: {
  qty: number;
  unit_price: number;
  line_discount: number;
  modifiers_json: string;
}): LineRevenueResult {
  const qty = Number(line.qty || 0);
  const price = Number(line.unit_price || 0);
  const lineDiscount = Number(line.line_discount || 0);

  const variantRaw = qty * price;
  let remainingDiscount = lineDiscount;

  let variantRevenue: number;
  if (remainingDiscount >= variantRaw) {
    variantRevenue = 0;
    remainingDiscount -= variantRaw;
  } else {
    variantRevenue = variantRaw - remainingDiscount;
    remainingDiscount = 0;
  }

  let mods: { id: string; name: string; price: number }[] = [];
  let modsRaw = 0;
  if (line.modifiers_json) {
    try {
      const parsed = JSON.parse(line.modifiers_json);
      if (Array.isArray(parsed)) {
        mods = parsed;
        mods.forEach((m: any) => { modsRaw += Number(m.price || 0) * qty; });
      }
    } catch {}
  }

  const modRevenues = mods.map((mod: any) => {
    const modRaw = Number(mod.price || 0) * qty;
    const modRatio = modsRaw > 0 ? modRaw / modsRaw : 0;
    const modDiscount = remainingDiscount * modRatio;
    const modRevenue = Math.max(0, modRaw - modDiscount);
    return {
      id: mod.id || mod.name || "",
      name: mod.name || "",
      revenue: modRevenue,
      raw: modRaw,
    };
  });

  const lineTotal = variantRevenue + modRevenues.reduce((s, m) => s + m.revenue, 0);
  return { variantRevenue, modRevenues, lineTotal };
}
