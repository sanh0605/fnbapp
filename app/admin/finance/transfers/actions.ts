"use server";

import { findAll, findAllWhere, findById, insert, update, remove, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { creationAudit, updateAudit } from "@/lib/finance/audit-columns";
import { parseCashTransfer, type CashTransferInput } from "@/lib/finance/cash-transfer-rules";
import type { DBBankAccount, DBCashTransfer } from "@/types/db";

const SHEET = "Cash_Transfers";
const PATH = "/admin/finance";

function readCashTransferInput(formData: FormData): CashTransferInput {
  return {
    transfer_date: (formData.get("transfer_date") as string) || "",
    amount: (formData.get("amount") as string) || "",
    from: (formData.get("from") as string) || "",
    to: (formData.get("to") as string) || "",
    note: (formData.get("note") as string) || "",
  };
}

async function activeAccountIds(): Promise<string[]> {
  const accounts = (await findAll("Bank_Accounts")) as DBBankAccount[];
  return accounts.filter((a) => a.status === "ACTIVE").map((a) => a.id);
}

export async function getCashTransfer(id: string): Promise<DBCashTransfer | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return (await findById(SHEET, id)) as DBCashTransfer | null;
}

// Everything up to and including throughDay: the opening balance needs every
// transfer before the range, not only those inside it. transfer_date is a
// Postgres `date`, so the "YYYY-MM-DD" strings compare directly.
export async function getCashTransfers(throughDay: string): Promise<DBCashTransfer[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  return await findAllWhere<DBCashTransfer>(SHEET, { lte: { transfer_date: throughDay } });
}

export async function addCashTransfer(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const r = parseCashTransfer(readCashTransferInput(formData), await activeAccountIds());
    if (r.ok === false) return fail(r.error);

    const id = await generateNewId(SHEET, "CT");
    await insert(SHEET, {
      id, ...r.value, status: "ACTIVE", ...creationAudit(auth.actor),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

export async function updateCashTransfer(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã dòng chuyển tiền");

  try {
    const existing = (await findById(SHEET, id)) as DBCashTransfer | null;
    if (!existing) return fail("Không tìm thấy dòng chuyển tiền");
    if (existing.status === "CANCELLED") return fail("Dòng đã huỷ, không sửa được");

    const r = parseCashTransfer(readCashTransferInput(formData), await activeAccountIds());
    if (r.ok === false) return fail(r.error);

    await update(SHEET, id, { ...r.value, ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/transfers/${id}`);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// The ordinary way to undo a transfer: it stays visible, marked cancelled,
// and counts in no balance. No hard delete.
export async function cancelCashTransfer(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã dòng chuyển tiền");

  try {
    const existing = (await findById(SHEET, id)) as DBCashTransfer | null;
    if (!existing) return fail("Không tìm thấy dòng chuyển tiền");
    if (existing.status === "CANCELLED") return fail("Dòng đã huỷ rồi");

    await update(SHEET, id, { status: "CANCELLED", ...updateAudit(auth.actor) });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/transfers/${id}`);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- permanent deletion is ADMIN only, checked on the server.
export async function deleteCashTransfer(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã dòng chuyển tiền");

  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return describeActionError(error);
  }
}
