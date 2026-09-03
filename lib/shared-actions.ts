import { insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { describeActionError } from "@/lib/action-error";

export interface ActionResponse {
  success?: boolean;
  error?: string;
  // Set only when error is the generic fallback sentence -- the raw
  // exception text an engineer needs, never shown to the owner by default.
  errorDetail?: string;
  [key: string]: unknown;
}

export function ok(extra?: Record<string, unknown>): ActionResponse {
  return { success: true, ...extra };
}

export function fail(error: string): ActionResponse {
  return { error };
}

export async function createEntity(
  sheetName: string,
  idPrefix: string,
  fields: Record<string, unknown>,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    const id = await generateNewId(sheetName, idPrefix);
    const created_at = new Date().toISOString();
    await insert(sheetName, { id, ...fields, created_at });
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function updateEntity(
  sheetName: string,
  id: string,
  fields: Record<string, unknown>,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    await update(sheetName, id, fields);
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function deleteEntity(
  sheetName: string,
  id: string,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    await remove(sheetName, id);
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function softDeleteEntity(
  sheetName: string,
  id: string,
  revalidatePathStr: string
): Promise<ActionResponse> {
  try {
    await update(sheetName, id, { status: "DELETED" });
    revalidatePath(revalidatePathStr);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
