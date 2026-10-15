"use server";

import { findAll, findById, update, remove, generateNewId, getCacheTag } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { normalizeNameForComparison } from "@/lib/shared/duplicate-name-guard";
import { saveModifierGroupAtomic } from "@/lib/products/modifier-group-transaction";
import type { DBModifier, DBModifierGroup, DBModifierGroupProduct } from "@/types/db";

const SHEET = "Modifier_Groups";
const LINKS = "Modifier_Group_Products";
const OPTIONS = "Modifiers";
const PATH = "/admin/products/modifier-groups";

export interface ModifierGroupRow {
  group: DBModifierGroup;
  optionNames: string[];
  productCount: number;
}

const bySortThenName = (a: DBModifierGroup, b: DBModifierGroup) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, "vi");

// Every option counts for an erase, stopped ones too: the RESTRICT key refuses on any row.
const optionsOf = (options: DBModifier[], groupId: string) => options.filter((o) => o.group_id === groupId);

const inUseMessage = (options: DBModifier[]) => `Nhóm còn tuỳ chọn: ${options.map((o) => o.name).join(", ")}.`;

function refresh() {
  for (const sheet of [SHEET, LINKS, OPTIONS]) revalidateTag(getCacheTag(sheet), { expire: 0 });
  revalidatePath(PATH);
}

export async function getModifierGroups(): Promise<ModifierGroupRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [groups, options, links] = await Promise.all([
    findAll(SHEET) as Promise<DBModifierGroup[]>,
    findAll(OPTIONS) as Promise<DBModifier[]>,
    findAll(LINKS) as Promise<DBModifierGroupProduct[]>,
  ]);
  return [...groups].sort(bySortThenName).map((group) => ({
    group,
    optionNames: optionsOf(options, group.id).map((o) => o.name),
    productCount: links.filter((l) => l.group_id === group.id).length,
  }));
}

export async function getModifierGroup(id: string): Promise<{
  group: DBModifierGroup;
  options: DBModifier[];
  productIds: string[];
} | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const group = (await findById(SHEET, id)) as DBModifierGroup | null;
  if (!group) return null;
  const [options, links] = await Promise.all([
    findAll(OPTIONS) as Promise<DBModifier[]>,
    findAll(LINKS) as Promise<DBModifierGroupProduct[]>,
  ]);
  return {
    group,
    options: optionsOf(options, id),
    productIds: links.filter((l) => l.group_id === id).map((l) => l.product_id),
  };
}

const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

async function write(isEdit: boolean, formData: FormData): Promise<ActionResponse> {
  const editId = ((formData.get("id") as string) || "").trim();
  if (isEdit && !editId) return fail("Thiếu mã nhóm");
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên nhóm");
  const mode = formData.get("selection_mode");
  if (mode !== "ONE" && mode !== "MANY") return fail("Chọn kiểu chọn");
  const sortOrder = Number(formData.get("sort_order"));
  if (!inRange(sortOrder, 1, 99)) return fail("Thứ tự hiện từ 1 đến 99");
  const maxTotalRaw = ((formData.get("max_total") as string) || "").trim();
  const maxTotal = mode === "MANY" && maxTotalRaw ? Number(maxTotalRaw) : null;
  if (maxTotal !== null && !inRange(maxTotal, 1, 20)) return fail("Tối đa từ 1 đến 20 phần");
  const allowStandalone = mode === "MANY" && formData.get("allow_standalone") === "on";
  const productIds = formData.getAll("product_ids").map(String).filter(Boolean);

  try {
    const target = normalizeNameForComparison(name);
    const groups = (await findAll(SHEET)) as DBModifierGroup[];
    if (groups.some((g) => g.id !== editId && normalizeNameForComparison(g.name) === target)) {
      return fail("Tên nhóm đã có");
    }
    if (isEdit && !allowStandalone) {
      const sold = optionsOf((await findAll(OPTIONS)) as DBModifier[], editId).filter((o) => o.product_id);
      if (sold.length > 0) {
        return fail(`Nhóm có món bán riêng: ${sold.map((o) => o.name).join(", ")}. Tắt bán riêng ở từng món trước.`);
      }
    }
    const id = isEdit ? editId : await generateNewId(SHEET, "MG");
    await saveModifierGroupAtomic({
      isEdit,
      group: { id, name, selection_mode: mode, max_total: maxTotal, allow_standalone: allowStandalone, sort_order: sortOrder },
      productIds,
    });
    refresh();
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function saveModifierGroup(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  return write(false, formData);
}

export async function updateModifierGroup(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  return write(true, formData);
}

export async function setModifierGroupStatus(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã nhóm");
  const status = formData.get("status");
  if (status !== "ACTIVE" && status !== "INACTIVE") return fail("Trạng thái không hợp lệ");

  try {
    await update(SHEET, id, { status });
    refresh();
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server. Only an empty group.
export async function deleteModifierGroup(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã nhóm");

  try {
    const used = optionsOf((await findAll(OPTIONS)) as DBModifier[], id);
    if (used.length > 0) return fail(inUseMessage(used));

    try {
      await remove(SHEET, id);
    } catch (error) {
      // An option took the group between the check and the delete. The db layer
      // keeps only the message text (no SQLSTATE), so match the 23503 wording.
      const raw = error instanceof Error ? error.message : String(error);
      if (!raw.includes("violates foreign key constraint")) throw error;
      const now = optionsOf((await findAll(OPTIONS)) as DBModifier[], id);
      return fail(now.length > 0 ? inUseMessage(now) : "Nhóm đang được dùng, không xoá được.");
    }
    refresh();
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
