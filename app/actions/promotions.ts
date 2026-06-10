"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function getPromotionsData() {
  try {
    const list = await findAll("Promotions");
    return { success: true, promotions: list };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function savePromotion(promoData: any) {
  try {
    const data = {
      ...promoData,
      discount_value: Number(promoData.discount_value || 0),
      min_order_value: Number(promoData.min_order_value || 0),
      status: promoData.status || "ACTIVE",
      updated_at: new Date().toISOString(),
    };

    if (promoData.id) {
      await update("Promotions", promoData.id, data);
      revalidatePath("/admin/promotions");
      revalidatePath("/pos");
      return { success: true, id: promoData.id };
    } else {
      const newId = await generateNewId("Promotions", "PRM");
      const inserted = await insert("Promotions", {
        ...data,
        id: newId,
        created_at: new Date().toISOString(),
      });
      revalidatePath("/admin/promotions");
      revalidatePath("/pos");
      return { success: true, id: newId };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePromotion(promoId: string) {
  try {
    await remove("Promotions", promoId);
    revalidatePath("/admin/promotions");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
