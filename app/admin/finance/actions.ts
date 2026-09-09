"use server";

import { findAllWhere, findById, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { creationAudit, updateAudit } from "@/lib/finance/audit-columns";
import { parseCashEntry, type CashEntryInput } from "@/lib/finance/cash-entry-rules";
import { getCashCategories } from "./categories/actions";
import { getBankAccounts } from "./bank-accounts/actions";
import type { DBCashEntry, DBCashCategory, DBBankAccount } from "@/types/db";

const SHEET = "Cash_Entries";
const PATH = "/admin/finance";

function readCashEntryInput(formData: FormData): CashEntryInput {
  return {
    entry_date: (formData.get("entry_date") as string) || "",
    category_id: (formData.get("category_id") as string) || "",
    amount: (formData.get("amount") as string) || "",
    payment_method: (formData.get("payment_method") as string) || "",
    bank_account_id: (formData.get("bank_account_id") as string) || "",
    note: (formData.get("note") as string) || "",
  };
}

// entry_date is a Postgres `date` column, no time and no zone, so the filter
// compares the "YYYY-MM-DD" strings directly -- unlike lib/shared/report-time.ts,
// which converts a timestamptz between UTC and Asia/Saigon.
export async function getCashEntries(start: string, end: string): Promise<DBCashEntry[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return await findAllWhere<DBCashEntry>(SHEET, {
    gte: { entry_date: start },
    lte: { entry_date: end },
  });
}

export async function getFinancePageData(start: string, end: string): Promise<{
  entries: DBCashEntry[];
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
}> {
  const [entries, categories, accounts] = await Promise.all([
    getCashEntries(start, end),
    getCashCategories(),
    getBankAccounts(),
  ]);
  return { entries, categories, accounts };
}

export async function addCashEntry(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const r = parseCashEntry(readCashEntryInput(formData));
  if (r.ok === false) return fail(r.error);

  try {
    const id = await generateNewId(SHEET, "CE");
    await insert(SHEET, {
      id, ...r.value, status: "ACTIVE", ...creationAudit(auth.actor),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function updateCashEntry(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã dòng sổ");

  try {
    const existing = (await findById(SHEET, id)) as DBCashEntry | null;
    if (!existing) return fail("Không tìm thấy dòng sổ");
    if (existing.status === "CANCELLED") return fail("Dòng đã huỷ, không sửa được");

    const r = parseCashEntry(readCashEntryInput(formData));
    if (r.ok === false) return fail(r.error);

    await update(SHEET, id, { ...r.value, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// The ordinary way to undo a cash-book line: it stays visible, marked
// cancelled, and drops out of summariseEntries' totals. No hard delete.
export async function cancelCashEntry(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã dòng sổ");

  try {
    const existing = (await findById(SHEET, id)) as DBCashEntry | null;
    if (!existing) return fail("Không tìm thấy dòng sổ");
    if (existing.status === "CANCELLED") return fail("Dòng đã huỷ rồi");

    await update(SHEET, id, { status: "CANCELLED", ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server.
export async function deleteCashEntry(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã dòng sổ");

  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
