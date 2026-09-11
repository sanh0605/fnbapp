import { findAll, findOrderLineProductAndVariantIds } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

interface PriceHistory {
  variant_id: string;
  created_at: string;
  [key: string]: any;
}

export default async function ProductsPage() {
  const [categories, products, variants, allPriceHistory, modifiers, orderLineIds, auth]: [any[], any[], any[], PriceHistory[], any[], { productIds: string[]; variantIds: string[]; modifierIds: string[] }, Awaited<ReturnType<typeof resolveActor>>] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Product_Price_History"),
    findAll("Modifiers"),
    findOrderLineProductAndVariantIds(),
    resolveActor(),
  ]);
  // BR-ACCESS-003 -- permanent deletion (eraseProduct) is ADMIN only.
  // Hiding the button is courtesy; requireOwner() in eraseProduct is what
  // actually blocks it. Same pattern as commit e41968d's other screens.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  // Owner decision 2026-08-29: no third state, no archive -- the status
  // filter itself (ProductsClient.tsx) is the only route to a DELETED
  // product now that "Tất cả" is gone, so DELETED products must reach the
  // client instead of being filtered out here. 5 products carry that
  // status today.
  const visibleProducts = products;
  const activeVariants = variants.filter(v => v.status !== "DELETED");

  // section 5.2: "Xoá vĩnh viễn" is offered only when it is possible --
  // computed the same way Postgres's own RESTRICT foreign keys decide it
  // (any order_lines_v2 row referencing the product or one of its variants,
  // regardless of that order's own status), not re-derived differently.
  // BR-CATALOG-003: a topping sold as an add-on is invisible to
  // order_lines_v2.product_id/variant_id -- it lives only in the parent
  // line's modifiers_snapshot_json -- so a third loop resolves each sold
  // modifier to the CAT-007 product it is linked to (migration 0097).
  const soldProductIds = new Set<string>();
  for (const productId of orderLineIds.productIds) {
    soldProductIds.add(productId);
  }
  const variantProductId = new Map<string, string>(activeVariants.map(v => [v.id, v.product_id]));
  for (const variantId of orderLineIds.variantIds) {
    const pid = variantProductId.get(variantId);
    if (pid) soldProductIds.add(pid);
  }
  const modifierProductId = new Map<string, string>(
    modifiers.filter(m => m.product_id).map(m => [m.id, m.product_id]),
  );
  for (const modifierId of orderLineIds.modifierIds) {
    const pid = modifierProductId.get(modifierId);
    if (pid) soldProductIds.add(pid);
  }

  // Task 2: a product linked to an ACTIVE modifier has its price set on
  // the Topping & Tuỳ chọn screen (migration 0098's sync) -- this form
  // must not let it be edited a second place here.
  const linkedToppingProductIds = new Set<string>(
    modifiers.filter(m => m.status === "ACTIVE" && m.product_id).map(m => m.product_id as string),
  );

  // Build the rich data for the form
  const enhancedProducts = visibleProducts.map(p => {
    const productVariants = activeVariants.filter(v => v.product_id === p.id);

    // Thu thập toàn bộ lịch sử giá của các variants thuộc Product này
    const pPriceHistory = allPriceHistory
      .filter((ph: PriceHistory) => productVariants.some(v => v.id === ph.variant_id))
      .sort((a: PriceHistory, b: PriceHistory) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // OPEN-ITEMS 73/74: a product that says "Đang bán" or "Ngừng bán" but
    // has no ACTIVE size at all is a silent trap -- the list claims it is
    // sellable (or pausably sellable), POS never shows it, and nothing on
    // the row explains the gap. Scoped to ACTIVE/INACTIVE only; a DELETED
    // product already shows its own "Đã xóa" badge and needs no second
    // warning.
    const hasNoSellableVariant = p.status !== "DELETED" && !productVariants.some(v => v.status === "ACTIVE");

    return {
      ...p,
      variants: productVariants,
      priceHistory: pPriceHistory,
      neverSold: !soldProductIds.has(p.id),
      hasNoSellableVariant,
      isLinkedTopping: linkedToppingProductIds.has(p.id),
    };
  });

  return (
    <div className="space-y-6">
      <ProductsClient
        enhancedProducts={enhancedProducts}
        activeCategories={activeCategories}
        categories={activeCategories} // Passing for the form inside ProductsClient
        canDelete={canDelete}
      />
    </div>
  );
}
