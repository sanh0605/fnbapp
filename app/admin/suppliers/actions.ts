"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, deleteEntity, type ActionResponse } from "@/lib/shared-actions";
import type { DBSupplier } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Suppliers";
const PATH = "/admin/suppliers";
const SUPPLIER_LIMITS = {
  name: 120,
  phone: 32,
  taxId: 64,
  address: 500,
  links: 2_000,
} as const;

function readSupplierText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validateSupplierFields(fields: {
  name: string;
  phone: string;
  taxId: string;
  address: string;
  links: string;
}): string | null {
  if (!fields.name) return "Tên nhà cung cấp không được để trống";
  if (fields.name.length > SUPPLIER_LIMITS.name) return "Tên nhà cung cấp không được vượt quá 120 ký tự";
  if (fields.phone.length > SUPPLIER_LIMITS.phone) return "Số điện thoại không được vượt quá 32 ký tự";
  if (fields.taxId.length > SUPPLIER_LIMITS.taxId) return "Mã số thuế không được vượt quá 64 ký tự";
  if (fields.address.length > SUPPLIER_LIMITS.address) return "Địa chỉ không được vượt quá 500 ký tự";
  if (fields.links.length > SUPPLIER_LIMITS.links) return "Ghi chú / liên kết không được vượt quá 2.000 ký tự";
  return null;
}

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

  const name = readSupplierText(formData, "name");
  const phone = readSupplierText(formData, "phone");
  const tax_id = readSupplierText(formData, "tax_id");
  const address = readSupplierText(formData, "address");
  const links = readSupplierText(formData, "links");
  const validationError = validateSupplierFields({ name, phone, taxId: tax_id, address, links });
  if (validationError) return fail(validationError);

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

  const id = readSupplierText(formData, "id");
  const name = readSupplierText(formData, "name");
  const phone = readSupplierText(formData, "phone");
  const tax_id = readSupplierText(formData, "tax_id");
  const address = readSupplierText(formData, "address");
  const links = readSupplierText(formData, "links");

  if (!id) return fail("ID không hợp lệ");
  const validationError = validateSupplierFields({ name, phone, taxId: tax_id, address, links });
  if (validationError) return fail(validationError);

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
