import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { google } from 'googleapis';
import { findAll, remove } from '../lib/sheets_db';

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
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log("Xoá Purchase_Orders PO-001...");
    try {
      await remove("Purchase_Orders", "PO-001");
      console.log("Đã xoá PO-001.");
    } catch(e:any) {
      console.log("Không tìm thấy PO-001 hoặc đã xoá:", e.message);
    }

    console.log("Đang tìm các dòng Stock_Ledger liên quan đến PO-001...");
    const ledgers = await findAll("Stock_Ledger");
    const toDelete = ledgers.filter((l:any) => l.reference_id === "PO-001");
    
    if (toDelete.length === 0) {
      console.log("Không có dòng Stock_Ledger nào cần xoá.");
      return;
    }

    // Get sheet ID
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID as string });
    const sheet = meta.data.sheets?.find(s => s.properties?.title === "Stock_Ledger");
    const sheetId = sheet?.properties?.sheetId;

    // We must find row indices.
    // Fetch raw rows to match IDs
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID as string,
      range: `Stock_Ledger!A1:Z`,
    });
    
    const rows = res.data.values || [];
    const headers = rows[0] || [];
    const idIndex = headers.indexOf('id');
    const refIndex = headers.indexOf('reference_id');

    let rowIndicesToDelete: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][refIndex] === "PO-001") {
        rowIndicesToDelete.push(i);
      }
    }

    // Sort descending so deleting rows doesn't shift indices of remaining rows to delete
    rowIndicesToDelete.sort((a, b) => b - a);

    console.log(`Tìm thấy ${rowIndicesToDelete.length} dòng cần xoá trong Stock_Ledger.`);

    const requests = rowIndicesToDelete.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1
        }
      }
    }));

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID as string,
        requestBody: {
          requests
        }
      });
      console.log("Đã xoá thành công toàn bộ Stock_Ledger của PO-001.");
    }

  } catch (err: any) {
    console.error('Lỗi:', err.message);
  }
}

run().catch(console.error);
