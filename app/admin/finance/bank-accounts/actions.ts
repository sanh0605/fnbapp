"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { creationAudit, updateAudit } from "@/lib/finance/audit-columns";
import { findDuplicateActiveName, duplicateNameErrorMessage } from "@/lib/shared/duplicate-name-guard";
import type { DBBankAccount } from "@/types/db";

const SHEET = "bank_accounts";
const PATH = "/admin/finance/bank-accounts";

export async function getBankAccounts(): Promise<DBBankAccount[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findAll(SHEET)) as DBBankAccount[];
}

export async function addBankAccount(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return fail("Nhập tên tài khoản");
  const bank_name = ((formData.get("bank_name") as string) || "").trim() || null;
  const account_number = ((formData.get("account_number") as string) || "").trim() || null;

  try {
    // Ruling 4 -- same shared guard as app/admin/finance/categories/actions.ts,
    // backed by migration 0101's partial unique index on bank_accounts, which
    // uses the identical normalising expression (migration 0065's), so the
    // app refuses in Vietnamese before Postgres's ASCII-English violation
    // ever reaches describeActionError.
    const accounts = (await findAll(SHEET)) as DBBankAccount[];
    const conflict = findDuplicateActiveName(accounts, name);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    const id = await generateNewId(SHEET, "BA");
    await insert(SHEET, {
      id, name, bank_name, account_number, status: "ACTIVE", ...creationAudit(auth.actor),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function updateBankAccount(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  const name = ((formData.get("name") as string) || "").trim();
  if (!id) return fail("Thiếu mã tài khoản");
  if (!name) return fail("Nhập tên tài khoản");
  const bank_name = ((formData.get("bank_name") as string) || "").trim() || null;
  const account_number = ((formData.get("account_number") as string) || "").trim() || null;

  try {
    const accounts = (await findAll(SHEET)) as DBBankAccount[];
    const conflict = findDuplicateActiveName(accounts, name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    await update(SHEET, id, { name, bank_name, account_number, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// The ordinary way to get rid of an account: it stops appearing in the
// picker, and every entry already pointing at it keeps its name.
export async function setBankAccountStatus(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã tài khoản");
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  try {
    await update(SHEET, id, { status, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server.
// The foreign key is RESTRICT, so an account any entry points at is refused
// by the database no matter who asks.
export async function deleteBankAccount(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã tài khoản");

  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
