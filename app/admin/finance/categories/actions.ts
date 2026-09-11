"use server";

import { findAll, findAllWhere, findById, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { creationAudit, updateAudit } from "@/lib/finance/audit-columns";
import { findDuplicateActiveName, duplicateNameErrorMessage } from "@/lib/shared/duplicate-name-guard";
import { parseSalesRevenueFlag } from "@/lib/finance/cash-entry-rules";
import type { DBCashCategory } from "@/types/db";

const SHEET = "Cash_Categories";
const PATH = "/admin/finance/categories";

export async function getCashCategories(): Promise<DBCashCategory[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findAll(SHEET)) as DBCashCategory[];
}

export async function addCashCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên nhóm");
  const kind = formData.get("kind") === "INCOME" ? "INCOME" : "EXPENSE";
  const affects_pnl = formData.get("affects_pnl") === "on";
  const salesRevenue = parseSalesRevenueFlag(kind, affects_pnl, formData.get("is_sales_revenue") === "on");
  if (!salesRevenue.ok) return fail(salesRevenue.error);

  try {
    // Ruling 6 -- level 1 only (an outright refusal): the owner keeps about
    // five groups here, so the level-2 diacritic-stripped warn-and-confirm
    // flow (findDiacriticStrippedMatch, used by app/admin/suppliers) is out
    // of scope. Mirrors migration 0101's own unique index (now updated to
    // match this same normalisation, migration 0065's expression) so the
    // app refuses in Vietnamese before Postgres's ASCII-English violation
    // ever reaches describeActionError, which would otherwise genericize
    // it into the generic fallback sentence and tell the owner nothing
    // useful. The index remains the backstop for a race between two
    // concurrent saves.
    const categories = (await findAll(SHEET)) as DBCashCategory[];
    const conflict = findDuplicateActiveName(categories, name);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    const id = await generateNewId(SHEET, "CFC");
    await insert(SHEET, {
      id, name, kind, affects_pnl, is_sales_revenue: salesRevenue.value, status: "ACTIVE", ...creationAudit(auth.actor),
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
  const salesRevenue = parseSalesRevenueFlag(kind, affects_pnl, formData.get("is_sales_revenue") === "on");
  if (!salesRevenue.ok) return fail(salesRevenue.error);

  try {
    const categories = (await findAll(SHEET)) as DBCashCategory[];
    const conflict = findDuplicateActiveName(categories, name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    const existing = categories.find((c) => c.id === id);
    if (!existing) return fail("Không tìm thấy nhóm");

    // I3 -- owner decision 2026-09-11 ("Khoá, tạo nhóm mới"): once any
    // cash_entries row references this category (any status -- a cancelled
    // row is still history), its Thu/Chi side is locked. Changing it would
    // silently rewrite every past total onto the other side. affects_pnl
    // stays editable (the form warns about recalculation instead).
    if (kind !== existing.kind) {
      const linked = await findAllWhere("Cash_Entries", { eq: { category_id: id }, limit: 1 });
      if (linked.length > 0) {
        return fail(
          "Nhóm này đã có dòng sổ nên không đổi được bên Thu/Chi. Muốn ghi bên kia thì tạo nhóm mới.",
        );
      }
    }

    await update(SHEET, id, { name, kind, affects_pnl, is_sales_revenue: salesRevenue.value, ...updateAudit(auth.actor) });
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
    // M3 -- "Dùng lại" (reactivate) can bring a name back into collision:
    // another category may have taken it ACTIVE while this one was retired.
    // Re-run the same ruling-6 guard used on add/rename.
    if (status === "ACTIVE") {
      const categories = (await findAll(SHEET)) as DBCashCategory[];
      const current = categories.find((c) => c.id === id);
      if (current) {
        const conflict = findDuplicateActiveName(categories, current.name, id);
        if (conflict) return fail(duplicateNameErrorMessage(conflict));
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
// The foreign key is RESTRICT, so a category any entry points at is refused
// by the database no matter who asks.
export async function deleteCashCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã nhóm");

  try {
    // I5 -- the RESTRICT FK already refuses this delete, but Postgres's
    // violation message is ASCII English, and describeActionError replaces
    // any all-ASCII error with the generic fallback, telling the owner
    // nothing. Checked here first, in Vietnamese, naming the category --
    // same shape as lib/catalog/unit-delete-restriction.ts. The FK stays as
    // the backstop for a race between two concurrent requests.
    const linked = await findAllWhere("Cash_Entries", { eq: { category_id: id }, limit: 1 });
    if (linked.length > 0) {
      const category = (await findById(SHEET, id)) as DBCashCategory | null;
      const name = category?.name ?? id;
      return fail(
        `Nhóm "${name}" đã có dòng sổ nên không xoá hẳn được. Bấm "Ngừng dùng" để ẩn nhóm này.`,
      );
    }

    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
