"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { creationAudit, updateAudit } from "@/lib/finance/audit-columns";
import type { DBCashCategory } from "@/types/db";

const SHEET = "Cash_Categories";
const PATH = "/admin/finance/categories";

export async function getCashCategories(): Promise<DBCashCategory[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findAll(SHEET)) as DBCashCategory[];
}

// Ruling 6 -- mirrors migration 0101's own uniqueness rule (the partial
// unique index on lower(trim(name)) where status = 'ACTIVE') so the app
// refuses in Vietnamese before Postgres's ASCII-English violation ever
// reaches describeActionError, which would otherwise genericize it into
// the generic fallback sentence and tell the owner nothing useful. The
// index remains the backstop for a race between two concurrent saves.
function findActiveDuplicate(
  categories: DBCashCategory[],
  name: string,
  excludeId?: string,
): DBCashCategory | null {
  const target = name.trim().toLowerCase();
  return (
    categories.find(
      (c) => c.id !== excludeId && c.status === "ACTIVE" && c.name.trim().toLowerCase() === target,
    ) ?? null
  );
}

export async function addCashCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên nhóm");
  const kind = formData.get("kind") === "INCOME" ? "INCOME" : "EXPENSE";
  const affects_pnl = formData.get("affects_pnl") === "on";

  try {
    const categories = (await findAll(SHEET)) as DBCashCategory[];
    const duplicate = findActiveDuplicate(categories, name);
    if (duplicate) return fail(`Tên nhóm "${duplicate.name}" đã có rồi, hãy chọn tên khác`);

    const id = await generateNewId(SHEET, "CFC");
    await insert(SHEET, {
      id, name, kind, affects_pnl, status: "ACTIVE", ...creationAudit(auth.actor),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function updateCashCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  const name = ((formData.get("name") as string) || "").trim();
  if (!id) return fail("Thiếu mã nhóm");
  if (!name) return fail("Nhập tên nhóm");
  const kind = formData.get("kind") === "INCOME" ? "INCOME" : "EXPENSE";
  const affects_pnl = formData.get("affects_pnl") === "on";

  try {
    const categories = (await findAll(SHEET)) as DBCashCategory[];
    const duplicate = findActiveDuplicate(categories, name, id);
    if (duplicate) return fail(`Tên nhóm "${duplicate.name}" đã có rồi, hãy chọn tên khác`);

    await update(SHEET, id, { name, kind, affects_pnl, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// The ordinary way to get rid of a category: it stops appearing in the picker,
// and every entry already pointing at it keeps its name.
export async function setCashCategoryStatus(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã nhóm");
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  try {
    await update(SHEET, id, { status, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server.
// The foreign key is RESTRICT, so a category any entry points at is refused
// by the database no matter who asks.
export async function deleteCashCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã nhóm");

  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
