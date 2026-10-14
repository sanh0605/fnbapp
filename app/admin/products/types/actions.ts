"use server";

import { findAll, findById, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { normalizeNameForComparison } from "@/lib/shared/duplicate-name-guard";
import type { DBProductType, DBProductCategory } from "@/types/db";

const SHEET = "Product_Types";
const PATH = "/admin/products/types";

export interface ProductTypeRow {
  type: DBProductType;
  categoryCount: number;
  categoryNames: string[];
}

// Every category counts, deleted ones too: the RESTRICT foreign key refuses on any row.
function categoriesUsing(categories: DBProductCategory[], typeId: string): string[] {
  return categories.filter((c) => c.type_id === typeId).map((c) => c.name);
}

function inUseMessage(names: string[]): string {
  return `Loại món đang được dùng ở nhóm: ${names.join(", ")}.`;
}

export async function getProductTypes(): Promise<ProductTypeRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [types, categories] = await Promise.all([
    findAll(SHEET) as Promise<DBProductType[]>,
    findAll("Product_Categories") as Promise<DBProductCategory[]>,
  ]);
  return [...types]
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((type) => {
      const categoryNames = categoriesUsing(categories, type.id);
      return { type, categoryCount: categoryNames.length, categoryNames };
    });
}

export async function getProductType(id: string): Promise<DBProductType | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findById(SHEET, id)) as DBProductType | null;
}

function hasName(types: DBProductType[], name: string, exceptId?: string): boolean {
  const target = normalizeNameForComparison(name);
  return types.some((t) => t.id !== exceptId && normalizeNameForComparison(t.name) === target);
}

export async function saveProductType(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên loại món");
  const is_drink = formData.get("is_drink") === "on";

  try {
    if (hasName((await findAll(SHEET)) as DBProductType[], name)) return fail("Tên loại món đã có");
    const id = await generateNewId(SHEET, "PT");
    await insert(SHEET, { id, name, is_drink });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function updateProductType(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã loại món");
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên loại món");
  const is_drink = formData.get("is_drink") === "on";

  try {
    if (hasName((await findAll(SHEET)) as DBProductType[], name, id)) return fail("Tên loại món đã có");
    await update(SHEET, id, { name, is_drink });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server.
export async function deleteProductType(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã loại món");

  try {
    const names = categoriesUsing((await findAll("Product_Categories")) as DBProductCategory[], id);
    if (names.length > 0) return fail(inUseMessage(names));

    try {
      await remove(SHEET, id);
    } catch (error) {
      // A category took the type between the check and the delete. The db layer
      // keeps only the message text (no SQLSTATE), so match the 23503 wording.
      const raw = error instanceof Error ? error.message : String(error);
      if (!raw.includes("violates foreign key constraint")) throw error;
      const now = categoriesUsing((await findAll("Product_Categories")) as DBProductCategory[], id);
      return fail(now.length > 0 ? inUseMessage(now) : "Loại món đang được dùng, không xoá được.");
    }
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
