"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function getBrands() {
  try {
    return await findAll("Brands");
  } catch (error) {
    console.error("Lỗi getBrands:", error);
    return [];
  }
}

export async function addBrand(formData: FormData) {
  const name = formData.get("name") as string;
  const start_date = formData.get("start_date") as string;
  const code = formData.get("code") as string;

  if (!name) return { error: "Tên thương hiệu không được để trống" };

  try {
    const id = await generateNewId("Brands", "BR");
    const created_at = new Date().toISOString();

    await insert("Brands", { id, name, code: code?.toUpperCase(), start_date, created_at });
    revalidatePath("/admin/brands");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    return { error: error.message || "Failed to add brand" };
  }
}

export async function editBrand(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const start_date = formData.get("start_date") as string;
  const code = formData.get("code") as string;

  if (!id || !name) return { error: "ID và Tên không hợp lệ" };

  try {
    await update("Brands", id, { name, code: code?.toUpperCase(), start_date });
    revalidatePath("/admin/brands");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteBrand(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { error: "ID không hợp lệ" };

  try {
    await remove("Brands", id);
    revalidatePath("/admin/brands");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
