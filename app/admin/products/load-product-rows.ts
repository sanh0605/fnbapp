import { findAll, findAllWhere, findAllWhereInBatches, findSoldModifierIds } from "@/lib/db/tables";

interface PriceHistory {
  variant_id: string;
  created_at: string;
  [key: string]: any;
}

// The list reads only what its rows show. Price history and "never sold" are
// built for one dish at a time by loadProductRow, for the detail page.
export async function loadProductRows() {
  const [categories, products, variants, modifiers] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Modifiers"),
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  // Owner decision 2026-08-29: no third state, no archive -- the status
  // filter itself (ProductsClient.tsx) is the only route to a DELETED
  // product now that "Tất cả" is gone, so DELETED products must reach the
  // client instead of being filtered out here.
  const activeVariants = variants.filter(v => v.status !== "DELETED");

  // Task 2: a product linked to an ACTIVE modifier has its price set on
  // the Topping & Tuỳ chọn screen (migration 0098 sync) -- this form
  // must not let it be edited a second place here.
  const linkedToppingProductIds = new Set<string>(
    modifiers.filter(m => m.status === "ACTIVE" && m.product_id).map(m => m.product_id as string),
  );

  const enhancedProducts = products.map(p => {
    const productVariants = activeVariants.filter(v => v.product_id === p.id);
    // OPEN-ITEMS 73/74: a product that says "Đang bán" or "Ngừng bán" but
    // has no ACTIVE size at all is a silent trap -- the list claims it is
    // sellable (or pausably sellable), POS never shows it, and nothing on
    // the row explains the gap. Scoped to ACTIVE/INACTIVE only; a DELETED
    // product already shows its own "Đã xoá" badge and needs no second
    // warning.
    const hasNoSellableVariant = p.status !== "DELETED" && !productVariants.some(v => v.status === "ACTIVE");

    return {
      ...p,
      variants: productVariants,
      hasNoSellableVariant,
      isLinkedTopping: linkedToppingProductIds.has(p.id),
    };
  });

  return { enhancedProducts, activeCategories };
}

/**
 * The list row of loadProductRows() plus price history, neverSold and hasModifierLink,
 * reading only this product's own rows (F12). Returns null when the product does not exist.
 * Order lines are probed with two limit-1 queries instead of every line id.
 */
export async function loadProductRow(id: string) {
  const [product] = await findAllWhere<any>("Products", { eq: { id }, limit: 1 });
  if (!product) return null;

  const [variants, modifiers] = await Promise.all([
    findAllWhere<any>("Product_Variants", { eq: { product_id: id } }),
    findAllWhere<any>("Modifiers", { eq: { product_id: id } }),
  ]);
  const productVariants = variants.filter(v => v.status !== "DELETED");
  const variantIds = productVariants.map(v => v.id as string);

  const [priceHistory, soldByProduct, soldByVariant, soldIds] = await Promise.all([
    findAllWhereInBatches<any>("Product_Price_History", "variant_id", variantIds),
    findAllWhere("Order_Lines_V2", { eq: { product_id: id }, limit: 1 }),
    variantIds.length
      ? findAllWhere("Order_Lines_V2", { in: { variant_id: variantIds }, limit: 1 })
      : Promise.resolve([]),
    // Only a dish linked to a topping can be sold as an add-on (BR-CATALOG-003).
    modifiers.length ? findSoldModifierIds() : Promise.resolve(null),
  ]);
  let sold = soldByProduct.length > 0 || soldByVariant.length > 0;
  if (soldIds) {
    sold = sold || modifiers.some(m => soldIds.includes(m.id));
  }

  return {
    ...product,
    variants: productVariants,
    priceHistory: [...priceHistory].sort(
      (a: PriceHistory, b: PriceHistory) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    neverSold: !sold,
    hasNoSellableVariant: product.status !== "DELETED" && !productVariants.some(v => v.status === "ACTIVE"),
    isLinkedTopping: modifiers.some(m => m.status === "ACTIVE"),
    hasModifierLink: modifiers.length > 0,
  };
}
