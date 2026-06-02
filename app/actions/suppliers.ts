"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function addSupplier(formData: FormData) {
  const name = (formData.get("name") as string) || "";
  const phone = (formData.get("phone") as string) || "";
  const tax_id = (formData.get("tax_id") as string) || "";
  const address = (formData.get("address") as string) || "";
  const links = (formData.get("links") as string) || ""; // Dạng mảng chuỗi json hoặc text

  const id = (formData.get("id") as string) || "";

  if (!name) return { error: "Tên nhà cung cấp không được để trống" };

  try {
    const suppliers = await findAll("Suppliers");
    const existing = suppliers.find((s:any) => s.name.toLowerCase() === name.toLowerCase());

    if (id) {
      if (existing && existing.id !== id) {
        return { error: "Tên nhà cung cấp đã được sử dụng" };
      }
      await update("Suppliers", id, { name, phone, tax_id, address, links });
    } else {
      if (existing) {
        return { error: "Nhà cung cấp đã tồn tại (trùng tên)" };
      }
      const newId = await generateNewId("Suppliers", "NCC");
      await insert("Suppliers", { id: newId, name, phone, tax_id, address, parent_id: "", links });
      
      revalidatePath("/admin/suppliers");
      return { success: true, id: newId };
    }
    
    revalidatePath("/admin/suppliers");
    return { success: true, id };
  } catch (error: any) {
    return { error: error.message || "Failed to add supplier" };
  }
}

export async function deleteSupplier(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { error: "ID không hợp lệ" };

  try {
    await remove("Suppliers", id);
    revalidatePath("/admin/suppliers");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
