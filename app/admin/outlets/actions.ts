"use server";

import { findAll } from "@/lib/sheets_db";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Outlets";

// docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 5: the
// till modal picks an outlet, not a brand. Read-only for now -- creating and
// retiring outlets (code assigned from max(code)+1, never reused) is not
// part of this slice; the two seeded by supabase/migrations/0071_outlets.sql
// are all that exist.
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
