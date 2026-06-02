const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// --- Cấu hình ---
const SUPABASE_URL = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = 'sb_publishable_rhbewMyE6ws9G3_DSmEbfg_w0omMwFI';
const SPREADSHEET_ID = '1RF-B2DLjLxuJ9VWtqJhiQLb5qlcUFVoehl7RxOP6xNc';
const KEY_FILE_PATH = path.join(__dirname, '../beverages-496303-1b8b558284f8.json');

// Danh sách các bảng cần migrate theo thứ tự
const TABLES = [
  'brands', 'outlets', 'users', 'settings', 
  'raw_materials', 'semi_products', 'supplies', 
  'products', 'product_recipes', 'orders', 'order_counters'
];

async function main() {
  console.log('Khởi tạo kết nối Supabase và Google Sheets...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Lấy thông tin các sheet hiện tại
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
  
  // 2. Tạo các sheet chưa có
  const sheetsToCreate = TABLES.filter(t => !existingSheets.includes(t));
  if (sheetsToCreate.length > 0) {
    console.log(`Đang tạo các sheet mới: ${sheetsToCreate.join(', ')}`);
    const requests = sheetsToCreate.map(title => ({
      addSheet: { properties: { title } }
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests }
    });
  }

  // 3. Migrate từng bảng
  for (const table of TABLES) {
    console.log(`Đang xử lý bảng: ${table}...`);
    
    // Thử lấy data từ Supabase có sắp xếp
    let { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true, nullsFirst: true });
    
    // Thử lại nếu lỗi (có thể do bảng không có created_at)
    if (error) {
       const res = await supabase.from(table).select('*');
       if (res.error) {
           console.log(`  -> Bỏ qua bảng ${table} (Không tìm thấy hoặc lỗi: ${res.error.message})`);
           continue;
       }
       data = res.data;
    }
    
    let rows = data;

    if (!rows || rows.length === 0) {
      console.log(`  -> Bảng ${table} trống.`);
      continue;
    }

    // Lấy Headers
    const headers = Object.keys(rows[0]);
    
    // Lấy Values
    const values = rows.map(row => {
      return headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return val.toString();
      });
    });

    // Gộp Header và Values
    const sheetData = [headers, ...values];

    // Cập nhật lên Google Sheet (Xóa dữ liệu cũ và ghi mới)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${table}!A1:Z`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${table}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sheetData
      }
    });

    console.log(`  -> Migrate thành công ${rows.length} dòng vào sheet ${table}.`);
  }

  console.log('🎉 Hoàn tất quá trình migration!');
}

main().catch(console.error);
