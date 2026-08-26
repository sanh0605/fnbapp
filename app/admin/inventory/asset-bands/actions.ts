"use server";

import { findAll, update, insert, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
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

function parseBandFields(
  formData: FormData,
): { ok: true; fields: Band } | { ok: false; error: string } {
  const min_unit_price = Number(formData.get("min_unit_price"));
  const max_unit_price_raw = formData.get("max_unit_price") as string;
  const max_unit_price = max_unit_price_raw === "" ? null : Number(max_unit_price_raw);
  const term_months = Number(formData.get("term_months"));

  if (!Number.isFinite(min_unit_price) || min_unit_price < 0) return { ok: false, error: "Giá thấp nhất không hợp lệ" };
  if (max_unit_price !== null && !Number.isFinite(max_unit_price)) return { ok: false, error: "Giá cao nhất không hợp lệ" };
  if (!Number.isFinite(term_months) || term_months <= 0) return { ok: false, error: "Số tháng khấu hao không hợp lệ" };

  return { ok: true, fields: { min_unit_price, max_unit_price, term_months } };
}

function toBand(b: DBAssetDepreciationBand): Band {
  return { min_unit_price: b.min_unit_price, max_unit_price: b.max_unit_price, term_months: b.term_months };
}

// Batch 3, section 3.1, extended 2026-08-23 (section 1): bands are edited
// in place -- the three seeded bands cover 0 to unbounded with no gap, and
// any edit must keep that property. Editing one band's boundaries changes
// what its neighbour's boundary must be too, so the whole table (with this
// one band's new values substituted in) is what gets validated, not the
// edited row alone.
export async function updateAssetBand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  const parsed = parseBandFields(formData);
  if (!parsed.ok) return fail(parsed.error);

  try {
    const existingBands = await findAll(SHEET) as DBAssetDepreciationBand[];
    const candidateBands: Band[] = existingBands.map(b => (b.id === id ? parsed.fields : toBand(b)));

    const validation = validateBands(candidateBands);
    if (!validation.ok) return fail(validation.error);

    await update(SHEET, id, parsed.fields);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// 2026-08-23, section 2: "A table the owner cannot add a row to is not the
// settings screen CLAUDE.md section 8 requires; it is a constant with an
// edit box." Validated against the FULL resulting set (existing bands plus
// this one), same as update -- a new band that overlaps or gaps another is
// refused before it is ever written.
export async function createAssetBand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const parsed = parseBandFields(formData);
  if (!parsed.ok) return fail(parsed.error);

  try {
    const existingBands = await findAll(SHEET) as DBAssetDepreciationBand[];
    const candidateBands: Band[] = [...existingBands.map(toBand), parsed.fields];

    const validation = validateBands(candidateBands);
    if (!validation.ok) return fail(validation.error);

    const id = await generateNewId(SHEET, "KH");
    await insert(SHEET, { id, ...parsed.fields });
    revalidatePath(PATH);
    return ok({ id });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// 2026-08-23, section 2 (mislabeled "section 3" in the plan's own intro --
// the claim is stated here, in section 2). Hard delete, not soft:
// assets.term_months is frozen at creation (section 9.1) and carries no
// reference back to the band that produced it -- checked directly, no
// foreign key exists from assets to this table -- so nothing depends on
// this row continuing to exist. Refused via validateBands run against the
// RESULTING set (existing bands minus this one); combined with
// validateBands' own 2026-08-23 coverage requirement, this also refuses
// deleting the band that would leave the lowest or highest price
// uncovered, not only a gap in the middle.
export async function deleteAssetBand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    const existingBands = await findAll(SHEET) as DBAssetDepreciationBand[];
    const remainingBands: Band[] = existingBands.filter(b => b.id !== id).map(toBand);

    const validation = validateBands(remainingBands);
    if (!validation.ok) return fail(`Không thể xoá: ${validation.error}`);

    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
