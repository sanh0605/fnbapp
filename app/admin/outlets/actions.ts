"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { nextOutletCode } from "@/lib/outlet-code";
import { toSaigonIsoString } from "@/lib/datetime";
import type { DBOutlet } from "@/types/db";

const SHEET = "Outlets";
const PATH = "/admin/outlets";

// docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 5: the
// till modal picks an outlet, not a brand. The two seeded by
// supabase/migrations/0071_outlets.sql are all that exist until the screen
// below is used to add a third.
export async function getOutlets() {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    return await findAll(SHEET);
  } catch (error) {
    console.error("Loi getOutlets:", error);
    return [];
  }
}

// docs/superpowers/plans/2026-08-25-outlet-screen-and-nav-guard.md section 2:
// the code is assigned by the system, never chosen, never a freed gap.
export async function addOutlet(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = ((formData.get("name") as string) || "").trim();
  const brand_id = ((formData.get("brand_id") as string) || "").trim();
  const address = ((formData.get("address") as string) || "").trim();
  const start_date = ((formData.get("start_date") as string) || "").trim();

  if (!name) return fail("Tên điểm bán không được để trống");
  if (!brand_id) return fail("Vui lòng chọn thương hiệu");

  try {
    const outlets = (await findAll(SHEET)) as DBOutlet[];
    const code = nextOutletCode(outlets.map(o => o.code));
    const id = await generateNewId(SHEET, "OUT");
    await insert(SHEET, {
      id,
      code,
      name,
      brand_id,
      address,
      status: "ACTIVE",
      start_date: start_date || null,
      created_at: new Date().toISOString(),
    });
    revalidatePath(PATH);
    return ok({ code });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

// The code is frozen; only the name is editable here (plan section 2).
export async function renameOutlet(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  const name = ((formData.get("name") as string) || "").trim();
  if (!id) return fail("ID không hợp lệ");
  if (!name) return fail("Tên điểm bán không được để trống");

  try {
    await update(SHEET, id, { name });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

// Never deletes, never frees the code -- sets status/end_date only (plan
// section 2, and CLAUDE.md section 2's rule on master data generally).
// Refuses the last active outlet: there would be nothing left to open the
// till with.
export async function retireOutlet(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("ID không hợp lệ");

  try {
    const outlets = (await findAll(SHEET)) as DBOutlet[];
    const target = outlets.find(o => o.id === id);
    if (!target) return fail("Không tìm thấy điểm bán");
    if (target.status !== "ACTIVE") return fail("Điểm bán này đã ngừng hoạt động");

    const activeCount = outlets.filter(o => o.status === "ACTIVE").length;
    if (activeCount <= 1) {
      return fail(
        "Không thể ngừng hoạt động điểm bán cuối cùng đang hoạt động -- sẽ không còn điểm bán nào để mở máy POS",
      );
    }

    const end_date = toSaigonIsoString(new Date()).split("T")[0];
    await update(SHEET, id, { status: "INACTIVE", end_date });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
