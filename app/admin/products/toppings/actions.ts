"use server";

import { findAll, update } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
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

  revalidatePath("/pos");
  revalidatePath("/admin/products/toppings");
  return ok(undefined);
}
