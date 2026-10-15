"use server";

import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";

export async function clearProductCache(): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  for (const tag of ["sheets-Product_Variants", "sheets-Products", "sheets-Product_Price_History"]) {
    revalidateTag(tag, { expire: 0 });
  }
}
