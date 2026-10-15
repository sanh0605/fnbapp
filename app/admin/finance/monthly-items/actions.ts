"use server";

import { findAll, findAllWhere, findById, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { creationAudit, updateAudit } from "@/lib/finance/audit-columns";
import { findDuplicateActiveName } from "@/lib/shared/duplicate-name-guard";
import type { DBMonthlyExpenseItem, DBCashCategory, DBCashEntry } from "@/types/db";

const SHEET = "Monthly_Expense_Items";
const PATH = "/admin/finance/monthly-items";

export interface MonthlyItemRow {
  item: DBMonthlyExpenseItem;
  entryCount: number; // every ledger row linked to the item, cancelled included (RESTRICT key)
}

export async function getMonthlyItems(): Promise<MonthlyItemRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const items = (await findAll(SHEET)) as DBMonthlyExpenseItem[];
  // Only the rows that point at an item, not the whole ledger.
  const entries = items.length
    ? await findAllWhere<DBCashEntry>("Cash_Entries", { in: { monthly_item_id: items.map((i) => i.id) } })
    : [];
  return [...items]
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((item) => ({
      item,
      entryCount: entries.filter((e) => e.monthly_item_id === item.id).length,
    }));
}

export async function getMonthlyItem(id: string): Promise<DBMonthlyExpenseItem | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findById(SHEET, id)) as DBMonthlyExpenseItem | null;
}

// R6: an EXPENSE group that is ACTIVE, or the one the item already has.
async function isUsableExpenseCategory(id: string, ownId?: string): Promise<boolean> {
  const categories = (await findAll("Cash_Categories")) as DBCashCategory[];
  return categories.some((c) => c.id === id && c.kind === "EXPENSE" && (c.status === "ACTIVE" || c.id === ownId));
}

export async function createMonthlyItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên khoản chi");
  const cash_category_id = ((formData.get("cash_category_id") as string) || "").trim();

  try {
    if (!(await isUsableExpenseCategory(cash_category_id))) return fail("Chọn nhóm chi đang dùng");
    const items = (await findAll(SHEET)) as DBMonthlyExpenseItem[];
    if (findDuplicateActiveName(items, name)) return fail("Tên khoản chi đã có");

    const id = await generateNewId(SHEET, "KCT");
    await insert(SHEET, { id, name, cash_category_id, status: "ACTIVE", ...creationAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function updateMonthlyItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã khoản chi");
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên khoản chi");
  const cash_category_id = ((formData.get("cash_category_id") as string) || "").trim();

  try {
    const items = (await findAll(SHEET)) as DBMonthlyExpenseItem[];
    const current = items.find((i) => i.id === id);
    if (!(await isUsableExpenseCategory(cash_category_id, current?.cash_category_id))) {
      return fail("Chọn nhóm chi đang dùng");
    }
    // A retired item does not compete for its name until it is reactivated.
    if (current?.status !== "INACTIVE" && findDuplicateActiveName(items, name, id)) {
      return fail("Tên khoản chi đã có");
    }
    // Its rows were checked against the old group; moving it would break them.
    if (current && cash_category_id !== current.cash_category_id) {
      const linked = await findAllWhere("Cash_Entries", { eq: { monthly_item_id: id }, limit: 1 });
      if (linked.length > 0) {
        return fail("Khoản chi này đã có dòng trong sổ thu chi nên không đổi nhóm được. Muốn dùng nhóm khác thì tạo khoản chi mới.");
      }
    }
    await update(SHEET, id, { name, cash_category_id, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function setMonthlyItemStatus(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã khoản chi");
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  try {
    if (status === "ACTIVE") {
      const items = (await findAll(SHEET)) as DBMonthlyExpenseItem[];
      const current = items.find((i) => i.id === id);
      if (current && findDuplicateActiveName(items, current.name, id)) return fail("Tên khoản chi đã có");
      // Stopping a group needs its items stopped first, so an ACTIVE item never sits under a stopped group.
      if (current && !(await isUsableExpenseCategory(current.cash_category_id))) {
        return fail("Nhóm chi của khoản này đã ngừng dùng. Hãy dùng lại nhóm đó trước.");
      }
    }
    await update(SHEET, id, { status, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server.
export async function deleteMonthlyItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã khoản chi");

  try {
    // Any linked row blocks the delete, cancelled ones included (RESTRICT foreign key).
    const linked = await findAllWhere("Cash_Entries", { eq: { monthly_item_id: id }, limit: 1 });
    if (linked.length > 0) return fail("Khoản này đã có dòng trong sổ thu chi, chỉ ngừng dùng được.");

    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
