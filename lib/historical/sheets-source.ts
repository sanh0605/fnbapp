/**
 * Google Sheets read-only source adapter.
 *
 * Claude code — Supabase migration Phase C.
 *
 * Used by migration scripts to read source data from Google Sheets while
 * `lib/sheets_db.ts` shim has been swapped to Supabase. This module bypasses
 * the shim with direct `googleapis` calls.
 *
 * Only read operations. No writes — sheets is no longer authoritative.
 */

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 is not set in environment variables');
  }
  const credentialsJson = Buffer.from(
    process.env.GOOGLE_CREDENTIALS_BASE64,
    'base64',
  ).toString('utf-8');
  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function fixDateTime(header: string, val: string): string {
  if (
    (header === 'created_at' || header === 'updated_at' || header === 'event_at' ||
      header === 'completed_at' || header === 'voided_at' || header === 'approved_at' ||
      header === 'transaction_date' || header === 'effective_at') &&
    typeof val === 'string' &&
    val.length > 0
  ) {
    if (!val.endsWith('Z') && !val.includes('+')) {
      return val.replace(' ', 'T') + 'Z';
    }
  }
  return val;
}

/**
 * Read all rows from a sheet as objects keyed by header.
 */
export async function readAllFromSheets(
  sheetName: string,
): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
  const values = await readRawValuesFromSheets(sheetName);
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0].map(value => String(value ?? ''));
  const rows = values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const raw = String(row[idx] ?? '');
      obj[header] = fixDateTime(header, raw);
    });
    return obj;
  });
  return { headers, rows };
}

/**
 * Read exact cell values without timestamp or type normalization.
 */
export async function readRawValuesFromSheets(
  sheetName: string,
): Promise<unknown[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:ZZ`,
  });
  return (res.data.values || []) as unknown[][];
}

/**
 * Capture the visible, typed, and formula representations of every cell.
 */
export async function readRawSheetSnapshot(
  sheetName: string,
): Promise<{
  values: unknown[][];
  unformattedValues: unknown[][];
  formulaValues: unknown[][];
}> {
  const snapshots = await readRawSheetSnapshots([sheetName]);
  return snapshots[sheetName];
}

/**
 * Batch capture multiple sheets in three API requests total.
 */
export async function readRawSheetSnapshots(
  sheetNames: string[],
): Promise<Record<string, {
  values: unknown[][];
  unformattedValues: unknown[][];
  formulaValues: unknown[][];
}>> {
  const sheets = getSheetsClient();
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    ranges: sheetNames.map(sheetName => `${sheetName}!A1:ZZ`),
  };
  const [formatted, unformatted, formulas] = await Promise.all([
    sheets.spreadsheets.values.batchGet({
      ...request,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
    sheets.spreadsheets.values.batchGet({
      ...request,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    }),
    sheets.spreadsheets.values.batchGet({
      ...request,
      valueRenderOption: 'FORMULA',
    }),
  ]);
  return Object.fromEntries(
    sheetNames.map((sheetName, index) => [
      sheetName,
      {
        values:
          (formatted.data.valueRanges?.[index]?.values || []) as unknown[][],
        unformattedValues:
          (unformatted.data.valueRanges?.[index]?.values || []) as unknown[][],
        formulaValues:
          (formulas.data.valueRanges?.[index]?.values || []) as unknown[][],
      },
    ]),
  );
}
