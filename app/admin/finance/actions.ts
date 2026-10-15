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
import { getCashTransfers } from "./transfers/actions";
import { readCashBookDaily } from "@/lib/finance/cash-book-daily";
import { buildCashBookRows, type CashBookRow } from "@/lib/finance/cash-book-rows";
import { summariseCashBook, type CashBookSummary } from "@/lib/finance/cash-flow";
import type { DBCashEntry, DBCashCategory, DBBankAccount, DBMonthlyExpenseItem } from "@/types/db";

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

// R6: a group or account must exist and be ACTIVE, unless the row already uses it
// (so an old row stays editable after its group or account was stopped).
async function checkRefs(
  f: { category_id: string; bank_account_id: string | null },
  existing: DBCashEntry | null,
): Promise<string | null> {
  const category = (await findById("Cash_Categories", f.category_id)) as DBCashCategory | null;
  if (!category || (category.status !== "ACTIVE" && category.id !== existing?.category_id)) {
    return "Nhóm thu chi không còn dùng";
  }
  if (f.bank_account_id) {
    const account = (await findById("Bank_Accounts", f.bank_account_id)) as DBBankAccount | null;
    if (!account || (account.status !== "ACTIVE" && account.id !== existing?.bank_account_id)) {
      return "Tài khoản không còn dùng";
    }
  }
  return null;
}

// Empty -> null. A set item must be ACTIVE (unless the row already carried it)
// and belong to the entry's own category, or the reminder it settles is wrong.
async function checkMonthlyItem(
  formData: FormData,
  categoryId: string,
  alreadyLinked: string | null,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const id = ((formData.get("monthly_item_id") as string) || "").trim();
  if (!id) return { ok: true, id: null };
  const item = (await findById("Monthly_Expense_Items", id)) as DBMonthlyExpenseItem | null;
  if (!item || (item.status !== "ACTIVE" && id !== alreadyLinked)) {
    return { ok: false, error: "Khoản chi hằng tháng không còn dùng" };
  }
  if (item.cash_category_id !== categoryId) {
    return { ok: false, error: "Khoản chi hằng tháng thuộc nhóm khác" };
  }
  return { ok: true, id };
}

// entry_date is a Postgres `date` column, no time and no zone, so the filter
// compares the "YYYY-MM-DD" strings directly -- unlike lib/shared/report-time.ts,
// which converts a timestamptz between UTC and Asia/Saigon.
// Everything up to and including `end`: the opening balance of a range needs
// every hand row before it, not only those inside it.
async function getCashEntriesThrough(end: string): Promise<DBCashEntry[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return await findAllWhere<DBCashEntry>(SHEET, { lte: { entry_date: end } });
}

export async function getFinancePageData(start: string, end: string): Promise<{
  rows: CashBookRow[]; // only start..end, all statuses
  summary: CashBookSummary;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [allEntries, transfers, dayRows, categories, accounts] = await Promise.all([
    getCashEntriesThrough(end),
    getCashTransfers(end),
    readCashBookDaily(end),
    getCashCategories(),
    getBankAccounts(),
  ]);

  const summary = summariseCashBook({ dayRows, entries: allEntries, transfers, categories, start, end });

  // "YYYY-MM-DD" strings compare in calendar order.
  const inRange = (day: string) => day >= start && day <= end;
  const rows = buildCashBookRows({
    dayRows: dayRows.filter((d) => inRange(d.day)),
    entries: allEntries.filter((e) => inRange(e.entry_date)),
    transfers: transfers.filter((t) => inRange(t.transfer_date)),
    categories,
    accounts,
  });
  return { rows, summary, categories, accounts };
}

export async function addCashEntry(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const r = parseCashEntry(readCashEntryInput(formData));
  if (r.ok === false) return fail(r.error);

  try {
    const refError = await checkRefs(r.value, null);
    if (refError) return fail(refError);
    const monthly = await checkMonthlyItem(formData, r.value.category_id, null);
    if (monthly.ok === false) return fail(monthly.error);

    const id = await generateNewId(SHEET, "CE");
    await insert(SHEET, {
      id, ...r.value, monthly_item_id: monthly.id, status: "ACTIVE", ...creationAudit(auth.actor),
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

    const refError = await checkRefs(r.value, existing);
    if (refError) return fail(refError);
    const monthly = await checkMonthlyItem(formData, r.value.category_id, existing.monthly_item_id ?? null);
    if (monthly.ok === false) return fail(monthly.error);

    await update(SHEET, id, { ...r.value, monthly_item_id: monthly.id, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// The ordinary way to undo a cash-book line: it stays visible, marked
// cancelled, and drops out of the cash-book totals. No hard delete.
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
