import { getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

/**
 * Custom mapObjectToRow to avoid Next.js imports
 */
function mapObjectToRow(obj: any, headers: string[]): string[] {
  return headers.map((header) => {
    const val = obj[header];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

export async function batchUpdateOrderLines(updates: any[]) {
  const sheets = getSheetsClient();
  
  // 1. Get all headers and data in one go
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:Z`,
  });
  
  const rows = res.data.values || [];
  if (rows.length < 1) throw new Error(`Sheet Order_Lines is empty`);
  
  const headers = rows[0];
  const idIndex = headers.indexOf('id');

  // 2. Map of ID to row number
  const rowMap = new Map<string, number>();
  const dataMap = new Map<string, any>();
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][idIndex];
    rowMap.set(id, i + 1);
    
    const obj: any = {};
    headers.forEach((h, idx) => { obj[h] = rows[i][idx] || ''; });
    dataMap.set(id, obj);
  }

  // 3. Prepare Batch Data
  const data: any[] = [];
  for (const u of updates) {
    const rowNumber = rowMap.get(u.id);
    const existing = dataMap.get(u.id);
    if (!rowNumber || !existing) continue;

    const updatedObj = { ...existing, ...u.data, id: u.id };
    const updatedRow = mapObjectToRow(updatedObj, headers);

    data.push({
      range: `Order_Lines!A${rowNumber}`,
      values: [updatedRow]
    });
  }

  // 4. Send batches in chunks (e.g. 50 per call) to be safe
  const chunkSize = 50;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    console.log(`[batchUpdateOrderLines] Writing chunk ${i / chunkSize + 1}...`);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: chunk
      }
    });
    // Tiny delay between chunks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
