"use server";

import { findAll, update, getCacheTag } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";

export async function toggleToppingStandalone(
  productId: string,
  enabled: boolean
): Promise<ActionResponse> {
  // CODE-22: server-side auth
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const products = await findAll("Products");
  const product = (products as any[]).find(p => p.id === productId);
  if (!product) return fail(`Không tìm thấy sản phẩm ${productId}`);
  if (product.category_id !== "CAT-007") {
    return fail(`Sản phẩm ${productId} không thuộc category topping standalone.`);
  }

  const newStatus = enabled ? "ACTIVE" : "INACTIVE";
  await update("Products", productId, { status: newStatus });

  // docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
  // section 2: Products is cached 10 min, keyed by table. The
  // revalidatePath("/pos") call below has never actually helped -- a path
  // revalidation never touches the tag-keyed findAll cache POS reads
  // through (docs/superpowers/plans/2026-08-31-pos-shows-stale-products.md's
  // own finding, left unfixed there as OPEN-ITEMS 79).
  revalidateTag(getCacheTag("Products"));
  revalidatePath("/pos");
  revalidatePath("/admin/products/toppings");
  return ok(undefined);
}
