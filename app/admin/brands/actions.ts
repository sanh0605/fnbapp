"use server";

import { findAll } from "@/lib/sheets_db";
import { createEntity, updateEntity, deleteEntity, type ActionResponse } from "@/lib/shared-actions";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Brands";
const PATH = "/admin/brands";

export async function getBrands() {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    return await findAll(SHEET);
  } catch (error) {
    console.error("Loi getBrands:", error);
    return [];
  }
}

export async function addBrand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const start_date = formData.get("start_date") as string;

  if (!name) return { error: "Ten thuong hieu khong duoc de trong" };

  return createEntity(SHEET, "BR", { name, code: code?.toUpperCase(), start_date }, PATH);
}

export async function editBrand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const start_date = formData.get("start_date") as string;

  if (!id || !name) return { error: "ID va Ten khong hop le" };

  return updateEntity(SHEET, id, { name, code: code?.toUpperCase(), start_date }, PATH);
}

export async function deleteBrand(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const id = formData.get("id") as string;
  if (!id) return { error: "ID khong hop le" };

  return deleteEntity(SHEET, id, PATH);
}
