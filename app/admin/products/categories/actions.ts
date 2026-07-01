"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, softDeleteEntity, type ActionResponse } from "@/lib/shared-actions";
import type { DBProductCategory, DBProduct } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Product_Categories";
const PATH = "/admin/products/categories";

export async function getCategoriesWithCounts(): Promise<{
  categories: DBProductCategory[];
  counts: Record<string, number>;
}> {
  try {
    const [categories, products] = await Promise.all([
      findAll(SHEET) as Promise<DBProductCategory[]>,
      findAll("Products") as Promise<DBProduct[]>,
    ]);
    const activeCategories = categories.filter(c => c.status !== "DELETED");
    const counts: Record<string, number> = {};
    for (const cat of activeCategories) {
      counts[cat.id] = products.filter(
        p => p.category_id === cat.id && p.status !== "DELETED"
      ).length;
    }
    return { categories: activeCategories, counts };
  } catch (error) {
    console.error("Loi getCategories:", error);
    return { categories: [], counts: {} };
  }
}

export async function saveCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  if (!name) return fail("Vui lòng nhập tên danh mục");

  try {
    const id = await generateNewId(SHEET, "CAT");
    const created_at = new Date().toISOString();
    await insert(SHEET, { id, name, status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updateCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (!id || !name) return fail("Dữ liệu không hợp lệ");

  try {
    await update(SHEET, id, { name });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");
  return softDeleteEntity(SHEET, id, PATH);
}
