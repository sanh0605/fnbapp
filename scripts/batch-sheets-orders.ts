// @ts-nocheck — legacy utility using getSheetsClient bypass. Supabase migration Phase F will rewrite or delete.
import { getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function mapObjectToRow(obj: any, headers: string[]): string[] {
  return headers.map((header) => {
    const val = obj[header];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

export async function batchUpdateOrders(updates: any[]) {
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Z`,
  });
  
  const rows = res.data.values || [];
  if (rows.length < 1) throw new Error(`Sheet Orders is empty`);
  
  const headers = rows[0];
  const idIndex = headers.indexOf('id');

  const rowMap = new Map<string, number>();
  const dataMap = new Map<string, any>();
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][idIndex];
    rowMap.set(id, i + 1);
    
    const obj: any = {};
    headers.forEach((h, idx) => { obj[h] = rows[i][idx] || ''; });
    dataMap.set(id, obj);
  }

  const data: any[] = [];
  for (const u of updates) {
    const rowNumber = rowMap.get(u.id);
    const existing = dataMap.get(u.id);
    if (!rowNumber || !existing) continue;

    const updatedObj = { ...existing, ...u.data, id: u.id };
    const updatedRow = mapObjectToRow(updatedObj, headers);

    data.push({
      range: `Orders!A${rowNumber}`,
      values: [updatedRow]
    });
  }

  const chunkSize = 50;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    console.log(`[batchUpdateOrders] Writing chunk ${i / chunkSize + 1}...`);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: chunk
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
