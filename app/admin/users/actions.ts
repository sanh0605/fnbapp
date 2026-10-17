"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import type { DBUser } from "@/types/db";
import bcrypt from "bcryptjs";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";

const SHEET = "Users";
const PATH = "/admin/users";
const ROLES = ["STAFF", "MANAGER", "ADMIN"];

// BR-ACCESS-004: same set requireOwner() accepts; requireAdmin() also lets MANAGER in.
const isOwnerRole = (role: string) => role === "ADMIN" || role === "SYSTEM";
const GRANT_ADMIN_DENIED = "Chỉ chủ quán mới cấp được vai Chủ quán.";
const NAME_MAX = 60;
const NAME_INVALID = `Tên nhân viên phải từ 1 đến ${NAME_MAX} ký tự.`;
const nameValid = (name: string) => name.length >= 1 && name.length <= NAME_MAX;

type DBUserRow =DBUser & Record<string, unknown>;

function toClientUser(user: DBUserRow): DBUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

// True when this account is an ADMIN and no other ACTIVE ADMIN exists: nobody could open
// owner-only screens again. A stopped ADMIN cannot sign in (lib/auth/auth.ts), so it does not count.
function isLastAdmin(users: DBUserRow[], id: string): boolean {
  const target = users.find(candidate => candidate.id === id);
  if (target?.role !== "ADMIN") return false;
  return !users.some(candidate => candidate.id !== id && candidate.role === "ADMIN" && candidate.status === "ACTIVE");
}

export async function getUsers(): Promise<DBUser[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const users = await findAll(SHEET) as DBUserRow[];
    return users.map(toClientUser);
  } catch (error) {
    // rethrow instead of a fabricated empty list -- app/error.tsx handles it.
    console.error("Loi getUsers:", error);
    throw error;
  }
}

export async function getUserById(id: string): Promise<DBUser | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const users = await findAll(SHEET) as DBUserRow[];
    const user = users.find(candidate => candidate.id === id);
    return user ? toClientUser(user) : null;
  } catch (error) {
    // Same fix, same plan: null here already means "not found" on a
    // successful read (see the try block) -- a real findAll failure must
    // not collapse into that same, genuinely different, outcome.
    console.error("Loi getUserById:", error);
    throw error;
  }
}

// PRESERVE: duplicate username check, bcrypt.hash(password, 10), ID prefix "USR"
export async function addUser(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const username = formData.get("username") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;
  const name = String(formData.get("name") ?? "").trim();

  if (!username || !role || !password) return fail("Vui lòng điền đủ thông tin");
  if (!ROLES.includes(role)) return fail("Vai trò không hợp lệ");
  if (role === "ADMIN" && !isOwnerRole(auth.actor.role)) return fail(GRANT_ADMIN_DENIED);
  if (!nameValid(name)) return fail(NAME_INVALID);

  try {
    const users = await findAll(SHEET);
    if (users.find((u: any) => u.username === username)) {
      return fail("Tên đăng nhập đã tồn tại");
    }

    const id = await generateNewId(SHEET, "USR");
    const password_hash = await bcrypt.hash(password, 10);
    const created_at = new Date().toISOString();

    await insert(SHEET, { id, username, name, password_hash, role, status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// PRESERVE: hard delete. Refuses self-delete and removing the last ADMIN account.
export async function deleteUserAction(formData: FormData): Promise<ActionResponse> {
  // BR-ACCESS-003: permanent deletion is ADMIN only (owner decision 2026-09-08).
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  // Never let the signed-in owner delete their own account.
  if (auth.actor.id === id) return fail("Không thể xoá tài khoản đang đăng nhập.");

  try {
    const users = await findAll(SHEET) as DBUserRow[];
    if (isLastAdmin(users, id)) return fail("Không thể xoá tài khoản chủ quán cuối cùng.");

    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// PRESERVE: conditional password update (only if non-blank), bcrypt hash
export async function updateUser(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;
  // Absent field = leave the stored name alone; a present one must be valid.
  const rawName = formData.get("name");
  const name = rawName === null ? null : String(rawName).trim();

  if (!id || !role) return fail("Thiếu thông tin bắt buộc");
  if (!ROLES.includes(role)) return fail("Vai trò không hợp lệ");
  if (name !== null && !nameValid(name)) return fail(NAME_INVALID);
  const isOwner = isOwnerRole(auth.actor.role);

  try {
    const users = await findAll(SHEET) as DBUserRow[];
    if (!isOwner && users.find(candidate => candidate.id === id)?.role === "ADMIN") {
      return fail("Chỉ chủ quán mới sửa được tài khoản chủ quán.");
    }
    if (role === "ADMIN" && !isOwner) return fail(GRANT_ADMIN_DENIED);
    if (role !== "ADMIN" && isLastAdmin(users, id)) {
      return fail("Không thể hạ vai tài khoản chủ quán cuối cùng.");
    }
    const dataToUpdate: Record<string, string> = { role };
    if (name !== null) dataToUpdate.name = name;

    if (password && password.trim() !== "") {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    await update(SHEET, id, dataToUpdate);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
