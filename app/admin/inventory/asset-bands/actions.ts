"use server";

import { findAll, update } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { requireAdmin } from "@/lib/auth";
import { validateBands, type Band } from "@/lib/asset-depreciation";
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
    console.error("Loi getAssetBands:", error);
    return [];
  }
}

// Batch 3, section 3.1: bands are edited in place, never added or removed
// here -- the three seeded bands cover 0 to unbounded with no gap, and any
// edit must keep that property. Editing one band's boundaries changes
// what its neighbour's boundary must be too, so the whole table (with this
// one band's new values substituted in) is what gets validated, not the
// edited row alone.
export async function updateAssetBand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const min_unit_price = Number(formData.get("min_unit_price"));
  const max_unit_price_raw = formData.get("max_unit_price") as string;
  const max_unit_price = max_unit_price_raw === "" ? null : Number(max_unit_price_raw);
  const term_months = Number(formData.get("term_months"));

  if (!id) return fail("ID không hợp lệ");
  if (!Number.isFinite(min_unit_price) || min_unit_price < 0) return fail("Giá thấp nhất không hợp lệ");
  if (max_unit_price !== null && !Number.isFinite(max_unit_price)) return fail("Giá cao nhất không hợp lệ");
  if (!Number.isFinite(term_months) || term_months <= 0) return fail("Số tháng khấu hao không hợp lệ");

  try {
    const existingBands = await findAll(SHEET) as DBAssetDepreciationBand[];
    const candidateBands: Band[] = existingBands.map(b =>
      b.id === id
        ? { min_unit_price, max_unit_price, term_months }
        : { min_unit_price: b.min_unit_price, max_unit_price: b.max_unit_price, term_months: b.term_months },
    );

    const validation = validateBands(candidateBands);
    if (!validation.ok) return fail(validation.error);

    await update(SHEET, id, { min_unit_price, max_unit_price, term_months });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
