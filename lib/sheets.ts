import { google } from 'googleapis';
import path from 'path';

// Spreadsheet ID của bạn
export const SPREADSHEET_ID = '1RF-B2DLjLxuJ9VWtqJhiQLb5qlcUFVoehl7RxOP6xNc';

// Khởi tạo Google Auth
// Lưu ý: Trong môi trường production, bạn có thể lưu file json vào biến môi trường (base64) 
// hoặc một nơi an toàn. Ở đây ta đang dùng trực tiếp file json ở thư mục gốc.
const KEY_FILE_PATH = path.join(process.cwd(), 'beverages-496303-1b8b558284f8.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const sheets = google.sheets({ version: 'v4', auth });

/**
 * Đọc tất cả các dòng từ một sheet (Bỏ qua dòng Header)
 */
export async function getSheetData(sheetName: string): Promise<any[]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z`,
    });
    
    const rows = res.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map((row) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        let value = row[index];
        // Parse JSON strings back to objects if they look like JSON arrays or objects
        if (value && typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try { value = JSON.parse(value); } catch(e) {}
        }
        obj[header] = value;
      });
      return obj;
    });
  } catch (error) {
    console.error(`Error reading sheet ${sheetName}:`, error);
    return [];
  }
}

/**
 * Thêm một dòng mới vào sheet
 */
export async function appendRow(sheetName: string, rowData: any[]) {
  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });
    return res.data;
  } catch (error) {
    console.error(`Error appending to sheet ${sheetName}:`, error);
    throw error;
  }
}

/**
 * Cập nhật nhiều dữ liệu cùng lúc (Batch Update) - Dùng cho Sync Engine Queue
 */
export async function batchUpdateData(requests: any[]) {
   try {
       const res = await sheets.spreadsheets.batchUpdate({
           spreadsheetId: SPREADSHEET_ID,
           requestBody: {
               requests
           }
       });
       return res.data;
   } catch(error) {
       console.error("Batch update error:", error);
       throw error;
   }
}
