'use server';

import { getSheetData, sheets, SPREADSHEET_ID } from "@/lib/sheets";
import { hashPasswordSHA256 } from "@/lib/crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function changePasswordAction(oldPassword: string, newPassword: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Bạn chưa đăng nhập" };
    }

    const username = (session.user as any).username;
    
    // Đọc users sheet
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `users!A1:Z`,
    });
    
    const rows = res.data.values;
    if (!rows) return { success: false, error: "Lỗi dữ liệu hệ thống" };
    
    const usernameIndex = rows[0].indexOf('username');
    const passwordHashIndex = rows[0].indexOf('password_hash');
    
    if (usernameIndex === -1 || passwordHashIndex === -1) {
      return { success: false, error: "Lỗi cấu trúc dữ liệu" };
    }
    
    let targetRowIndex = -1;
    let currentHash = "";
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][usernameIndex] === username) {
        targetRowIndex = i + 1; // 1-based for Sheets API
        currentHash = rows[i][passwordHashIndex];
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return { success: false, error: "Không tìm thấy tài khoản" };
    }

    // Xác thực mật khẩu cũ
    const oldHashInput = hashPasswordSHA256(oldPassword);
    if (oldHashInput !== currentHash) {
      return { success: false, error: "Mật khẩu cũ không chính xác" };
    }

    // Cập nhật mật khẩu mới
    const newHash = hashPasswordSHA256(newPassword);
    const columnLetter = String.fromCharCode(65 + passwordHashIndex);
    const range = `users!${columnLetter}${targetRowIndex}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newHash]]
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, error: "Lỗi hệ thống" };
  }
}
