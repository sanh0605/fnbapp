"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

const PASSWORD_SALT_ROUNDS = 10;

export async function changePasswordAction(oldPassword: string, newPassword: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: "Bạn chưa đăng nhập" };
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return { success: false, error: "Không tìm thấy tài khoản" };
    }

    const supabase = getSupabaseClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, password_hash")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("Change password user lookup error:", userError);
      return { success: false, error: "Lỗi hệ thống" };
    }

    if (!user) {
      return { success: false, error: "Không tìm thấy tài khoản" };
    }

    const passwordMatches = await bcrypt.compare(oldPassword, user.password_hash);
    if (!passwordMatches) {
      return { success: false, error: "Mật khẩu cũ không chính xác" };
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", userId);

    if (updateError) {
      console.error("Change password update error:", updateError);
      return { success: false, error: "Lỗi hệ thống" };
    }

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, error: "Lỗi hệ thống" };
  }
}
