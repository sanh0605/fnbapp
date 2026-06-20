"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";

const SHEET = "Promotions";
const PATH = "/admin/promotions";

export async function getPromotionsData(): Promise<{
  promotions: DBPromotion[];
  brands: DBBrand[];
  products: DBProduct[];
  variants: DBProductVariant[];
  categories: DBProductCategory[];
}> {
  try {
    const [promotions, brands, products, variants, categories] = await Promise.all([
      findAll(SHEET) as Promise<DBPromotion[]>,
      findAll("Brands") as Promise<DBBrand[]>,
      findAll("Products") as Promise<DBProduct[]>,
      findAll("Product_Variants") as Promise<DBProductVariant[]>,
      findAll("Product_Categories") as Promise<DBProductCategory[]>,
    ]);
    return { promotions, brands, products, variants, categories };
  } catch (error) {
    console.error("Loi getPromotionsData:", error);
    return { promotions: [], brands: [], products: [], variants: [], categories: [] };
  }
}

// --- COPY savePromotion EXACTLY from app/actions/promotions.ts ---
// PRESERVE: Number() coercion on discount_value and min_order_value,
// status default "ACTIVE", updated_at on every save,
// upsert logic (id present = update, absent = create with prefix "PRM"),
// revalidation of both /admin/promotions and /pos
export async function savePromotion(promoData: Record<string, any>): Promise<ActionResponse> {
  try {
    const data = {
      ...promoData,
      discount_value: Number(promoData.discount_value || 0),
      min_order_value: Number(promoData.min_order_value || 0),
      status: promoData.status || "ACTIVE",
      updated_at: new Date().toISOString(),
    };

    if (promoData.id) {
      await update(SHEET, promoData.id, data);
      revalidatePath(PATH);
      revalidatePath("/pos");
      return ok({ id: promoData.id });
    } else {
      const newId = await generateNewId(SHEET, "PRM");
      await insert(SHEET, {
        ...data,
        id: newId,
        created_at: new Date().toISOString(),
      });
      revalidatePath(PATH);
      revalidatePath("/pos");
      return ok({ id: newId });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

// --- COPY deletePromotion EXACTLY ---
// PRESERVE: hard delete (remove), revalidation of both paths
export async function deletePromotionAction(promoId: string): Promise<ActionResponse> {
  try {
    await remove(SHEET, promoId);
    revalidatePath(PATH);
    revalidatePath("/pos");
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
