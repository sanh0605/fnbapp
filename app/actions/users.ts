"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function addUser(formData: FormData) {
  const username = formData.get("username") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!username || !role || !password) return { error: "Vui lòng điền đủ thông tin" };

  try {
    const users = await findAll("Users");
    if (users.find(u => u.username === username)) {
      return { error: "Tên đăng nhập đã tồn tại" };
    }

    const id = await generateNewId("Users", "USR");
    const password_hash = await bcrypt.hash(password, 10);
    const created_at = new Date().toISOString();

    await insert("Users", { id, username, password_hash, role, created_at });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to add user" };
  }
}

export async function deleteUser(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { error: "ID không hợp lệ" };

  try {
    await remove("Users", id);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateUser(formData: FormData) {
  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!id || !role) return { error: "Thiếu thông tin bắt buộc" };

  try {
    const dataToUpdate: any = { role };
    
    // Nếu có nhập password mới thì mới cập nhật password
    if (password && password.trim() !== "") {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    await update("Users", id, dataToUpdate);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Lỗi cập nhật nhân sự" };
  }
}
