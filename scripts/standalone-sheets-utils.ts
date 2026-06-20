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

/**
 * Standalone update function that bypasses revalidateTag
 */
export async function updateNoCache(sheetName: string, id: string, data: any) {
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  
  const rows = res.data.values || [];
  if (rows.length < 2) throw new Error(`Record with id ${id} not found`);
  
  const headers = rows[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error(`Sheet ${sheetName} has no 'id' column`);

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === id) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) throw new Error(`Record with id ${id} not found in ${sheetName}`);

  const existingObj: Record<string, any> = {};
  headers.forEach((h: string, idx: number) => { existingObj[h] = rows[rowIndex][idx] || ''; });
  const updatedObj = { ...existingObj, ...data, id };
  
  const updatedRow = mapObjectToRow(updatedObj, headers);
  const rowNumber = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [updatedRow],
    },
  });

  return data;
}
