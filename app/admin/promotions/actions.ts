"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Promotions";
const PATH = "/admin/promotions";
const PROMOTION_TYPES = new Set(["ORDER_DISCOUNT", "PRODUCT_DISCOUNT"]);
const DISCOUNT_TYPES = new Set(["PERCENT", "FLAT_VND", "FLAT_PRICE"]);
const PROMOTION_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

function promotionText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePromotionInput(promoData: Record<string, any>):
  | { ok: true; id: string; data: Record<string, unknown> }
  | { ok: false; error: string } {
  const id = promotionText(promoData.id);
  const name = promotionText(promoData.name);
  const code = promotionText(promoData.code).toUpperCase();
  const brandId = promotionText(promoData.brand_id);
  const type = promotionText(promoData.type);
  const discountType = promotionText(promoData.discount_type);
  const status = promotionText(promoData.status) || "ACTIVE";
  const discountValue = Number(promoData.discount_value);
  const minOrderValue = Number(promoData.min_order_value || 0);
  const startDate = promotionText(promoData.start_date);
  const endDate = promotionText(promoData.end_date);
  const applicableProductsJson = promotionText(promoData.applicable_products_json);

  if (!name) return { ok: false, error: "Tên chương trình khuyến mãi không được để trống" };
  if (name.length > 120) return { ok: false, error: "Tên chương trình khuyến mãi không được vượt quá 120 ký tự" };
  if (code.length > 64) return { ok: false, error: "Mã khuyến mãi không được vượt quá 64 ký tự" };
  if (!PROMOTION_TYPES.has(type)) return { ok: false, error: "Đối tượng giảm giá không hợp lệ" };
  if (!DISCOUNT_TYPES.has(discountType)) return { ok: false, error: "Hình thức giảm giá không hợp lệ" };
  if (!PROMOTION_STATUSES.has(status)) return { ok: false, error: "Trạng thái khuyến mãi không hợp lệ" };
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { ok: false, error: "Giá trị giảm giá phải là số hữu hạn lớn hơn 0" };
  }
  if (discountType === "PERCENT" && discountValue > 100) {
    return { ok: false, error: "Giảm giá theo phần trăm không được vượt quá 100%" };
  }
  if (!Number.isFinite(minOrderValue) || minOrderValue < 0) {
    return { ok: false, error: "Giá trị đơn tối thiểu phải là số hữu hạn không âm" };
  }

  const startTimestamp = Date.parse(startDate);
  const endTimestamp = endDate ? Date.parse(endDate) : null;
  if (!Number.isFinite(startTimestamp)) return { ok: false, error: "Ngày bắt đầu không hợp lệ" };
  if (endTimestamp !== null && (!Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp)) {
    return { ok: false, error: "Ngày kết thúc phải hợp lệ và sau ngày bắt đầu" };
  }

  if (type === "PRODUCT_DISCOUNT") {
    try {
      const values = Object.values(JSON.parse(applicableProductsJson));
      if (values.length === 0 || values.some(value => {
        const numericValue = Number(value);
        return !Number.isFinite(numericValue)
          || numericValue <= 0
          || (discountType === "PERCENT" && numericValue > 100);
      })) {
        return { ok: false, error: "Giá trị giảm theo sản phẩm không hợp lệ" };
      }
    } catch {
      return { ok: false, error: "Danh sách sản phẩm áp dụng không hợp lệ" };
    }
  }

  return {
    ok: true,
    id,
    data: {
      name,
      code,
      brand_id: brandId,
      type,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_value: minOrderValue,
      start_date: new Date(startTimestamp).toISOString(),
      end_date: endTimestamp === null ? "" : new Date(endTimestamp).toISOString(),
      applicable_products_json: type === "PRODUCT_DISCOUNT" ? applicableProductsJson : "",
      status,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function getPromotionsData(): Promise<{
  promotions: DBPromotion[];
  brands: DBBrand[];
  products: DBProduct[];
  variants: DBProductVariant[];
  categories: DBProductCategory[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

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

// Preserve the existing upsert and revalidation behavior, but enforce the same
// invariants on the server that the browser form applies before submission.
export async function savePromotion(promoData: Record<string, any>): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const normalized = normalizePromotionInput(promoData);
    if (!normalized.ok) return fail(normalized.error);
    const { data, id } = normalized;

    if (id) {
      await update(SHEET, id, data);
      revalidatePath(PATH);
      revalidatePath("/pos");
      return ok({ id });
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
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

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
