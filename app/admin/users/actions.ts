"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBUser } from "@/types/db";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Users";
const PATH = "/admin/users";

export async function getUsers(): Promise<DBUser[]> {
  try {
    return await findAll(SHEET) as DBUser[];
  } catch (error) {
    console.error("Loi getUsers:", error);
    return [];
  }
}

export async function getUserById(id: string): Promise<DBUser | null> {
  try {
    const users = await findAll(SHEET) as DBUser[];
    return users.find(u => u.id === id) || null;
  } catch (error) {
    console.error("Loi getUserById:", error);
    return null;
  }
}

// PRESERVE: duplicate username check, bcrypt.hash(password, 10), ID prefix "USR"
export async function addUser(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const username = formData.get("username") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!username || !role || !password) return fail("Vui lòng điền đủ thông tin");

  try {
    const users = await findAll(SHEET);
    if (users.find((u: any) => u.username === username)) {
      return fail("Tên đăng nhập đã tồn tại");
    }

    const id = await generateNewId(SHEET, "USR");
    const password_hash = await bcrypt.hash(password, 10);
    const created_at = new Date().toISOString();

    await insert(SHEET, { id, username, password_hash, role, status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

// PRESERVE: hard delete, no admin protection check (matches current behavior)
export async function deleteUserAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

// PRESERVE: conditional password update (only if non-blank), bcrypt hash
export async function updateUser(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!id || !role) return fail("Thiếu thông tin bắt buộc");

  try {
    const dataToUpdate: Record<string, string> = { role };

    if (password && password.trim() !== "") {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    await update(SHEET, id, dataToUpdate);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
