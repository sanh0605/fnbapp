/**
 * Pure selection for scripts/erase-never-sold-deleted.ts: DELETED dishes,
 * categories and options that were never sold and that nothing else points at. A referenced row is kept, not erased.
 * A dish is erased with its sizes and price history (the existing
 * erase_never_sold_product_atomic rpc does that).
 */
export interface Input {
  products: { id: string; name: string; status: string; category_id: string | null }[];
  variants: { id: string; product_id: string; status: string }[];
  categories: { id: string; name: string; status: string }[];
  modifiers: { id: string; name: string; status: string }[];
  soldProductIds: string[];
  soldVariantIds: string[];
  soldModifierIds: string[];
  /** Every other place that may hold an id: an exact id column value or a JSON text. */
  refs: { where: string; value: string }[];
}

export interface Target { id: string; name: string }
export interface Dish extends Target { variantIds: string[] }
export interface Skipped extends Target { kind: string; reason: string }

export function selectErasures(input: Input) {
  const sold = {
    product: new Set(input.soldProductIds),
    variant: new Set(input.soldVariantIds),
    modifier: new Set(input.soldModifierIds),
  };
  const dishes: Dish[] = [];
  const categories: Target[] = [];
  const modifiers: Target[] = [];
  const skipped: Skipped[] = [];

  // Word-boundary match: PROD-0071 must not count as PROD-007.
  const esc = (i: string) => i.replace(/\W/g, "\\$&");
  const holders = (ids: string[]) => {
    const re = new RegExp(ids.map(i => "(?<![\\w-])" + esc(i) + "(?![\\w-])").join("|"));
    return [...new Set(input.refs.filter(r => re.test(r.value)).map(r => r.where))];
  };
  // Returns true when the target may go; otherwise it is kept and the reason recorded.
  const decide = (kind: string, t: Target, wasSold: boolean, ids: string[]) => {
    if (wasSold) { skipped.push({ kind, ...t, reason: "đã có đơn" }); return false; }
    const where = holders(ids);
    where.forEach(w => skipped.push({ kind, ...t, reason: `còn được nhắc ở ${w}` }));
    return where.length === 0;
  };

  for (const p of input.products.filter(p => p.status === "DELETED")) {
    const variantIds = input.variants.filter(v => v.product_id === p.id).map(v => v.id);
    const wasSold = sold.product.has(p.id) || variantIds.some(v => sold.variant.has(v));
    if (decide("món", { id: p.id, name: p.name }, wasSold, [p.id, ...variantIds])) {
      dishes.push({ id: p.id, name: p.name, variantIds });
    }
  }

  const productStatus = new Map(input.products.map(p => [p.id, p]));
  for (const v of input.variants.filter(v => v.status === "DELETED")) {
    if (productStatus.get(v.product_id)?.status !== "DELETED") {
      skipped.push({ kind: "size", id: v.id, name: v.id, reason: "size lẻ của món còn dùng, chưa xử lý" });
    }
  }

  const gone = new Set(dishes.map(d => d.id));
  for (const c of input.categories.filter(c => c.status === "DELETED")) {
    const t = { id: c.id, name: c.name };
    if (input.products.some(p => p.category_id === c.id && !gone.has(p.id))) {
      skipped.push({ kind: "nhóm", ...t, reason: "còn món" });
    } else if (decide("nhóm", t, false, [c.id])) {
      categories.push(t);
    }
  }

  for (const m of input.modifiers.filter(m => m.status === "DELETED")) {
    const t = { id: m.id, name: m.name };
    if (decide("tuỳ chọn", t, sold.modifier.has(m.id), [m.id])) modifiers.push(t);
  }

  return { dishes, categories, modifiers, skipped };
}
