"use server";

import { revalidatePath } from "next/cache";

export async function triggerBackup(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const url = `${process.env.SUPABASE_URL}/functions/v1/backup-to-sheets`;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { success: false, error: "Thiếu cấu hình Supabase URL hoặc Anon Key" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({})
    });

    if (res.ok) {
      const data = await res.json();
      revalidatePath("/admin/backup");
      return { success: true, message: data.message || "Sao lưu và đồng bộ thành công!" };
    } else {
      const errText = await res.text();
      return { success: false, error: `Lỗi từ Edge Function: ${errText || res.statusText}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}
