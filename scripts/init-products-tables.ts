import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function getAuth() {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64 || '', 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function run() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const newTabs = [
    { title: 'Product_Categories', headers: ['id', 'name', 'status', 'created_at'] },
    { title: 'Products', headers: ['id', 'category_id', 'name', 'image_url', 'status', 'created_at'] },
    { title: 'Product_Variants', headers: ['id', 'product_id', 'size_name', 'price', 'status', 'created_at'] }
  ];

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID as string });
    const existingSheets = meta.data.sheets?.map(s => s.properties?.title?.toLowerCase()) || [];

    const requests = [];

    // Add new tabs
    for (const tab of newTabs) {
      if (!existingSheets.includes(tab.title.toLowerCase())) {
        requests.push({
          addSheet: {
            properties: { title: tab.title }
          }
        });
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID as string,
        requestBody: { requests }
      });
      console.log('Tạo tab thành công.');
    } else {
      console.log('Các tab đã tồn tại.');
    }

    // Write headers
    for (const tab of newTabs) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID as string,
        range: `${tab.title}!A1:Z1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [tab.headers]
        }
      });
      console.log(`Đã cập nhật headers cho ${tab.title}`);
    }

    console.log('Hoàn thành cập nhật DB cho Products!');
  } catch (err: any) {
    console.error('Lỗi:', err.message);
  }
}

run().catch(console.error);
