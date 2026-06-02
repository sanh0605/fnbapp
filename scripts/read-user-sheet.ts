import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { google } from 'googleapis';
import * as fs from 'fs';

const TARGET_SPREADSHEET_ID = '1CcVC_XqvAP1rsgl-jUeCrZTkKCGFNMSEyJ4UXY-jVZs';

function getAuth() {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64 || '', 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

async function run() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const tabsToFetch = ['ĐƠN NHẬP HÀNG', 'CHI TIẾT NHẬP HÀNG'];
    const result: any = {};

    for (const tab of tabsToFetch) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: TARGET_SPREADSHEET_ID,
        range: `${tab}!A1:Z500`, // Fetch up to 500 rows
      });
      result[tab] = response.data.values;
    }

    const currentData = JSON.parse(fs.readFileSync('C:\\Users\\Admin\\Desktop\\fnbapp\\user_data_sample.json', 'utf8'));
    Object.assign(currentData, result);
    fs.writeFileSync('C:\\Users\\Admin\\Desktop\\fnbapp\\user_data_sample.json', JSON.stringify(currentData, null, 2));
    
    console.log(`Đã gộp thêm dữ liệu Đơn nhập hàng vào user_data_sample.json`);
  } catch (err: any) {
    console.error('Lỗi truy cập:', err.message);
  }
}

run().catch(console.error);
