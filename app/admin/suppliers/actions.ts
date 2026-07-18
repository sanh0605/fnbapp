"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, deleteEntity, type ActionResponse } from "@/lib/shared-actions";
import type { DBSupplier } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Suppliers";
const PATH = "/admin/suppliers";

export async function getSuppliers(): Promise<DBSupplier[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    return await findAll(SHEET) as DBSupplier[];
  } catch (error) {
    console.error("Loi getSuppliers:", error);
    return [];
  }
}

export async function addSupplier(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (id) {
    return editSupplier(formData);
  }
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || "";
  const tax_id = (formData.get("tax_id") as string) || "";
  const address = (formData.get("address") as string) || "";
  const links = (formData.get("links") as string) || "";

  if (!name) return fail("Tên nhà cung cấp không được để trống");

  try {
    const suppliers = await findAll(SHEET);
    const existing = suppliers.find(
      (s: DBSupplier) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return fail("Da ton tai nha cung cap voi ten nay");

    const id = await generateNewId(SHEET, "NCC");
    const created_at = new Date().toISOString();
    await insert(SHEET, { id, name, phone, tax_id, address, links, parent_id: "", status: "ACTIVE", created_at });
    revalidatePath(PATH);
    return ok({ id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function editSupplier(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || "";
  const tax_id = (formData.get("tax_id") as string) || "";
  const address = (formData.get("address") as string) || "";
  const links = (formData.get("links") as string) || "";

  if (!id || !name) return fail("Du lieu khong hop le");

  try {
    const suppliers = await findAll(SHEET);
    const existing = suppliers.find(
      (s: DBSupplier) => s.name.toLowerCase() === name.toLowerCase() && s.id !== id
    );
    if (existing) return fail("Da ton tai nha cung cap khac voi ten nay");

    await update(SHEET, id, { name, phone, tax_id, address, links });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteSupplierAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID khong hop le");
  return deleteEntity(SHEET, id, PATH);
}
