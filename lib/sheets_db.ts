if (typeof window === "undefined") {
  process.env.TZ = "Asia/Ho_Chi_Minh";
}

import { google } from 'googleapis';
import { unstable_cache, revalidateTag } from 'next/cache';

// Per-sheet cache tag: each sheet gets its own tag so writing to Orders
// does not invalidate the cache for Products, Units, etc.
const getCacheTag = (sheetName: string) => `sheets-${sheetName}`;

// Static sheets rarely change (5 min), dynamic sheets change often (60s)
const STATIC_SHEETS = new Set([
  'Units', 'Item_Categories', 'Product_Categories', 'Brands',
  'Suppliers', 'Users',
]);
const getRevalidation = (sheetName: string) => STATIC_SHEETS.has(sheetName) ? 300 : 60;

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Parse the base64 credentials
export function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 is not set in environment variables');
  }
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export const getSheetsClient = () => {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
};

// Helper: Convert array of arrays to array of objects
function mapRowsToObjects(rows: string[][]): any[] {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: any = {};
    headers.forEach((header, index) => {
      let val = row[index] || '';
      // Fix timezone for datetime columns that might have lost their UTC 'Z' indicator in Google Sheets
      if ((header === 'created_at' || header === 'updated_at') && typeof val === 'string' && val.length > 0) {
        if (!val.endsWith('Z') && !val.includes('+')) {
          val = val.replace(' ', 'T') + 'Z';
        }
      }
      obj[header] = val; // Handle empty cells
    });
    return obj;
  });
}

// Helper: Convert object to array based on headers
function mapObjectToRow(obj: any, headers: string[]): string[] {
  return headers.map((header) => {
    const val = obj[header];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

// Get all records from a sheet (cached)
export const findAll = (sheetName: string) => {
  if (process.env.CLI_MODE === "true") {
    return findAllNoCache(sheetName);
  }

  const tag = getCacheTag(sheetName);
  const reval = getRevalidation(sheetName);
  return unstable_cache(
    async (name: string) => {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${name}!A1:Z`,
      });
      return mapRowsToObjects(res.data.values || []);
    },
    ['sheets-findall', sheetName],
    { revalidate: reval, tags: [tag] }
  )(sheetName);
};

// Get all records from a sheet (no cache)
export const findAllNoCache = async (sheetName: string) => {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  return mapRowsToObjects(res.data.values || []);
};

// Find one record by ID
export async function findById(sheetName: string, id: string) {
  const all = await findAll(sheetName);
  return all.find((item) => item.id === id) || null;
}

export const getHeadersNoCache = async (sheetName: string): Promise<string[]> => {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });
  return res.data.values ? res.data.values[0] : [];
};

// Get headers of a sheet (cached)
export const getHeaders = (sheetName: string) => {
  if (process.env.CLI_MODE === "true") {
    return getHeadersNoCache(sheetName);
  }

  const tag = getCacheTag(sheetName);
  return unstable_cache(
    async (name: string): Promise<string[]> => {
      return getHeadersNoCache(name);
    },
    ['sheets-headers', sheetName],
    { revalidate: 3600, tags: [tag] }
  )(sheetName);
};

// Generate new ID (e.g. BR-001)
export async function generateNewId(sheetName: string, prefix: string): Promise<string> {
  const all = await findAllNoCache(sheetName);
  if (all.length === 0) return `${prefix}-001`;
  
  // Find max ID
  let maxNum = 0;
  for (const item of all) {
    if (item.id && item.id.startsWith(prefix)) {
      const numStr = item.id.replace(`${prefix}-`, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `${prefix}-${nextNum.toString().padStart(3, '0')}`;
}

// Insert a new record
export async function insert(sheetName: string, data: any) {
  const sheets = getSheetsClient();
  const headers = await getHeaders(sheetName);
  if (!headers || headers.length === 0) throw new Error(`Sheet ${sheetName} has no headers`);

  const newRow = mapObjectToRow(data, headers);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [newRow],
    },
  });

  try {
    revalidateTag(getCacheTag(sheetName));
  } catch (e) {
    // Ignore error if not in Next.js context
  }

  return data;
}

// Insert multiple records
export async function insertMany(sheetName: string, dataArray: any[]) {
  if (!dataArray || dataArray.length === 0) return [];
  
  const sheets = getSheetsClient();
  const headers = await getHeaders(sheetName);
  if (!headers || headers.length === 0) throw new Error(`Sheet ${sheetName} has no headers`);

  const rows = dataArray.map(data => mapObjectToRow(data, headers));

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows,
    },
  });

  try {
    revalidateTag(getCacheTag(sheetName));
  } catch (e) {
    // Ignore error if not in Next.js context
  }

  return dataArray;
}

// Update an existing record
export async function update(sheetName: string, id: string, data: any) {
  const sheets = getSheetsClient();
  
  // Need to find the exact row number to update
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

  // Merge existing data with new data
  const existingObj: Record<string, any> = {};
  headers.forEach((h: string, idx: number) => { existingObj[h] = rows[rowIndex][idx] || ''; });
  const updatedObj = { ...existingObj, ...data, id }; // Ensure ID is immutable
  
  const updatedRow = mapObjectToRow(updatedObj, headers);
  const rowNumber = rowIndex + 1; // 1-indexed

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [updatedRow],
    },
  });

  try {
    revalidateTag(getCacheTag(sheetName));
  } catch (e) {
    // Ignore error if not in Next.js context
  }

  return updatedObj;
}

// Update multiple existing records by id using one Sheets batch request.
export async function updateMany(sheetName: string, dataArray: any[]) {
  if (!dataArray || dataArray.length === 0) return [];

  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) throw new Error(`No records found in ${sheetName}`);

  const headers = rows[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error(`Sheet ${sheetName} has no 'id' column`);

  const rowIndexById = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const rowId = rows[i][idIndex];
    if (rowId) rowIndexById.set(rowId, i);
  }

  const updatedObjects = dataArray.map((data) => {
    const id = data?.id;
    const rowIndex = rowIndexById.get(id);
    if (rowIndex === undefined) {
      throw new Error(`Record with id ${id} not found in ${sheetName}`);
    }

    const existingObj: Record<string, any> = {};
    headers.forEach((h: string, idx: number) => { existingObj[h] = rows[rowIndex][idx] || ''; });
    return { ...existingObj, ...data, id };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updatedObjects.map((updatedObj) => {
        const rowIndex = rowIndexById.get(updatedObj.id);
        const rowNumber = (rowIndex ?? 0) + 1;
        return {
          range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
          values: [mapObjectToRow(updatedObj, headers)],
        };
      }),
    },
  });

  try {
    revalidateTag(getCacheTag(sheetName));
  } catch (e) {
    // Ignore error if not in Next.js context
  }

  return updatedObjects;
}

// Delete a record (Since Google Sheets API deleteRow is complex and requires sheetId, we just clear the row or mark as deleted. Here we'll actually delete the row using batchUpdate)
export async function remove(sheetName: string, id: string) {
  const sheets = getSheetsClient();
  
  // 1. Get sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title?.toLowerCase() === sheetName.toLowerCase());
  if (!sheet || sheet.properties?.sheetId === undefined) throw new Error(`Sheet ${sheetName} not found`);
  const sheetId = sheet.properties.sheetId;

  // 2. Find row index
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  
  const rows = res.data.values || [];
  const headers = rows[0] || [];
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

  // 3. Delete row via batchUpdate
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });

  try {
    revalidateTag(getCacheTag(sheetName));
  } catch (e) {
    // Ignore error if not in Next.js context
  }

  return true;
}

// Delete multiple records by ID
export async function removeMany(sheetName: string, ids: string[]) {
  if (!ids || ids.length === 0) return true;

  const sheets = getSheetsClient();
  
  // 1. Get sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title?.toLowerCase() === sheetName.toLowerCase());
  if (!sheet || sheet.properties?.sheetId === undefined) throw new Error(`Sheet ${sheetName} not found`);
  const sheetId = sheet.properties.sheetId;

  // 2. Find row indices
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  
  const rows = res.data.values || [];
  const headers = rows[0] || [];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error(`Sheet ${sheetName} has no 'id' column`);

  const rowIndices: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (ids.includes(rows[i][idIndex])) {
      rowIndices.push(i);
    }
  }

  if (rowIndices.length === 0) return true;

  // Sort indices descending to avoid shifting issues when deleting
  rowIndices.sort((a, b) => b - a);

  // 3. Delete rows via batchUpdate
  const requests = rowIndices.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex,
        endIndex: rowIndex + 1
      }
    }
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests
    }
  });

  try {
    revalidateTag(getCacheTag(sheetName));
  } catch (e) {
    // Ignore error if not in Next.js context
  }

  return true;
}
