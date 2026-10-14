"use server";

import { findAll } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { validateBands, type Band } from "@/lib/assets/asset-depreciation";
import { replaceAssetBands, type BandInput } from "@/lib/assets/asset-bands-transaction";
import type { DBAssetDepreciationBand } from "@/types/db";

const SHEET = "asset_depreciation_bands";
const PATH = "/admin/inventory/asset-bands";

export async function getAssetBands(): Promise<DBAssetDepreciationBand[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const bands = (await findAll(SHEET)) as DBAssetDepreciationBand[];
    return bands.sort((a, b) => a.min_unit_price - b.min_unit_price);
  } catch (error) {
    // rethrow instead of a fabricated empty list -- app/error.tsx handles it.
    console.error("Loi getAssetBands:", error);
    throw error;
  }
}

function parseBandInputs(raw: unknown): { ok: true; bands: BandInput[] } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Thiếu danh sách khung" };
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Danh sách khung không đọc được" };
  }
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: "Phải có ít nhất một khung khấu hao" };

  const bands: BandInput[] = [];
  for (const item of list) {
    const { id, min_unit_price, term_months } = (item ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(min_unit_price) || (min_unit_price as number) < 0) {
      return { ok: false, error: "Giá bắt đầu của khung phải là số nguyên đồng, từ 0 trở lên" };
    }
    if (!Number.isInteger(term_months) || (term_months as number) < 1) {
      return { ok: false, error: "Số tháng khấu hao phải là số nguyên từ 1 trở lên" };
    }
    if (id != null && (typeof id !== "string" || id === "")) return { ok: false, error: "Mã khung không hợp lệ" };
    bands.push({ id: (id as string | null | undefined) ?? null, min_unit_price: min_unit_price as number, term_months: term_months as number });
  }

  bands.sort((a, b) => a.min_unit_price - b.min_unit_price);
  if (bands[0].min_unit_price !== 0) return { ok: false, error: "Khung đầu tiên phải bắt đầu từ 0đ" };
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].min_unit_price === bands[i - 1].min_unit_price) {
      return { ok: false, error: "Hai khung không được bắt đầu cùng một mức giá" };
    }
  }
  const ids = bands.map((b) => b.id).filter((id) => id !== null);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Một khung xuất hiện hai lần" };
  return { ok: true, bands };
}

// 2026-10-14 audit A4: the whole table is saved in one go (migration 0118).
// "Đến dưới" is never typed; it is the next band's start, so the price line
// cannot get a gap or an overlap. Dropping an existing band is a permanent
// delete, so it needs the owner (BR-ACCESS-003); anything else needs admin.
export async function saveAssetBands(formData: FormData): Promise<ActionResponse> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail(admin.error);

  const parsed = parseBandInputs(formData.get("bands"));
  if (!parsed.ok) return fail(parsed.error);

  try {
    const existing = (await findAll(SHEET)) as DBAssetDepreciationBand[];
    const existingIds = new Set(existing.map((b) => b.id));
    const submittedIds = new Set(parsed.bands.map((b) => b.id));
    if (parsed.bands.some((b) => b.id !== null && !existingIds.has(b.id))) {
      return fail("Không tìm thấy khung khấu hao đang sửa");
    }
    if ([...existingIds].some((id) => !submittedIds.has(id))) {
      const owner = await requireOwner();
      if (!owner.ok) return fail(owner.error);
    }

    // Second net: the same check the old per-band actions ran.
    const validation = validateBands(
      parsed.bands.map((b, i, all) => ({
        min_unit_price: b.min_unit_price,
        max_unit_price: all[i + 1]?.min_unit_price ?? null,
        term_months: b.term_months,
      })),
    );
    if (!validation.ok) return fail(validation.error);

    const ids = await replaceAssetBands(parsed.bands);
    revalidatePath(PATH);
    return ok({ ids });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
