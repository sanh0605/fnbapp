"use server";

import { findAll, insert, update, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { ok, fail, deleteEntity, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import type { DBProductCategory, DBProduct, DBProductType } from "@/types/db";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { findDuplicateActiveName, duplicateNameErrorMessage } from "@/lib/shared/duplicate-name-guard";

const SHEET = "Product_Categories";
const PATH = "/admin/products/categories";

export async function getCategoriesWithCounts(): Promise<{
  categories: DBProductCategory[];
  counts: Record<string, number>;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [categories, products] = await Promise.all([
      findAll(SHEET) as Promise<DBProductCategory[]>,
      findAll("Products") as Promise<DBProduct[]>,
    ]);
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat.id] = products.filter(p => p.category_id === cat.id).length;
    }
    return { categories, counts };
  } catch (error) {
    // rethrow instead of a fabricated empty result -- app/error.tsx handles it.
    console.error("Loi getCategories:", error);
    throw error;
  }
}

// The product type must be chosen and must exist.
async function typeExists(typeId: string): Promise<boolean> {
  if (!typeId) return false;
  const types = (await findAll("Product_Types")) as DBProductType[];
  return types.some(t => t.id === typeId);
}

// Blank means no icon on the till card (spec R4); one emoji can be several code units.
function readIcon(formData: FormData): { icon: string | null; error?: string } {
  const icon = ((formData.get("icon") as string) || "").trim();
  return icon.length > 8 ? { icon: null, error: "Biểu tượng tối đa 8 ký tự" } : { icon: icon || null };
}

export async function saveCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  if (!name) return fail("Vui lòng nhập tên danh mục");
  const type_id = ((formData.get("type_id") as string) || "").trim();
  const { icon, error: iconError } = readIcon(formData);
  if (iconError) return fail(iconError);

  try {
    if (!(await typeExists(type_id))) return fail("Chọn loại món");
    const duplicate = findDuplicateActiveName((await findAll(SHEET)) as DBProductCategory[], name);
    if (duplicate) return fail(duplicateNameErrorMessage(duplicate));
    const id = await generateNewId(SHEET, "CAT");
    const created_at = new Date().toISOString();
    await insert(SHEET, { id, name, type_id, icon, status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function updateCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (!id || !name) return fail("Dữ liệu không hợp lệ");
  const type_id = ((formData.get("type_id") as string) || "").trim();
  const { icon, error: iconError } = readIcon(formData);
  if (iconError) return fail(iconError);

  try {
    if (!(await typeExists(type_id))) return fail("Chọn loại món");
    const duplicate = findDuplicateActiveName((await findAll(SHEET)) as DBProductCategory[], name, id);
    if (duplicate) return fail(duplicateNameErrorMessage(duplicate));
    await update(SHEET, id, { name, type_id, icon });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003: an empty group has no history, so only the owner erases it for good.
export async function deleteCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    const [categories, products] = await Promise.all([
      findAll(SHEET) as Promise<DBProductCategory[]>,
      findAll("Products") as Promise<DBProduct[]>,
    ]);
    // same predicate as getCategoriesWithCounts
    const inUse = products.filter(p => p.category_id === id).length;
    if (inUse > 0) {
      const cat = categories.find(c => c.id === id);
      return fail(`Không xoá được nhóm "${cat?.name ?? id}": còn ${inUse} món đang dùng.`);
    }
  } catch (error: unknown) {
    return describeActionError(error);
  }
  return deleteEntity(SHEET, id, PATH);
}
