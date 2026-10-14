"use server";

import { findAll, findById, update } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";
import { ok, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { updateAudit } from "@/lib/finance/audit-columns";
import type { DBDashboardSettings, DBProduct, DBProductType } from "@/types/db";

const SHEET = "Dashboard_Settings";
const ROW_ID = "1"; // single settings row, id = 1
const PATH = "/admin/dashboard-settings";

export async function getDashboardSettings(): Promise<DBDashboardSettings | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findById(SHEET, ROW_ID)) as DBDashboardSettings | null;
}

// A failed field comes back as { error, field } so the form can show the
// message under that box; error alone is a message for the whole form.
function fieldError(field: string, error: string): ActionResponse {
  return { error, field };
}

function wholeNumber(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

export async function saveDashboardSettings(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const stale = wholeNumber(formData.get("stale_stocktake_days"), 1, 365);
  if (stale === null) return fieldError("stale_stocktake_days", "Nhập số từ 1 đến 365");
  const open = wholeNumber(formData.get("open_stocktake_days"), 1, 365);
  if (open === null) return fieldError("open_stocktake_days", "Nhập số từ 1 đến 365");
  const startDay = wholeNumber(formData.get("reminder_start_day"), 1, 28);
  if (startDay === null) return fieldError("reminder_start_day", "Nhập số từ 1 đến 28");

  const foodIds = [...new Set(formData.getAll("food_product_ids").map((v) => String(v).trim()).filter(Boolean))];
  const toppingRaw = ((formData.get("topping_type_id") as string) || "").trim();

  try {
    if (foodIds.length > 0) {
      const products = (await findAll("Products")) as DBProduct[];
      const known = new Set(products.map((p) => p.id));
      if (foodIds.some((id) => !known.has(id))) return fieldError("food_product_ids", "Món không còn tồn tại");
    }
    if (toppingRaw) {
      const types = (await findAll("Product_Types")) as DBProductType[];
      if (!types.some((t) => t.id === toppingRaw)) return fieldError("topping_type_id", "Loại món không còn tồn tại");
    }

    await update(SHEET, ROW_ID, {
      stale_stocktake_days: stale,
      open_stocktake_days: open,
      reminder_start_day: startDay,
      food_product_ids: foodIds,
      topping_type_id: toppingRaw || null,
      ...updateAudit(auth.actor),
    });
    revalidatePath(PATH);
    revalidatePath("/admin");
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
